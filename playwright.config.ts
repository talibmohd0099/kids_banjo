import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    launchOptions: {
      // Lets audio start without a real click in headless runs. Set PW_CHROMIUM to use a
      // preinstalled Chromium instead of Playwright's download.
      args: ['--autoplay-policy=no-user-gesture-required'],
      executablePath: process.env.PW_CHROMIUM || undefined,
    },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
  },
});
