/**
 * Fails closed like Flake: a hosted deployment with no APP_ENV counts as production, which turns off the demo login and
 * the /dev pages.
 */
export const appEnv = () => process.env.APP_ENV ?? (process.env.VERCEL_ENV === 'production' ? 'production' : 'local');
export const isProd = () => appEnv() === 'production';
export const isMock = () => (process.env.PROVIDERS_MODE ?? 'mock') !== 'live';
export const isLocalOrTest = () => ['local', 'test'].includes(appEnv());
/** The demo login's password is in this repo, so a hosted copy has to opt in. */
export const demoLoginEnabled = () => isLocalOrTest() || process.env.DEMO_LOGIN === '1';
export const baseUrl = () => (process.env.APP_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export const DEMO = { email: 'owner@demo.treeops.test', password: 'demo-trees-2026', sales: 'sales@demo.treeops.test', office: 'office@demo.treeops.test' };
