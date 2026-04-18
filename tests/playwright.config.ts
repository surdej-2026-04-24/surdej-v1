import { defineConfig, devices } from '@playwright/test';

/**
 * Surdej E2E Test Configuration
 *
 * Runs against the local dev servers:
 *   - Frontend: http://localhost:4001
 *   - API:      http://localhost:5001
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? 'github' : 'html',
    timeout: 30_000,

    use: {
        baseURL: 'http://localhost:4001',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],

    /* Optionally start dev servers before tests */
    // webServer: [
    //     {
    //         command: 'pnpm dev',
    //         port: 4001,
    //         cwd: '../',
    //         reuseExistingServer: !process.env.CI,
    //     },
    // ],
});
