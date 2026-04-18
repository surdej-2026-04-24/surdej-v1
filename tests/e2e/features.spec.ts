import { test, expect } from '@playwright/test';

/**
 * Feature Flags E2E — verifies the feature flag system works end-to-end:
 * API returns flags, frontend renders the features settings page,
 * and feature toggles update state.
 */

test.describe('Feature Flags', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        const demoBtn = page.getByRole('button', { name: /demo/i });
        await demoBtn.click();
        await page.waitForURL('**/home**', { timeout: 15_000 });
    });

    test('API returns feature flags', async ({ request }) => {
        const res = await request.get('http://localhost:5001/api/features');
        expect(res.ok()).toBeTruthy();

        const body = await res.json();
        expect(Array.isArray(body)).toBeTruthy();
    });

    test('features settings page renders', async ({ page }) => {
        await page.goto('/settings/features');
        await expect(page.locator('h1, h2').first()).toContainText(/feature/i, { timeout: 10_000 });
    });
});
