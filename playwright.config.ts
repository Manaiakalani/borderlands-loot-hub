import { defineConfig } from '@playwright/test';
import { BASE_URL, PREVIEW_PORT } from './e2e/e2e-config.mjs';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  // Without an html reporter no playwright-report/ directory is produced, so the
  // CI "upload report on failure" step would always upload nothing.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    headless: true,
  },
  webServer: {
    // --strictPort so a foreign process holding the port fails the run instead of
    // Vite silently sliding to the next free one.
    command: `npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
    port: PREVIEW_PORT,
    // Never reuse: a preview server left behind by an unrelated Vite project
    // answered on the shared default port and produced a suite of false failures.
    reuseExistingServer: false,
    timeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
