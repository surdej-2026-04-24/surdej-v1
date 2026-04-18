import { test, expect } from '@playwright/test';

/**
 * Smoke Test: Home Page (after demo login)
 *
 * Verifies:
 * 1. Demo login succeeds (admin@surdej.dev)
 * 2. Redirects to the home page
 * 3. Home page content renders
 */

test.describe('Home Page', () => {
    test.beforeEach(async ({ page }) => {
        // Skip demo login when running against production
        if (process.env.SMOKE_SKIP_DEMO === 'true') {
            test.skip();
            return;
        }

        // Perform demo login
        await page.goto('/login');

        // Click "Demo mode" link
        const demoLink = page.getByText(/demo/i).first();
        await expect(demoLink).toBeVisible({ timeout: 10_000 });
        await demoLink.click();

        // Wait for dialog and click the first demo user (Admin)
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 5_000 });

        const adminButton = dialog.getByRole('button', { name: /admin/i }).first();
        await expect(adminButton).toBeVisible({ timeout: 5_000 });
        await adminButton.click();

        // Wait for redirect to home
        await page.waitForURL('**/home**', { timeout: 15_000 });
    });

    test('home page loads after demo login', async ({ page }) => {
        if (process.env.SMOKE_SKIP_DEMO === 'true') {
            test.skip();
            return;
        }

        await expect(page).toHaveURL(/home/);
    });

    test('home page renders main content', async ({ page }) => {
        if (process.env.SMOKE_SKIP_DEMO === 'true') {
            test.skip();
            return;
        }

        // The page should have a visible main content area
        const main = page.locator('main, [role="main"], .flex-1').first();
        await expect(main).toBeVisible({ timeout: 10_000 });
    });

    test('navigation sidebar is visible', async ({ page }) => {
        if (process.env.SMOKE_SKIP_DEMO === 'true') {
            test.skip();
            return;
        }

        // After login, the sidebar/rail should be visible
        const nav = page.locator('nav, [role="navigation"], aside').first();
        await expect(nav).toBeVisible({ timeout: 10_000 });
    });
});
