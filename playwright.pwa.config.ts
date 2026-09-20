import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests-pwa',
  outputDir: './test-results/pwa',
  use: { baseURL: 'http://127.0.0.1:5190', browserName: 'chromium' },
  webServer: {
    command: 'npm run preview -- --port 5190 --strictPort',
    url: 'http://127.0.0.1:5190',
    reuseExistingServer: false,
  },
  reporter: 'list',
});
