import { createProviders, type Providers } from '@treeops/providers';
import { appEnv, baseUrl, isMock } from './env';

let cached: Providers | null = null;
export function providers(): Providers {
  cached ??= createProviders({ mode: isMock() ? 'mock' : 'live', appEnv: appEnv(), env: process.env, baseUrl: baseUrl() });
  return cached;
}
