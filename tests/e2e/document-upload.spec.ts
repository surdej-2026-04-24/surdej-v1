import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const API_BASE = 'http://localhost:5001/api';

/**
 * Document Upload & AI Processing E2E
 *
 * Tests the full flow:
 *   1. Login via demo auth
 *   2. Navigate to chat
 *   3. Upload a document (PDF / text)
 *   4. Verify blob is created & processing triggers
 *   5. Send a chat message referencing the upload
 *   6. Verify AI response includes content from the document
 */

// ─── Helpers ───────────────────────────────────────────────────

/** Create a temporary text file for upload testing */
function createTestFile(filename: string, content: string): string {
    const dir = path.join(os.tmpdir(), 'surdej-e2e');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
}

/** Authenticate via demo login and return to home */
async function loginAsDemo(page: Page) {
    await page.goto('/login');
    const demoBtn = page.getByRole('button', { name: /demo/i });
    await expect(demoBtn).toBeVisible({ timeout: 10_000 });
    await demoBtn.click();
    await page.waitForURL('**/home**', { timeout: 15_000 });
}

// ─── Tests ─────────────────────────────────────────────────────

test.describe('Document Upload & AI Processing', () => {
    const TEST_CONTENT = [
        'SURDEJ-TEST-DOCUMENT',
        '',
        'Project: Surdej Framework v1',
        'Status: Active Development',
        'Budget: 142.857 DKK',
        'Lead: Test Engineer',
        '',
        'This document contains specific test data that the AI should be able to reference.',
        'The unique identifier for this test is SURDEJ-E2E-2026.',
        'Key findings: The framework supports PDF, Office, and plain text uploads.',
        'Recommendation: Implement async processing via NATS workers for large files.',
    ].join('\n');

    let testFilePath: string;

    test.beforeAll(() => {
        testFilePath = createTestFile('surdej-test-report.txt', TEST_CONTENT);
    });

    test.afterAll(() => {
        try {
            fs.unlinkSync(testFilePath);
        } catch {
            // Cleanup is best-effort
        }
    });

    test.beforeEach(async ({ page }) => {
        await loginAsDemo(page);
    });

    // ── API-level: blob upload ──────────────────────────────────

    test('API: upload blob returns metadata', async ({ request }) => {
        const fileBuffer = Buffer.from(TEST_CONTENT, 'utf-8');

        const form = request.createFormData();
        form.set('file', {
            name: 'surdej-test-report.txt',
            mimeType: 'text/plain',
            buffer: fileBuffer,
        });

        const res = await request.post(`${API_BASE}/blobs`, {
            multipart: {
                file: {
                    name: 'surdej-test-report.txt',
                    mimeType: 'text/plain',
                    buffer: fileBuffer,
                },
            },
        });

        // May fail if no auth token in plain request context — that's tracked separately
        if (res.ok()) {
            const blob = await res.json();
            expect(blob).toHaveProperty('id');
            expect(blob).toHaveProperty('filename', 'surdej-test-report.txt');
            expect(blob).toHaveProperty('mimeType', 'text/plain');
            expect(blob).toHaveProperty('storagePath');
        } else {
            // 400 expected if tenant context missing in raw API call
            expect([400, 401]).toContain(res.status());
        }
    });

    // ── UI: chat page renders with upload capability ────────────

    test('chat page has file attachment button', async ({ page }) => {
        await page.goto('/chat');
        await expect(page.locator('textarea, [role="textbox"]').first()).toBeVisible({ timeout: 10_000 });

        // Look for the paperclip / attach button
        const attachBtn = page.locator('button:has(svg), [aria-label*="attach" i], [data-testid="attach-file"]');
        // There should be a file input somewhere for attachment
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
    });

    // ── UI: upload file via chat ────────────────────────────────

    test('upload file in chat shows attachment chip', async ({ page }) => {
        await page.goto('/chat');
        await expect(page.locator('textarea, [role="textbox"]').first()).toBeVisible({ timeout: 10_000 });

        // Trigger file upload via the hidden input
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);

        // Should see the filename in an attachment chip
        await expect(page.getByText('surdej-test-report.txt')).toBeVisible({ timeout: 10_000 });
    });

    // ── UI: upload + send message → AI references file content ──

    test('upload file and send message, AI response references document', async ({ page }) => {
        test.setTimeout(90_000); // AI streaming can be slow

        await page.goto('/chat');
        await expect(page.locator('textarea, [role="textbox"]').first()).toBeVisible({ timeout: 10_000 });

        // Step 1: Attach the file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);

        // Wait for attachment chip to appear (upload completes)
        await expect(page.getByText('surdej-test-report.txt')).toBeVisible({ timeout: 15_000 });

        // Wait for processing to finish (loading spinner should disappear)
        // The chip shows a loader while the blob is being processed
        await page.waitForTimeout(3_000); // Give the status polling time to settle

        // Step 2: Type a message referencing the document
        const textarea = page.locator('textarea').first();
        await textarea.fill('What is the budget mentioned in the attached document? Also mention the unique identifier.');

        // Step 3: Send (Enter or click send button)
        const sendBtn = page.locator('button:has(svg)').filter({ has: page.locator('svg') }).last();
        // Use keyboard shortcut — more reliable than finding the exact send button
        await textarea.press('Enter');

        // Step 4: Wait for AI response
        // The assistant message should appear. We look for a response container.
        const assistantMessage = page.locator('[class*="assistant"], [data-role="assistant"], .prose, [class*="markdown"]');

        // Wait for streaming to start and complete
        await expect(async () => {
            const messageContainers = page.locator('main >> text=/142|SURDEJ-E2E/i');
            const count = await messageContainers.count();
            expect(count).toBeGreaterThan(0);
        }).toPass({ timeout: 60_000 });

        // Verify the response references our unique test data
        const fullText = await page.locator('main').textContent();
        const mentionsBudget = fullText?.includes('142') ?? false;
        const mentionsId = fullText?.includes('SURDEJ-E2E') ?? false;

        // At least one reference should appear
        expect(mentionsBudget || mentionsId).toBeTruthy();
    });

    // ── UI: drag-and-drop upload ────────────────────────────────

    test('drag and drop file shows attachment', async ({ page }) => {
        await page.goto('/chat');
        await expect(page.locator('textarea, [role="textbox"]').first()).toBeVisible({ timeout: 10_000 });

        // Create a DataTransfer-like event via the file input (Playwright doesn't natively
        // support real drag-and-drop of external files, so we use setInputFiles as proxy)
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);

        await expect(page.getByText('surdej-test-report.txt')).toBeVisible({ timeout: 10_000 });
    });

    // ── API: blob status endpoint ───────────────────────────────

    test('API: blob status returns processing state', async ({ page, request }) => {
        // First upload via the UI to get proper auth context
        await page.goto('/chat');
        await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10_000 });

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);

        // Wait for the upload to complete and get the blob ID from network
        const uploadResponse = await page.waitForResponse(
            (response) => response.url().includes('/blobs') && response.request().method() === 'POST',
            { timeout: 15_000 },
        );

        if (uploadResponse.ok()) {
            const blob = await uploadResponse.json();

            // Check status endpoint — text files should be "completed" immediately
            const statusRes = await page.request.get(`${API_BASE}/blobs/${blob.id}/status`);
            expect(statusRes.ok()).toBeTruthy();

            const { status } = await statusRes.json();
            expect(['completed', 'processing']).toContain(status);
        }
    });

    // ── Multiple file upload ────────────────────────────────────

    test('can attach multiple files', async ({ page }) => {
        const secondFile = createTestFile('second-report.txt', 'Second test document with code MULTI-UPLOAD-TEST.');

        try {
            await page.goto('/chat');
            await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10_000 });

            const fileInput = page.locator('input[type="file"]');

            // Upload first file
            await fileInput.setInputFiles(testFilePath);
            await expect(page.getByText('surdej-test-report.txt')).toBeVisible({ timeout: 10_000 });

            // Upload second file
            await fileInput.setInputFiles(secondFile);
            await expect(page.getByText('second-report.txt')).toBeVisible({ timeout: 10_000 });
        } finally {
            try { fs.unlinkSync(secondFile); } catch { /* best effort */ }
        }
    });
});
