// Runs the Supabase CLI against packages/db. Uses SUPABASE_CLI if set, else the copy installed in a Flake checkout next
// to this repo (no new package install), else `npx supabase`.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const flakeCli = join(root, '..', 'flake', 'node_modules', '.pnpm', 'supabase@2.122.0', 'node_modules', 'supabase', 'dist', 'supabase.js');
const args = [...process.argv.slice(2), '--workdir', join(root, 'packages', 'db')];
let cmd, full;
if (process.env.SUPABASE_CLI) [cmd, full] = [process.env.SUPABASE_CLI, args];
else if (existsSync(flakeCli)) [cmd, full] = [process.execPath, [flakeCli, ...args]];
else [cmd, full] = ['npx', ['supabase', ...args]];
const out = spawnSync(cmd, full, { stdio: process.env.SUPABASE_QUIET ? 'pipe' : 'inherit', encoding: 'utf8', shell: cmd === 'npx' });
if (process.env.SUPABASE_QUIET) process.stdout.write(out.stdout ?? '');
process.exit(out.status ?? 1);
