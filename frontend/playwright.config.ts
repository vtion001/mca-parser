import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'cd /Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber && ./scripts/dev-all.sh',
    url: 'http://localhost:8000',
    reuseExistingServer: true,
    timeout: 120000,
  }
})