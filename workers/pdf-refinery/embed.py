#!/usr/bin/env python3
"""
Embed worker — generates vector embeddings for document chunks.

Called by the Node.js pdf-refinery worker via child_process.
Uses native Python + minimal deps to stay memory-efficient (~50MB RSS).

Usage:
    python3 embed.py <documentId> <storagePath>

Environment:
    DATABASE_URL          — PostgreSQL connection string
    AZURE_OPENAI_API_KEY  — Azure OpenAI API key
    AZURE_OPENAI_ENDPOINT — Azure OpenAI endpoint URL
    AZURE_OPENAI_API_VERSION — API version (default: 2024-08-01-preview)
    MINIO_ENDPOINT        — S3/MinIO endpoint
    MINIO_ROOT_USER       — S3 access key
    MINIO_ROOT_PASSWORD   — S3 secret key
    STORAGE_BUCKET        — S3 bucket name (default: storage)
"""

import json
import os
import sys
import uuid
from urllib.request import Request, urlopen
from urllib.error import HTTPError

import boto3
import psycopg2


# ── Config ──────────────────────────────────────────────────────

EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_DIM = 3072
CHUNK_SIZE = 512       # words per chunk
CHUNK_OVERLAP = 50     # overlapping words between chunks
BATCH_SIZE = 16        # embeddings per API call


# ── Text chunking ──────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping word-based chunks."""
    words = text.split()
    if not words:
        return []
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        if end >= len(words):
            break
        start = end - overlap
    return chunks


# ── Azure OpenAI embeddings (raw HTTP — no SDK) ───────────────

def fetch_embeddings(inputs: list[str]) -> list[list[float]]:
    """Call Azure OpenAI embedding API using urllib with retry for rate limits."""
    import time

    api_key = os.environ.get("AZURE_OPENAI_API_KEY", "")
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
    api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

    if not api_key or not endpoint:
        raise RuntimeError("AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT must be set")

    url = f"{endpoint}/openai/deployments/{EMBEDDING_MODEL}/embeddings?api-version={api_version}"
    data = json.dumps({"input": inputs}).encode("utf-8")

    max_retries = 5
    for attempt in range(max_retries):
        req = Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        req.add_header("api-key", api_key)

        try:
            with urlopen(req, timeout=60) as resp:
                body = json.loads(resp.read())
            return [item["embedding"] for item in body["data"]]
        except HTTPError as e:
            if e.code == 429 and attempt < max_retries - 1:
                # Parse retry-after from response or use exponential backoff
                retry_after = int(e.headers.get("Retry-After", 2 ** (attempt + 1)))
                retry_after = min(retry_after, 120)  # cap at 2 minutes
                print(f"[embed.py] Rate limited, waiting {retry_after}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(retry_after)
                continue
            raise RuntimeError(f"Azure OpenAI {e.code}: {e.read().decode()}")


# ── Storage fetch (Azure Blob or S3/MinIO) ────────────────────

def fetch_from_storage(key: str) -> str:
    """Download a file from storage and return as UTF-8 string.
    
    Supports both Azure Blob Storage (production) and MinIO/S3 (local dev).
    Auto-detects based on STORAGE_PROVIDER env var.
    """
    provider = os.environ.get("STORAGE_PROVIDER", "MINIO").upper()
    bucket = os.environ.get("STORAGE_BUCKET", "storage")

    if provider == "AZURE":
        return _fetch_azure(bucket, key)
    else:
        return _fetch_s3(bucket, key)


def _fetch_azure(container_name: str, key: str) -> str:
    """Fetch from Azure Blob Storage using urllib (no SDK dependency)."""
    conn_str = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")
    if not conn_str:
        raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING not set")

    # Parse connection string for AccountName, AccountKey, and endpoint
    parts = dict(p.split("=", 1) for p in conn_str.split(";") if "=" in p)
    account = parts.get("AccountName", "")
    account_key = parts.get("AccountKey", "")
    endpoint_suffix = parts.get("EndpointSuffix", "core.windows.net")
    protocol = parts.get("DefaultEndpointsProtocol", "https")

    # Build signed URL using SharedKey (or just use the azure-storage-blob package)
    # Simpler: use the azure.storage.blob SDK which is lightweight
    from azure.storage.blob import BlobServiceClient
    blob_service = BlobServiceClient.from_connection_string(conn_str)
    blob_client = blob_service.get_blob_client(container=container_name, blob=key)
    return blob_client.download_blob().readall().decode("utf-8")


def _fetch_s3(bucket: str, key: str) -> str:
    """Fetch from S3/MinIO using boto3."""
    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ.get("MINIO_ENDPOINT", "http://localhost:9000"),
        aws_access_key_id=os.environ.get("MINIO_ROOT_USER", "surdej"),
        aws_secret_access_key=os.environ.get("MINIO_ROOT_PASSWORD", "surdej_dev"),
        region_name="us-east-1",
    )
    obj = s3.get_object(Bucket=bucket, Key=key)
    return obj["Body"].read().decode("utf-8")


