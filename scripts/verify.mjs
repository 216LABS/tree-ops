// pnpm verify: typecheck, unit, RLS, integration, build, end-to-end. Stops at the first failure.
import { execSync } from 'node:child_process';

const steps = [
  ['typecheck', 'pnpm -r --parallel exec tsc --noEmit'],
  ['unit (core)', 'pnpm --filter @treeops/core test:unit'],
  ['unit (providers)', 'pnpm --filter @treeops/providers test:unit'],
  ['row level security', 'pnpm --filter @treeops/db test:db'],
  ['integration', 'pnpm --filter @treeops/web test:integration'],
  ['end to end (builds, then serves on :3200)', 'pnpm --filter @treeops/web test:e2e'],
];
for (const [name, cmd] of steps) {
  console.log(`\n=== ${name} ===`);
  execSync(cmd, { stdio: 'inherit' });
}
console.log('\nAll green.');
