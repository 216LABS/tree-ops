import { execFileSync } from 'node:child_process';

/** A fresh demo company before every run, so each test starts from the same data. */
export default function globalSetup() {
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/seed-demo.ts'], { stdio: 'inherit', env: process.env });
}
