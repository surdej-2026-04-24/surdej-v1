#!/usr/bin/env node
/**
 * Re-extract all PDFs — Triggers re-extraction jobs for all existing documents.
 *
 * This connects directly to the database to find all PDF blobs, then
 * publishes NATS extract-text jobs for each one. The pdf-refinery worker
 * will pick these up and re-extract using the Python pymupdf4llm extractor.
 *
 * Usage:
 *   npx tsx re-extract.ts
 *   npx tsx re-extract.ts --status completed   # only re-extract completed docs
 *   npx tsx re-extract.ts --limit 5            # only first 5
 *
 * Environment:
 *   DATABASE_URL — Postgres connection (default: local docker)
 *   NATS_URL     — NATS server (default: nats://localhost:4222)
 */

import { PrismaClient } from '@prisma/client';
import { connect, StringCodec } from 'nats';

const prisma = new PrismaClient({
    datasourceUrl: process.env['DATABASE_URL'] || 'postgresql://surdej:surdej_dev@localhost:5432/surdej?schema=public',
});
const sc = StringCodec();

// Parse args
const args = process.argv.slice(2);
const statusFilter = args.includes('--status') ? args[args.indexOf('--status') + 1] : undefined;
const limitArg = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1] ?? '0', 10) : 0;

async function main() {
    console.log('\n🔄 Re-extract All PDFs');
    console.log('─'.repeat(50));

    // 1. Find all PDF documents
    const where: Record<string, unknown> = {
        mimeType: 'application/pdf',
    };
    if (statusFilter) {
        // Filter by metadata.status using JSON path
        where.metadata = { path: ['status'], equals: statusFilter };
    }

    const blobs = await prisma.blob.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: limitArg > 0 ? limitArg : undefined,
        select: {
            id: true,
            filename: true,
            storagePath: true,
            sizeBytes: true,
            metadata: true,
        },
    });

    console.log(`📄 Found ${blobs.length} PDF documents${statusFilter ? ` (status: ${statusFilter})` : ''}${limitArg > 0 ? ` (limit: ${limitArg})` : ''}\n`);

    if (blobs.length === 0) {
        console.log('No documents to re-extract. Exiting.');
        return;
    }

    // 2. Connect to NATS
    const natsUrl = process.env['NATS_URL'] || 'nats://localhost:4222';
    console.log(`📡 Connecting to NATS at ${natsUrl}...`);
    const nc = await connect({ servers: natsUrl });
    console.log('   Connected!\n');

    // 3. Publish extract-text jobs
    let published = 0;
    for (const blob of blobs) {
        const meta = blob.metadata as Record<string, unknown> | null;
        const oldStatus = meta?.['status'] as string | undefined;
        const oldQuality = meta?.['quality'] as number | undefined;

        const jobMessage = {
            id: `reextract-${blob.id}-${Date.now()}`,
            action: 'extract-text',
            payload: {
                documentId: blob.id,
                storagePath: blob.storagePath,
                filename: blob.filename,
                sizeBytes: blob.sizeBytes,
            },
        };

        nc.publish('job.pdf-refinery.extract-text', sc.encode(JSON.stringify(jobMessage)));
        published++;

        const sizeKB = blob.sizeBytes ? `${(blob.sizeBytes / 1024).toFixed(0)} KB` : '?';
        const prev = oldQuality !== undefined ? `q=${oldQuality}` : oldStatus ?? 'new';
        console.log(`   📤 [${published}/${blobs.length}] ${blob.filename} (${sizeKB}, prev: ${prev})`);
    }

    // 4. Flush and close
    await nc.flush();
    await nc.close();

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`✅ Published ${published} re-extraction jobs`);
    console.log(`   The pdf-refinery worker will process them using pymupdf4llm.`);
    console.log(`   Monitor progress: docker compose logs -f pdf-refinery-worker`);
    console.log(`${'─'.repeat(50)}\n`);

    await prisma.$disconnect();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
