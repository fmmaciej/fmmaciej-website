const { defineConfig, devices } = require('@playwright/test');

const isCI = Boolean(process.env.CI);
const baseURL = 'http://127.0.0.1:8080';

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  outputDir: 'test-results',
  use: {
    baseURL,
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run dev -- --port=8080 --quiet',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe'
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
      metadata: { formFactor: 'desktop' }
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
      metadata: { formFactor: 'mobile' }
    },
    {
      name: 'webkit-iphone',
      use: { ...devices['iPhone 16 Pro'] },
      metadata: { formFactor: 'mobile' }
    }
  ]
});
