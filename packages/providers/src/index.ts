import { LivePayments, LiveSms, NwsWeather } from './live';
import { MockPayments, MockSms, MockWeather } from './mock';
import type { PaymentsProvider, Providers, SmsProvider } from './types';

export * from './types';
export { MockPayments, MockSms, MockWeather, mockStripeSignature, signTwilio } from './mock';
export { durationHours, NwsWeather } from './live';

const unconfigured = <T extends object>(name: string, base: T): T =>
  new Proxy(base, {
    get(target, prop) {
      if (prop === 'unconfigured') return true;
      if (prop === 'mock') return false;
      const v = (target as Record<string | symbol, unknown>)[prop];
      return typeof v === 'function' ? () => Promise.reject(new Error(`${name} is not configured`)) : v;
    },
  });

/**
 * Mock mode needs no keys. Live mode uses each provider whose keys are present and refuses the rest. Weather is NOAA's
 * free public API, so it's live whenever the mode is live. Outside production real texts and live Stripe keys are
 * blocked even when present, like Flake.
 */
export function createProviders(opts: { mode: 'mock' | 'live'; appEnv: string; env: Record<string, string | undefined>; baseUrl: string }): Providers {
  const { env } = opts;
  if (opts.mode === 'mock') return { mode: 'mock', sms: new MockSms(), payments: new MockPayments(opts.baseUrl), weather: new MockWeather() };
  const prod = opts.appEnv === 'production';
  let sms: SmsProvider = unconfigured('Texting', new MockSms());
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) sms = prod ? new LiveSms(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM ?? null) : new MockSms();
  let payments: PaymentsProvider = unconfigured('Payments', new MockPayments(opts.baseUrl));
  if (env.STRIPE_SECRET_KEY) {
    const liveKey = env.STRIPE_SECRET_KEY.startsWith('sk_live_');
    if (liveKey && !prod) throw new Error('Live Stripe keys are blocked outside production');
    payments = new LivePayments(env.STRIPE_SECRET_KEY, (env.STRIPE_WEBHOOK_SECRET ?? '').split(',').filter(Boolean));
  }
  return { mode: 'live', sms, payments, weather: new NwsWeather(env.NWS_USER_AGENT ?? '(tree-ops)') };
}
