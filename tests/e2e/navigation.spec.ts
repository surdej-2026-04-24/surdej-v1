import { test, expect } from '@playwright/test';

/**
 * Navigation & Sidebar E2E — verifies that authenticated users can navigate
 * the sidebar, command palette opens, and core pages are accessible.
 */

test.describe('Navigation & Sidebar', () => {
    test.beforeEach(async ({ page }) => {
        // Authenticate via demo login
        await page.goto('/login');
        const demoBtn = page.getByRole('button', { name: /demo/i });
        await demoBtn.click();
        await page.waitForURL('**/home**', { timeout: 15_000 });
    });

    test('sidebar is visible after login', async ({ page }) => {
        const sidebar = page.locator('[data-component="sidebar"], aside, nav');
        await expect(sidebar.first()).toBeVisible();
    });

    test('command palette opens with Cmd+K', async ({ page }) => {
        await page.keyboard.press('Meta+k');
        const palette = page.locator('[data-component="command-palette"], [role="dialog"]');
        await expect(palette.first()).toBeVisible({ timeout: 5_000 });
    });

    test('can navigate to settings', async ({ page }) => {
        // Try sidebar link or command palette
        const settingsLink = page.locator('a[href*="settings"], [data-command*="settings"]');
        if (await settingsLink.first().isVisible()) {
            await settingsLink.first().click();
        } else {
            await page.keyboard.press('Meta+k');
            await page.keyboard.type('Settings');
            await page.keyboard.press('Enter');
        }
        await expect(page).toHaveURL(/settings/, { timeout: 10_000 });
    });

    test('can navigate to knowledge', async ({ page }) => {
        const knowledgeLink = page.locator('a[href*="knowledge"], [data-command*="knowledge"]');
        if (await knowledgeLink.first().isVisible()) {
            await knowledgeLink.first().click();
        } else {
            await page.keyboard.press('Meta+k');
            await page.keyboard.type('Knowledge');
            await page.keyboard.press('Enter');
        }
        await expect(page).toHaveURL(/knowledge/, { timeout: 10_000 });
    });

    test('can navigate to topology', async ({ page }) => {
        const topoLink = page.locator('a[href*="topology"], [data-command*="topology"]');
        if (await topoLink.first().isVisible()) {
            await topoLink.first().click();
        } else {
            await page.keyboard.press('Meta+k');
            await page.keyboard.type('Topology');
            await page.keyboard.press('Enter');
        }
        await expect(page).toHaveURL(/topology/, { timeout: 10_000 });
    });
});
