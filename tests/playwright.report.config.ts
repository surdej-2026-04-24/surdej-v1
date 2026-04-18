import { defineConfig, devices } from '@playwright/test';

/**
 * Document Upload Visual Report — Playwright Config
 *
 * Captures screenshots at every step, records video of each test,
 * and traces all interactions for a rich HTML report.
 *
 * Usage:
 *   cd tests
 *   npx playwright test --config playwright.report.config.ts
 *
 * View report:
 *   npx playwright show-report e2e-report/html
 */
export default defineConfig({
    testDir: './e2e',
    testMatch: 'document-upload-report.spec.ts',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    timeout: 120_000,

    reporter: [
        ['list'],
        ['html', { outputFolder: 'e2e-report/html', open: 'never' }],
    ],

    outputDir: 'e2e-report/results',

    use: {
        baseURL: 'http://localhost:4001',

        // Capture everything for the visual report
        screenshot: 'on',
        video: 'on',
        trace: 'on',

        // Viewport
        viewport: { width: 1440, height: 900 },
    },

    projects: [
        {
            name: 'report-chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
