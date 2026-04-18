/**
 * Document Processing Integration Tests
 *
 * Tests the full document upload → Python extraction → .md storage pipeline
 * for all supported Office formats: .docx, .xlsx, .pptx.
 *
 * Prerequisites:
 *   - API server running (docker compose up -d api)
 *   - PostgreSQL + NATS + MinIO available
 *   - document-extractor Python service running (port 8091)
 *   - document-worker running (NATS consumer)
 *   - Test fixtures generated: python3 tests/integration/fixtures/generate-test-docs.py
 *
 * Run: pnpm --filter @surdej/tests test:integration -- document-processing
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const API = process.env.API_URL ?? 'http://localhost:5001/api';
const EXTRACTOR_URL = process.env.DOCUMENT_EXTRACTOR_URL ?? 'http://localhost:8091';
const FIXTURES = join(import.meta.dirname, 'fixtures');

let authToken: string;
let tenantId: string;

// ─── Helpers ──────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
    return {
        'Authorization': `Bearer ${authToken}`,
    };
}

async function login(): Promise<{ token: string; tenantId: string }> {
    const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@surdej.dev' }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const data = await res.json() as { token: string };

    // Get tenant from /auth/me
    const meRes = await fetch(`${API}/auth/me`, {
        headers: { 'Authorization': `Bearer ${data.token}` },
    });
    const me = await meRes.json() as { acl: { activeTenantId: string } };

    return { token: data.token, tenantId: me.acl.activeTenantId };
}

async function uploadBlob(filePath: string, mimeType: string): Promise<{ id: string; filename: string; mimeType: string; storagePath: string }> {
    const buffer = readFileSync(filePath);
    const filename = filePath.split('/').pop()!;

    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimeType }), filename);

    const res = await fetch(`${API}/blobs`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<{ id: string; filename: string; mimeType: string; storagePath: string }>;
}

async function pollBlobStatus(blobId: string, timeoutMs = 30_000): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const res = await fetch(`${API}/blobs/${blobId}/status`, {
            headers: authHeaders(),
        });
        if (res.ok) {
            const { status } = await res.json() as { status: string };
            if (status === 'completed' || status === 'failed') return status;
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    return 'timeout';
}

async function getBlobContent(blobId: string): Promise<Buffer> {
    const res = await fetch(`${API}/blobs/${blobId}`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Get blob failed: ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
}

// ─── Setup ────────────────────────────────────────────────────

beforeAll(async () => {
    const auth = await login();
    authToken = auth.token;
    tenantId = auth.tenantId;
});

// ─── Python Extractor Direct Tests ────────────────────────────

describe('Document Extractor (Python service)', () => {
    it('health endpoint returns ok', async () => {
        const res = await fetch(`${EXTRACTOR_URL}/health`);
        expect(res.ok).toBe(true);

        const data = await res.json() as { status: string; formats: string[] };
        expect(data.status).toBe('ok');
    });

    it('extracts .docx to markdown', async () => {
        const buffer = readFileSync(join(FIXTURES, 'test-report.docx'));
        const formData = new FormData();
        formData.append('file', new Blob([buffer]), 'test-report.docx');

        const res = await fetch(`${EXTRACTOR_URL}/extract`, {
            method: 'POST',
            body: formData,
        });
        expect(res.ok).toBe(true);

        const data = await res.json() as { markdown: string; engine: string; format: string; quality: number; pageCount: number };
        expect(data.engine).toBe('python-docx');
        expect(data.format).toBe('docx');
        expect(data.quality).toBeGreaterThan(0);
        expect(data.markdown).toContain('Integration Test Report');
        expect(data.markdown).toContain('142.857 DKK');
        expect(data.markdown).toContain('SURDEJ-DOCX-TEST-2026');
        // Table content
        expect(data.markdown).toContain('Alice');
        expect(data.markdown).toContain('Developer');
    });

    it('extracts .xlsx to markdown with tables', async () => {
        const buffer = readFileSync(join(FIXTURES, 'test-budget.xlsx'));
        const formData = new FormData();
        formData.append('file', new Blob([buffer]), 'test-budget.xlsx');

        const res = await fetch(`${EXTRACTOR_URL}/extract`, {
            method: 'POST',
            body: formData,
        });
        expect(res.ok).toBe(true);

        const data = await res.json() as { markdown: string; engine: string; format: string; sheetCount: number };
        expect(data.engine).toBe('openpyxl');
        expect(data.format).toBe('xlsx');
        expect(data.sheetCount).toBe(2);
        // Sheet 1: Budget
        expect(data.markdown).toContain('Budget');
        expect(data.markdown).toContain('150000');
        expect(data.markdown).toContain('DKK');
        // Sheet 2: Projects
        expect(data.markdown).toContain('SURDEJ-XLSX-TEST-2026');
        expect(data.markdown).toContain('Active');
    });

    it('extracts .pptx to markdown with slides', async () => {
        const buffer = readFileSync(join(FIXTURES, 'test-presentation.pptx'));
        const formData = new FormData();
        formData.append('file', new Blob([buffer]), 'test-presentation.pptx');

        const res = await fetch(`${EXTRACTOR_URL}/extract`, {
            method: 'POST',
            body: formData,
        });
        expect(res.ok).toBe(true);

        const data = await res.json() as { markdown: string; engine: string; format: string; slideCount: number };
        expect(data.engine).toBe('python-pptx');
        expect(data.format).toBe('pptx');
        expect(data.slideCount).toBe(2);
        expect(data.markdown).toContain('Project Overview');
        expect(data.markdown).toContain('SURDEJ-PPTX-TEST-2026');
        expect(data.markdown).toContain('Key Findings');
    });

    it('rejects unsupported file types', async () => {
        const formData = new FormData();
        formData.append('file', new Blob(['hello']), 'test.txt');

        const res = await fetch(`${EXTRACTOR_URL}/extract`, {
            method: 'POST',
            body: formData,
        });
        expect(res.status).toBe(400);
    });

    it('rejects empty files', async () => {
        const formData = new FormData();
        formData.append('file', new Blob([]), 'empty.docx');

        const res = await fetch(`${EXTRACTOR_URL}/extract`, {
            method: 'POST',
            body: formData,
        });
        expect(res.status).toBe(400);
    });
});

// ─── Full Pipeline Tests (Upload → Worker → Status) ──────────

describe('Document Upload Pipeline', () => {
    it('uploads .docx and worker processes it', async () => {
        const blob = await uploadBlob(
            join(FIXTURES, 'test-report.docx'),
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );

        expect(blob.id).toBeDefined();
        expect(blob.filename).toBe('test-report.docx');
        expect(blob.mimeType).toContain('wordprocessingml');

        // Poll for processing completion (worker should pick up the NATS job)
        const status = await pollBlobStatus(blob.id, 30_000);
        expect(status).toBe('completed');
    }, 45_000);

    it('uploads .xlsx and worker processes it', async () => {
        const blob = await uploadBlob(
            join(FIXTURES, 'test-budget.xlsx'),
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );

        expect(blob.id).toBeDefined();
        expect(blob.filename).toBe('test-budget.xlsx');
        expect(blob.mimeType).toContain('spreadsheetml');

        const status = await pollBlobStatus(blob.id, 30_000);
        expect(status).toBe('completed');
    }, 45_000);

    it('uploads .pptx and worker processes it', async () => {
        const blob = await uploadBlob(
            join(FIXTURES, 'test-presentation.pptx'),
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        );

        expect(blob.id).toBeDefined();
        expect(blob.filename).toBe('test-presentation.pptx');
        expect(blob.mimeType).toContain('presentationml');

        const status = await pollBlobStatus(blob.id, 30_000);
        expect(status).toBe('completed');
    }, 45_000);

    it('text files are immediately completed (no worker needed)', async () => {
        const tmpPath = join(FIXTURES, 'test-plain.txt');
        const { writeFileSync } = await import('fs');
        writeFileSync(tmpPath, 'Plain text content for testing.');

        const blob = await uploadBlob(tmpPath, 'text/plain');
        expect(blob.id).toBeDefined();

        // Text files should be immediately completed (no processing needed)
        const status = await pollBlobStatus(blob.id, 5_000);
        expect(status).toBe('completed');
    }, 10_000);
});

// ─── Blob Status API Tests ───────────────────────────────────

describe('Blob Status API', () => {
    it('returns 404 for non-existent blob', async () => {
        const res = await fetch(`${API}/blobs/00000000-0000-0000-0000-000000000000/status`, {
            headers: authHeaders(),
        });
        expect(res.status).toBe(404);
    });

    it('returns completed for text file', async () => {
        const tmpPath = join(FIXTURES, 'test-status.txt');
        const { writeFileSync } = await import('fs');
        writeFileSync(tmpPath, 'Status test content.');

        const blob = await uploadBlob(tmpPath, 'text/plain');
        const res = await fetch(`${API}/blobs/${blob.id}/status`, {
            headers: authHeaders(),
        });

        expect(res.ok).toBe(true);
        const { status } = await res.json() as { status: string };
        expect(status).toBe('completed');
    });
});
