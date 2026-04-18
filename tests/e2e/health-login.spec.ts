import { test, expect } from '@playwright/test';

/**
 * Health & Login E2E — verifies the app boots, the login page renders,
 * and demo authentication works end-to-end.
 */

test.describe('Health & Login', () => {
    test('frontend loads with correct title', async ({ page }) => {
        await page.goto('/');
        // Should redirect to login or show the app
        await expect(page).toHaveTitle(/Surdej|Login/i);
    });

    test('login page renders demo login button', async ({ page }) => {
        await page.goto('/login');
        await expect(page.locator('text=Demo')).toBeVisible({ timeout: 10_000 });
    });

    test('demo login authenticates and redirects to home', async ({ page }) => {
        await page.goto('/login');

        // Click demo login
        const demoButton = page.getByRole('button', { name: /demo/i });
        await expect(demoButton).toBeVisible({ timeout: 10_000 });
        await demoButton.click();

        // Should redirect to home page
        await page.waitForURL('**/home**', { timeout: 15_000 });
        await expect(page).toHaveURL(/home/);
    });

    test('API health endpoint returns ok', async ({ request }) => {
        const res = await request.get('http://localhost:5001/api/health');
        expect(res.ok()).toBeTruthy();

        const body = await res.json();
        expect(body.status).toBe('ok');
    });
});
