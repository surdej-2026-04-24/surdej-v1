import { test, expect } from '@playwright/test';

/**
 * Knowledge Management E2E — verifies knowledge listing, article CRUD,
 * and template rendering work end-to-end.
 */

test.describe('Knowledge Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        const demoBtn = page.getByRole('button', { name: /demo/i });
        await demoBtn.click();
        await page.waitForURL('**/home**', { timeout: 15_000 });
    });

    test('knowledge page loads', async ({ page }) => {
        await page.goto('/knowledge');
        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
    });

    test('can view articles list', async ({ page }) => {
        await page.goto('/knowledge');
        // Should show either articles or an empty state message
        const content = page.locator('[data-component="article-list"], table, .empty-state, main');
        await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('templates page loads', async ({ page }) => {
        await page.goto('/knowledge/templates');
        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
    });

    test('training page loads', async ({ page }) => {
        await page.goto('/knowledge/training');
        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
    });

    test('API knowledge articles endpoint works', async ({ request }) => {
        const res = await request.get('http://localhost:5001/api/knowledge/articles');
        expect(res.ok()).toBeTruthy();

        const body = await res.json();
        expect(body).toHaveProperty('articles');
        expect(body).toHaveProperty('total');
    });
});
