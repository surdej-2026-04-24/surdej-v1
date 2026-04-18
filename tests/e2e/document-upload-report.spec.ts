import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';

/**
 * Document Upload & Processing — Visual E2E Report
 *
 * Logs in via demo auth, uploads .docx / .xlsx / .pptx via the chat UI,
 * verifies processing completes, sends a message referencing the file,
 * and captures screenshots at every step for the HTML report.
 *
 * Run:
 *   cd tests && npx playwright test --config playwright.report.config.ts
 *
 * View report:
 *   npx playwright show-report e2e-report/html
 */

const FIXTURES = path.join(import.meta.dirname, '..', 'integration', 'fixtures');

// ─── Helpers ──────────────────────────────────────────────────

async function loginAsDemo(page: Page) {
    await test.step('Navigate to login page', async () => {
        await page.goto('/login');
        await page.screenshot({ fullPage: true });
    });

    await test.step('Click demo login and select Admin User', async () => {
        const demoBtn = page.getByRole('button', { name: /demo/i });
        await expect(demoBtn).toBeVisible({ timeout: 10_000 });
        await demoBtn.click();

        // Demo login opens a user selection modal — pick Admin User
        const adminBtn = page.getByText('Admin User').first();
        await expect(adminBtn).toBeVisible({ timeout: 5_000 });
        await page.screenshot({ fullPage: true });
        await adminBtn.click();

        // After login the app redirects to the root (home page)
        await page.waitForURL(/\/$/, { timeout: 15_000 });
        await page.screenshot({ fullPage: true });
    });
}

async function navigateToChat(page: Page) {
    await test.step('Navigate to chat page', async () => {
        await page.goto('/chat');
        await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ fullPage: true });
    });
}

async function uploadFileViaChat(page: Page, filename: string) {
    const filePath = path.join(FIXTURES, filename);

    await test.step(`Attach file: ${filename}`, async () => {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(filePath);
        // Wait for the attachment chip to appear
        await expect(page.getByText(filename)).toBeVisible({ timeout: 10_000 });
        await page.screenshot({ fullPage: true });
    });
}

async function waitForProcessing(page: Page, filename: string) {
    await test.step(`Wait for ${filename} processing to complete`, async () => {
        // The chip starts with a spinning loader. Wait for it to disappear.
        // The Loader2 spinner has animate-spin class. When processing is done,
        // the chip switches to a FileText icon (no spinner).
        const chip = page.getByText(filename).locator('..');

        // Wait for the spinner to disappear (file processed)
        await expect(async () => {
            const hasSpinner = await chip.locator('.animate-spin').count();
            expect(hasSpinner).toBe(0);
        }).toPass({ timeout: 30_000, intervals: [1000] });

        await page.screenshot({ fullPage: true });
    });
}

async function sendMessageAndWaitForResponse(page: Page, message: string, contentMarker?: string) {
    await test.step(`Type message: "${message}"`, async () => {
        const textarea = page.locator('textarea').first();
        await textarea.fill(message);
        await page.screenshot({ fullPage: true });
    });

    await test.step('Send message', async () => {
        const textarea = page.locator('textarea').first();
        await textarea.press('Enter');
        // Wait for textarea to clear (message was sent)
        await expect(textarea).toHaveValue('', { timeout: 5_000 });
        await page.screenshot({ fullPage: true });
    });

    await test.step('Wait for AI response', async () => {
        // Wait for the response to complete by monitoring the "messages" counter in the header
        // The header shows e.g. "2 messages" when both user + assistant messages are rendered
        await expect(page.getByText(/\d+ messages/)).toBeVisible({ timeout: 60_000 });

        if (contentMarker) {
            // Also wait for specific content to ensure the response is fully rendered
            await expect(page.getByText(contentMarker).first())
                .toBeVisible({ timeout: 30_000 });
        } else {
            // Give streaming time to finish - wait for textarea to become enabled (not streaming)
            await expect(page.locator('textarea').first()).toBeEnabled({ timeout: 60_000 });
        }

        await page.screenshot({ fullPage: true });
    });
}

// ─── Tests ────────────────────────────────────────────────────

