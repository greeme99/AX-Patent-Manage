import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'rm -f /tmp/patent-gate-e2e.db /tmp/patent-gate-e2e.db-shm /tmp/patent-gate-e2e.db-wal && DATABASE_URL=file:/tmp/patent-gate-e2e.db TURSO_AUTH_TOKEN=e2e-local-token DEMO_SESSION_SECRET=e2e-local-session-secret-at-least-32-characters npm run start -- --hostname 127.0.0.1 --port 3000',
    cwd: __dirname,
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 500 },
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
});
