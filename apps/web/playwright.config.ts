import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), '.env.local');
const fromFile = existsSync(file)
  ? Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map((m) => [m![1]!, m![2]!]))
  : {};
const PORT = Number(process.env.E2E_PORT ?? 3200);
const env = { ...process.env, ...fromFile, APP_ENV: 'test', NEXT_PUBLIC_APP_ENV: 'test', PROVIDERS_MODE: 'mock', APP_BASE_URL: `http://localhost:${PORT}` } as Record<string, string>;
for (const [k, v] of Object.entries(env)) process.env[k] = v;

/**
 * Runs against next build + next start with mocks and the local Supabase (the same setup as Flake). Phone viewport in
 * Chromium for the flows, plus the crew's offline run in WebKit, the closest thing here to Safari on an iPhone.
 * Set E2E_REUSE=1 to test a server already running on the port.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-crew', testMatch: /crew-offline\.spec/, use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: process.env.E2E_REUSE ? 'echo reuse' : `pnpm build && pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 480_000,
    reuseExistingServer: Boolean(process.env.E2E_REUSE),
    env,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
