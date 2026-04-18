import { defineConfig, devices } from '@playwright/test';

/**
 * Surdej UI Smoke Test Configuration
 *
 * Lightweight headless tests for critical user flows:
 *   - Login page renders
 *   - Demo login authenticates
 *   - Home page loads after login
 *
 * Usage:
 *   npx playwright test --config playwright.smoke.config.ts
 *
 * Override target URL:
 *   BASE_URL=https://localhost:4001 npx playwright test --config playwright.smoke.config.ts
 */
export default defineConfig({
    testDir: './smoke',
    fullyParallel: false,           // Sequential — login must happen before home
    forbidOnly: !!process.env.CI,
    retries: 1,
    workers: 1,
    timeout: 30_000,

    reporter: [
        ['list'],
        ['html', { outputFolder: 'smoke-ui/report', open: 'never' }],
    ],

    outputDir: 'smoke-ui/results',

    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:4001',
        headless: true,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'smoke-chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
