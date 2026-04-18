
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
// import { Upload } from '@aws-sdk/lib-storage'; // For larger uploads stream
import type { ContainerClient } from '@azure/storage-blob';
import { BlobServiceClient } from '@azure/storage-blob';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';
import { isNatsConnected, getJetStream } from '../nats/index.js';
import { StringCodec } from 'nats';
import { injectTraceHeaders } from '@surdej/core/node';

const prisma = new PrismaClient();
const sc = StringCodec();

const PROVIDER = process.env.STORAGE_PROVIDER || 'MINIO';
const BUCKET_NAME = process.env.STORAGE_BUCKET || 'storage';

// ─── Clients ───

let s3Client: S3Client | null = null;
let azureContainerClient: ContainerClient | null = null;

// Initialize based on provider
if (PROVIDER === 'AZURE') {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
        // Warn or throw? Throwing is safer to detect config errors early.
        // But if running locally without Azure env vars, it might crash if logic is loose.
        console.warn('STORAGE_PROVIDER is AZURE but AZURE_STORAGE_CONNECTION_STRING is missing.');
    } else {
        try {
            const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            azureContainerClient = blobServiceClient.getContainerClient(BUCKET_NAME);
            // Ensure container exists?
            azureContainerClient.createIfNotExists().catch(err => {
                console.error('Failed to ensure Azure container exists:', err);
            });
        } catch (err) {
            console.error('Failed to initialize Azure Blob Client:', err);
        }
    }
} else {
    // MinIO / S3
    s3Client = new S3Client({
        region: 'us-east-1', // MinIO default
        endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
        credentials: {
            accessKeyId: process.env.MINIO_ROOT_USER || 'surdej',
            secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'surdej_dev',
        },
        forcePathStyle: true, // Required for MinIO
    });
}

export interface BlobUploadOptions {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    tenantId?: string;
    userId?: string;
    metadata?: Record<string, any>;
}

/**
 * Upload a blob to Storage (MinIO or Azure) and save metadata to DB.
 */
