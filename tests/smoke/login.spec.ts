import { test, expect } from '@playwright/test';

/**
 * Smoke Test: Login Page
 *
 * Verifies:
 * 1. The login page loads and renders the sign-in card
 * 2. The Microsoft sign-in button is visible
 * 3. Demo login dialog opens (dev mode only)
 */

test.describe('Login Page', () => {
    test('login page loads and shows sign-in card', async ({ page }) => {
        await page.goto('/login');

        // The login card should be visible
        const card = page.locator('.max-w-md');
        await expect(card).toBeVisible({ timeout: 10_000 });

        // Should show the sign-in title (either "Sign In" or tenant name)
        const title = page.locator('h2, [class*="CardTitle"]').first();
        await expect(title).toBeVisible({ timeout: 5_000 });
    });

    test('Microsoft sign-in button is visible', async ({ page }) => {
        await page.goto('/login');

        const msButton = page.getByRole('button', { name: /microsoft/i });
        await expect(msButton).toBeVisible({ timeout: 10_000 });
    });

    test('demo login dialog opens and lists users', async ({ page }) => {
        // Demo mode is only available in dev mode
        if (process.env.SMOKE_SKIP_DEMO === 'true') {
            test.skip();
            return;
        }

        await page.goto('/login');

        // Click the "Demo mode" link at the bottom
        const demoLink = page.getByText(/demo/i).first();
        await expect(demoLink).toBeVisible({ timeout: 10_000 });
        await demoLink.click();

        // The demo dialog should appear with user options
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 5_000 });

        // Should list at least 1 demo user (Admin User)
        const adminButton = dialog.getByText(/admin/i).first();
        await expect(adminButton).toBeVisible({ timeout: 5_000 });
    });
});