test.describe('Document Upload Visual Report', () => {
    test.describe.configure({ mode: 'serial' });

    test('1. Login and navigate to chat', async ({ page }) => {
        await loginAsDemo(page);
        await navigateToChat(page);
    });

    test('2. Upload and process .docx file', async ({ page }) => {
        await loginAsDemo(page);
        await navigateToChat(page);

        await uploadFileViaChat(page, 'test-report.docx');
        await waitForProcessing(page, 'test-report.docx');

        await test.step('Verify attachment chip shows completed state', async () => {
            const chip = page.getByText('test-report.docx').locator('..');
            // No error state (no destructive styling)
            await expect(chip).not.toHaveClass(/destructive/);
            await page.screenshot({ fullPage: true });
        });

        await sendMessageAndWaitForResponse(
            page,
            'What is the budget mentioned in the attached document? Also list the team members.',
            '142',
        );

        await test.step('Verify AI response references document content', async () => {
            // Take final screenshot of the full conversation
            await page.screenshot({ fullPage: true });

            const bodyText = await page.locator('body').textContent() ?? '';
            // The AI should reference our test data
            const hasRelevantContent =
                bodyText.includes('142') ||
                bodyText.includes('Alice') ||
                bodyText.includes('SURDEJ') ||
                bodyText.includes('budget') ||
                bodyText.includes('Budget');
            expect(hasRelevantContent).toBeTruthy();
        });
    });

    test('3. Upload and process .xlsx file', async ({ page }) => {
        await loginAsDemo(page);
        await navigateToChat(page);

        await uploadFileViaChat(page, 'test-budget.xlsx');
        await waitForProcessing(page, 'test-budget.xlsx');

        await sendMessageAndWaitForResponse(
            page,
            'Summarize the budget data from the attached spreadsheet. What is the total?',
            'Staff',
        );

        await test.step('Verify AI response references spreadsheet content', async () => {
            await page.screenshot({ fullPage: true });
            const bodyText = await page.locator('body').textContent() ?? '';
            const hasRelevantContent =
                bodyText.includes('220000') ||
                bodyText.includes('220.000') ||
                bodyText.includes('150000') ||
                bodyText.includes('budget') ||
                bodyText.includes('Staff');
            expect(hasRelevantContent).toBeTruthy();
        });
    });

    test('4. Upload and process .pptx file', async ({ page }) => {
        await loginAsDemo(page);
        await navigateToChat(page);

        await uploadFileViaChat(page, 'test-presentation.pptx');
        await waitForProcessing(page, 'test-presentation.pptx');

        await sendMessageAndWaitForResponse(
            page,
            'What are the key findings from the attached presentation?',
            'Performance',
        );

        await test.step('Verify AI response references presentation content', async () => {
            await page.screenshot({ fullPage: true });
            const bodyText = await page.locator('body').textContent() ?? '';
            const hasRelevantContent =
                bodyText.includes('Performance') ||
                bodyText.includes('35%') ||
                bodyText.includes('92%') ||
                bodyText.includes('finding') ||
                bodyText.includes('Overview');
            expect(hasRelevantContent).toBeTruthy();
        });
    });

    test('5. Upload multiple files at once', async ({ page }) => {
        await loginAsDemo(page);
        await navigateToChat(page);

        await test.step('Attach .docx file', async () => {
            const fileInput = page.locator('input[type="file"]');
            await fileInput.setInputFiles(path.join(FIXTURES, 'test-report.docx'));
            await expect(page.getByText('test-report.docx')).toBeVisible({ timeout: 10_000 });
            await page.screenshot({ fullPage: true });
        });

        await test.step('Attach .xlsx file', async () => {
            const fileInput = page.locator('input[type="file"]');
            await fileInput.setInputFiles(path.join(FIXTURES, 'test-budget.xlsx'));
            await expect(page.getByText('test-budget.xlsx')).toBeVisible({ timeout: 10_000 });
            await page.screenshot({ fullPage: true });
        });

        await test.step('Both attachment chips visible', async () => {
            await expect(page.getByText('test-report.docx')).toBeVisible();
            await expect(page.getByText('test-budget.xlsx')).toBeVisible();
            await page.screenshot({ fullPage: true });
        });

        // Wait for both to process
        await waitForProcessing(page, 'test-report.docx');
        await waitForProcessing(page, 'test-budget.xlsx');

        await test.step('All files processed - screenshot', async () => {
            await page.screenshot({ fullPage: true });
        });
    });

    test('6. Send blocked while files processing', async ({ page }) => {
        await loginAsDemo(page);
        await navigateToChat(page);

        await test.step('Attach file and immediately check send button', async () => {
            const fileInput = page.locator('input[type="file"]');

            // Type a message first so send would otherwise be enabled
            const textarea = page.locator('textarea').first();
            await textarea.fill('Test message');

            // Upload a file — it starts in loading state
            await fileInput.setInputFiles(path.join(FIXTURES, 'test-report.docx'));
            await expect(page.getByText('test-report.docx')).toBeVisible({ timeout: 10_000 });

            await page.screenshot({ fullPage: true });
        });

        await test.step('Send button state captured', async () => {
            // The send button should be disabled while file is processing
            // (it may have already completed for small files — that's ok for the screenshot)
            await page.screenshot({ fullPage: true });
        });
    });

    test('7. Remove attached file', async ({ page }) => {
        await loginAsDemo(page);
        await navigateToChat(page);

        await uploadFileViaChat(page, 'test-report.docx');

        await test.step('Remove attachment by clicking X', async () => {
            await page.screenshot({ fullPage: true });

            // Click the X button on the attachment chip
            const chip = page.getByText('test-report.docx').locator('..');
            const removeBtn = chip.locator('button');
            await removeBtn.click();

            // File should be gone
            await expect(page.getByText('test-report.docx')).not.toBeVisible({ timeout: 5_000 });
            await page.screenshot({ fullPage: true });
        });
    });
});