export async function uploadBlob(
    fileStream: Readable | Buffer,
    options: BlobUploadOptions
) {
    const key = `${options.tenantId || 'public'}/${randomUUID()}-${options.filename}`;

    try {
        if (PROVIDER === 'AZURE') {
            if (!azureContainerClient) throw new Error('Azure Storage not configured');
            const blockBlobClient = azureContainerClient.getBlockBlobClient(key);

            const metadata = {
                originalName: options.filename,
                uploadedBy: options.userId || 'system',
                ...options.metadata
            };

            const headers = { blobContentType: options.mimeType };

            if (Buffer.isBuffer(fileStream)) {
                await blockBlobClient.uploadData(fileStream, {
                    blobHTTPHeaders: headers,
                    metadata: metadata as Record<string, string>
                });
            } else {
                // Determine buffer size for stream
                const bufferSize = 4 * 1024 * 1024; // 4MB
                const maxConcurrency = 5;
                await blockBlobClient.uploadStream(fileStream, bufferSize, maxConcurrency, {
                    blobHTTPHeaders: headers,
                    metadata: metadata as Record<string, string>
                });
            }
        } else {
            // MinIO / S3
            if (!s3Client) throw new Error('S3 Client not configured');

            await s3Client.send(new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: fileStream,
                ContentType: options.mimeType,
                Metadata: {
                    originalName: options.filename,
                    uploadedBy: options.userId || 'system',
                    ...options.metadata ? Object.entries(options.metadata).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {}) : {}
                }
            }));
        }
    } catch (err) {
        console.error(`Upload to ${PROVIDER} failed:`, err);
        throw err;
    }

    // Save to DB
    const blob = await prisma.blob.create({
        data: {
            filename: options.filename,
            mimeType: options.mimeType,
            sizeBytes: options.sizeBytes,
            storagePath: key,
            uploaderId: options.userId,
            tenantId: options.tenantId,
            metadata: {
                ...(options.metadata || {}),
                provider: PROVIDER
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
    });

    try {
        if (isNatsConnected()) {
            const js = getJetStream();
            if (options.mimeType === 'application/pdf') {
                await js.publish('job.pdf-refinery.extract-text', sc.encode(JSON.stringify({
                    id: `extract-${blob.id}`,
                    action: 'extract-text',
                    payload: {
                        documentId: blob.id,
                        storagePath: blob.storagePath,
                        filename: blob.filename,
                    }
                })), { headers: injectTraceHeaders() });
                console.log(`[blobs] Triggered async PDF extraction for ${blob.id}`);
            } else if (
                options.mimeType.includes('officedocument') || 
                options.mimeType.includes('msword') || 
                options.mimeType.includes('excel')
            ) {
                await js.publish('job.document.process', sc.encode(JSON.stringify({
                    id: `process-${blob.id}`,
                    action: 'process',
                    payload: {
                        documentId: blob.id,
                        storagePath: blob.storagePath,
                        filename: blob.filename,
                    }
                })), { headers: injectTraceHeaders() });
                console.log(`[blobs] Triggered async Document processing for ${blob.id}`);
            }
        }
    } catch (natsErr) {
        console.warn(`[blobs] Failed to trigger async extraction for ${blob.id}:`, natsErr);
    }

    return blob;
}

/**
 * Get a blob's stream and metadata.
 */
export async function getBlob(id: string) {
    const blob = await prisma.blob.findUnique({
        where: { id },
    });

    if (!blob) return null;

    try {
        // Determine provider. Ideally store in DB, but for now rely on current ENV.
        // If migrating data, we might need logic to support both concurrently or migration.
        // Assuming current provider:

        let stream: Readable;
        let contentType: string | undefined;
        let contentLength: number | undefined;

        if (PROVIDER === 'AZURE') {
            if (!azureContainerClient) throw new Error('Azure Storage not configured');
            const blobClient = azureContainerClient.getBlobClient(blob.storagePath);
            const downloadResponse = await blobClient.download();

            if (!downloadResponse.readableStreamBody) {
                throw new Error('Azure download response missing body');
            }
            stream = downloadResponse.readableStreamBody as Readable;
            contentType = downloadResponse.contentType;
            contentLength = downloadResponse.contentLength;

        } else {
            if (!s3Client) throw new Error('S3 Client not configured');
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: blob.storagePath,
            });
            const response = await s3Client.send(command);
            stream = response.Body as Readable;
            contentType = response.ContentType;
            contentLength = response.ContentLength;
        }

        return {
            blob,
            stream,
            contentType,
            contentLength,
        };
    } catch (err) {
        console.error(`Failed to fetch blob ${id} from ${PROVIDER}`, err);
        return null;
    }
}

/**
 * Delete a blob.
 */
export async function deleteBlob(_id: string) {
    // TODO: implement delete
    // Check provider, delete from storage, delete from DB
}

/**
 * Fetch a blob directly by its storage key (no DB lookup).
 * Used for serving avatars and other known-path objects.
 */
export async function getBlobByKey(key: string) {
    try {
        if (PROVIDER === 'AZURE') {
            if (!azureContainerClient) throw new Error('Azure Storage not configured');
            const blobClient = azureContainerClient.getBlobClient(key);
            const downloadResponse = await blobClient.download();
            if (!downloadResponse.readableStreamBody) throw new Error('Azure download response missing body');
            return {
                stream: downloadResponse.readableStreamBody as Readable,
                contentType: downloadResponse.contentType,
                contentLength: downloadResponse.contentLength,
            };
        } else {
            if (!s3Client) throw new Error('S3 Client not configured');
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            }));
            return {
                stream: response.Body as Readable,
                contentType: response.ContentType,
                contentLength: response.ContentLength,
            };
        }
    } catch (err) {
        console.error(`Failed to fetch blob by key '${key}' from ${PROVIDER}:`, err);
        return null;
    }
}

/**
 * Upload a buffer directly to storage by key (no DB record).
 * Used by seed scripts for avatars, logos, etc.
 */
export async function uploadDirect(key: string, body: Buffer, contentType: string) {
    if (PROVIDER === 'AZURE') {
        if (!azureContainerClient) throw new Error('Azure Storage not configured');
        const blockBlobClient = azureContainerClient.getBlockBlobClient(key);
        await blockBlobClient.uploadData(body, {
            blobHTTPHeaders: { blobContentType: contentType },
        });
    } else {
        if (!s3Client) throw new Error('S3 Client not configured');
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: body,
            ContentType: contentType,
        }));
    }
}
