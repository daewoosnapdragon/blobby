import fs from 'node:fs';
import { defineConfig } from '@playwright/test';
import { E2E_DATABASE_URL, E2E_PORT, E2E_SESSION_SECRET } from './tests/e2e/fixtures/seed';

// The bundled browser build can mismatch this Playwright version; fall back to the preinstalled Chromium.
const chromium = process.env.PW_CHROMIUM_PATH ?? (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

// The webServer command resets + migrates + seeds the local wp_e2e_test database, then starts the app on it.
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: 'off',
    viewport: { width: 390, height: 844 },
    launchOptions: chromium ? { executablePath: chromium } : {},
  },
  webServer: {
    command: `npx tsx tests/e2e/setup-db.ts && npx next dev -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      E2E_DATABASE_URL,
      SESSION_SECRET: E2E_SESSION_SECRET,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
