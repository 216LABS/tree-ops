import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const file = resolve(import.meta.dirname, '.env.local');
const env = existsSync(file)
  ? Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map((m) => [m![1]!, m![2]!]))
  : {};

export default defineConfig({
  resolve: { alias: { '@': resolve(import.meta.dirname) } },
  test: { include: ['test/**/*.test.ts'], env: { ...env, APP_ENV: 'test', PROVIDERS_MODE: 'mock', APP_BASE_URL: 'http://localhost:3200' }, testTimeout: 60000, hookTimeout: 120000, pool: 'forks', fileParallelism: false },
});