# ── Main embed logic ─────────────────────────────────────────

def embed_document(document_id: str, storage_path: str) -> dict:
    """Generate embeddings for a document and store in DocumentChunk table."""

    # 0. Derive .md path
    md_path = storage_path
    if not md_path.endswith(".md"):
        md_path = md_path.rsplit(".pdf", 1)[0] + ".md"

    # 1. Fetch text from storage
    try:
        text = fetch_from_storage(md_path)
        print(f"[embed.py] Fetched {len(text)} chars from {md_path}")
    except Exception as e:
        print(f"[embed.py] Failed to fetch {md_path}: {e}", file=sys.stderr)
        return {"documentId": document_id, "chunkCount": 0, "error": str(e)}

    # 2. Chunk text
    chunks = chunk_text(text)
    print(f"[embed.py] Created {len(chunks)} chunks")
    if not chunks:
        return {"documentId": document_id, "chunkCount": 0}

    # 3. Connect to PostgreSQL (strip Prisma-specific ?schema=... param)
    dsn = os.environ["DATABASE_URL"].split("?")[0]
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    # Look up tenantId from the Blob table
    cur.execute('SELECT "tenantId" FROM "Blob" WHERE id = %s', (document_id,))
    row = cur.fetchone()
    if not row or not row[0]:
        print(f"[embed.py] No tenant found for blob {document_id}", file=sys.stderr)
        cur.close()
        conn.close()
        return {"documentId": document_id, "chunkCount": 0, "error": "No tenant for blob"}
    tenant_id = row[0]

    try:
        # Delete existing chunks
        cur.execute('DELETE FROM "DocumentChunk" WHERE "blobId" = %s', (document_id,))
        conn.commit()

        # 4. Generate embeddings + insert in batches
        stored = 0
        for batch_start in range(0, len(chunks), BATCH_SIZE):
            batch = chunks[batch_start : batch_start + BATCH_SIZE]
            batch_num = batch_start // BATCH_SIZE + 1

            try:
                embeddings = fetch_embeddings(batch)
                print(f"[embed.py] Batch {batch_num}: got {len(embeddings)} embeddings")

                for i, (chunk_text_item, emb) in enumerate(zip(batch, embeddings)):
                    chunk_index = batch_start + i
                    vector_str = "[" + ",".join(str(v) for v in emb) + "]"
                    token_estimate = len(chunk_text_item) // 4

                    cur.execute(
                        """INSERT INTO "DocumentChunk"
                           (id, "blobId", "chunkIndex", content, "tokenCount", embedding, "createdAt", "tenantId")
                           VALUES (gen_random_uuid(), %s, %s, %s, %s, %s::vector, NOW(), %s)""",
                        (document_id, chunk_index, chunk_text_item, token_estimate, vector_str, tenant_id),
                    )
                    stored += 1

                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"[embed.py] Batch {batch_num} failed: {e}", file=sys.stderr)

        print(f"[embed.py] ✅ {document_id}: {stored}/{len(chunks)} chunks embedded")
        return {
            "documentId": document_id,
            "chunkCount": stored,
            "totalChunks": len(chunks),
            "embeddingDim": EMBEDDING_DIM,
            "model": EMBEDDING_MODEL,
        }
    finally:
        cur.close()
        conn.close()


# ── CLI entry point ──────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 embed.py <documentId> <storagePath>", file=sys.stderr)
        sys.exit(1)

    doc_id = sys.argv[1]
    path = sys.argv[2]

    result = embed_document(doc_id, path)
    print(json.dumps(result))
    sys.exit(0 if result.get("chunkCount", 0) >= 0 else 1)
