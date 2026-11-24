import type { WeatherHour } from '@treeops/core/weather';

/** Every third party sits behind one of these, with a deterministic mock (docs/SPEC.md section 14). */
export interface SmsProvider {
  mock: boolean;
  unconfigured?: boolean;
  send(msg: { from: string | null; to: string; body: string }): Promise<{ id: string; status: string }>;
  /** Validates X-Twilio-Signature against the full URL and form params. */
  verifyWebhook(url: string, params: Record<string, string>, signature: string | null): boolean;
}

export interface WebhookEvent { id: string; type: string; account?: string; data: { object: Record<string, any> } }

export interface PaymentsProvider {
  mock: boolean;
  unconfigured?: boolean;
  createConnectedAccount(input: { businessName: string; tenantId: string }): Promise<{ accountId: string }>;
  createAccountLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<{ url: string }>;
  chargesEnabled(accountId: string): Promise<boolean>;
  /** A hosted payment page on the company's own Stripe account, with the platform fee. */
  createCheckout(accountId: string, input: { amountCents: number; feeCents: number; description: string; successUrl: string; cancelUrl: string; metadata: Record<string, string>; idempotencyKey: string }): Promise<{ id: string; url: string }>;
  verifyWebhook(rawBody: string, signature: string | null): WebhookEvent;
}

export interface WeatherDay { source: string; url: string | null; raw: string; hours: WeatherHour[] }
export interface WeatherProvider {
  mock: boolean;
  /** The hours of `day` (local) at a point, or null when no forecast is available. Never invents values. */
  day(lat: number, lon: number, day: string, timeZone: string): Promise<WeatherDay | null>;
}

export interface Providers { mode: 'mock' | 'live'; sms: SmsProvider; payments: PaymentsProvider; weather: WeatherProvider }
