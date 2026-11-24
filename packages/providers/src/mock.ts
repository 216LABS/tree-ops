import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { localParts, zonedToUtc } from '@treeops/core/equipment';
import type { WeatherHour } from '@treeops/core/weather';
import type { PaymentsProvider, SmsProvider, WebhookEvent, WeatherProvider } from './types';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/** Mock texts: nothing leaves the machine. The app records each one in `messages` with status mock_sent. */
export class MockSms implements SmsProvider {
  mock = true;
  async send(msg: { to: string; body: string }) {
    return { id: `SM_mock_${hash(msg.to + msg.body).slice(0, 16)}`, status: 'mock_sent' };
  }
  verifyWebhook(url: string, params: Record<string, string>, signature: string | null) {
    return signature === signTwilio('mock', url, params);
  }
}

/** Twilio's documented scheme: HMAC-SHA1 over the URL plus sorted params, base64. */
export function signTwilio(authToken: string, url: string, params: Record<string, string>) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  return createHmac('sha1', authToken).update(data).digest('base64');
}
export const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Mock payments. A checkout sends the payer to /dev/pay/<id>, where "Pay" posts a signed fake webhook. The signature is
 * an HMAC with a fixed local key, so the webhook route runs the same verification path as live.
 */
export class MockPayments implements PaymentsProvider {
  mock = true;
  constructor(private baseUrl: string) {}
  async createConnectedAccount(input: { tenantId: string }) {
    return { accountId: `acct_mock_${input.tenantId.slice(0, 8)}` };
  }
  async createAccountLink(accountId: string, returnUrl: string) {
    return { url: `${this.baseUrl}/dev/stripe-onboard?account=${accountId}&return=${encodeURIComponent(returnUrl)}` };
  }
  async chargesEnabled() {
    return true;
  }
  async createCheckout(_accountId: string, input: { amountCents: number; feeCents: number; description: string; successUrl: string; metadata: Record<string, string>; idempotencyKey: string }) {
    const id = `cs_mock_${hash(input.idempotencyKey).slice(0, 20)}`;
    const q = new URLSearchParams({ amount: String(input.amountCents), fee: String(input.feeCents), desc: input.description, success: input.successUrl, meta: JSON.stringify(input.metadata) });
    return { id, url: `${this.baseUrl}/dev/pay/${id}?${q}` };
  }
  verifyWebhook(rawBody: string, signature: string | null): WebhookEvent {
    if (!signature || !safeEqual(signature, mockStripeSignature(rawBody))) throw Object.assign(new Error('Bad signature'), { status: 400 });
    return JSON.parse(rawBody) as WebhookEvent;
  }
}
export const mockStripeSignature = (rawBody: string) => createHmac('sha256', 'tree-ops-mock-stripe').update(rawBody).digest('hex');

/**
 * Deterministic synthetic weather, seeded by place and date, clearly labeled "mock" wherever it shows. Some days are
 * windy or stormy on purpose so the flags can be seen in a demo.
 */
export class MockWeather implements WeatherProvider {
  mock = true;
  async day(lat: number, lon: number, day: string, timeZone: string) {
    const seed = parseInt(hash(`${lat.toFixed(2)},${lon.toFixed(2)},${day}`).slice(0, 8), 16);
    const kind = seed % 6; // 0 windy, 1 storms, 2 rain, 3 hot (summer only), else calm
    const month = Number(day.slice(5, 7));
    const start = zonedToUtc(day, '00:00', timeZone);
    const hours: WeatherHour[] = [];
    for (let h = 0; h < 24; h++) {
      const at = new Date(+start + h * 3_600_000);
      const wave = Math.sin(((h - 6) / 24) * Math.PI * 2);
      const r = ((seed >> (h % 24)) & 7) / 7;
      const base = month >= 6 && month <= 8 ? 82 : month >= 4 && month <= 9 ? 68 : 40;
      hours.push({
        t: at.toISOString(),
        hour: localParts(at, timeZone).hour,
        gust_mph: Math.round((kind === 0 ? 24 + 10 * r : 8 + 8 * r) * 10) / 10,
        thunder_pct: kind === 1 && h >= 12 && h <= 18 ? 40 + Math.round(30 * r) : Math.round(5 * r),
        precip_in: kind === 2 && h >= 9 && h <= 13 ? 0.12 : kind === 1 && h >= 13 && h <= 16 ? 0.05 : 0,
        apparent_f: Math.round(base + (kind === 3 && month >= 6 && month <= 8 ? 16 : 0) + 8 * wave),
      });
    }
    return { source: 'mock', url: null, raw: JSON.stringify(hours), hours };
  }
}
