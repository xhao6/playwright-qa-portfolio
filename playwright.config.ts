import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

export const ENV = {
  BASE_URL: process.env.BASE_URL || '',
  ADMIN_USER: process.env.ADMIN_USER || '',
  ADMIN_PASS: process.env.ADMIN_PASS || '',
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  timeout: 90_000,
  navigationTimeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['html', { open: 'never' }]],
  outputDir: 'test-results/',

  use: {
    baseURL: ENV.BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    storageState: 'playwright/.auth/user.json',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { storageState: { cookies: [], origins: [] } },
    },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], channel: 'chrome' },
      dependencies: ['setup'],
    },
    {
      name: 'webkit-smoke',
      use: { ...devices['Desktop Safari'] },
      testMatch: /smoke\/.*\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],
});