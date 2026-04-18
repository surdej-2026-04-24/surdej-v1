#!/usr/bin/env node
/**
 * Sync blobs from Azure production storage to local MinIO.
 *
 * Usage:  node scripts/sync-blob-from-prod.mjs [--prefix <path>] [--dry-run]
 *
 * Reads AZURE_STORAGE_CONNECTION_STRING from .env (root).
 */

import 'dotenv/config';
import { BlobServiceClient } from '@azure/storage-blob';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// ── Config ──────────────────────────────────────────────────────
const AZURE_CONN = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_CONTAINER = process.env.AZURE_STORAGE_CONTAINER || 'surdej';
const MINIO_BUCKET = process.env.STORAGE_BUCKET || 'storage';
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://127.0.0.1:9000';
const MINIO_USER = process.env.MINIO_ROOT_USER || 'surdej';
const MINIO_PASS = process.env.MINIO_ROOT_PASSWORD || 'surdej_dev';

if (!AZURE_CONN) {
  console.error('❌ AZURE_STORAGE_CONNECTION_STRING not set. Check .env');
  process.exit(1);
}

// ── CLI args ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const prefixIdx = args.indexOf('--prefix');
const prefix = prefixIdx !== -1 ? args[prefixIdx + 1] : undefined;
const dryRun = args.includes('--dry-run');

// ── Clients ─────────────────────────────────────────────────────
const azureBlobService = BlobServiceClient.fromConnectionString(AZURE_CONN);
const azureContainer = azureBlobService.getContainerClient(AZURE_CONTAINER);

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: MINIO_ENDPOINT,
  credentials: { accessKeyId: MINIO_USER, secretAccessKey: MINIO_PASS },
  forcePathStyle: true,
});

// ── Helpers ─────────────────────────────────────────────────────
async function existsInMinio(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log(`🔄 Syncing Azure (${AZURE_CONTAINER}) → MinIO (${MINIO_BUCKET})`);
  if (prefix) console.log(`   prefix filter: ${prefix}`);
  if (dryRun) console.log('   DRY RUN — no writes');

  let listed = 0;
  let copied = 0;
  let skipped = 0;
  let errors = 0;

  for await (const blob of azureContainer.listBlobsFlat({ prefix })) {
    listed++;
    const key = blob.name;

    // Skip if already in MinIO
    if (await existsInMinio(key)) {
      skipped++;
      process.stdout.write(`  ⏭  ${key} (exists)\r`);
      continue;
    }

    if (dryRun) {
      console.log(`  📦 would copy: ${key} (${(blob.properties.contentLength / 1024).toFixed(1)} KB)`);
      copied++;
      continue;
    }

    try {
      const download = await azureContainer.getBlobClient(key).download(0);
      const chunks = [];
      for await (const chunk of download.readableStreamBody) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);

      await s3.send(new PutObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: key,
        Body: body,
        ContentType: blob.properties.contentType || 'application/octet-stream',
      }));

      copied++;
      console.log(`  ✅ ${key} (${(body.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      errors++;
      console.error(`  ❌ ${key}: ${err.message}`);
    }
  }

  console.log(`\n📊 Done — listed: ${listed}, copied: ${copied}, skipped: ${skipped}, errors: ${errors}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
