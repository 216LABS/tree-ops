import Stripe from 'stripe';
import { localParts } from '@treeops/core/equipment';
import type { WeatherHour } from '@treeops/core/weather';
import { safeEqual, signTwilio } from './mock';
import type { PaymentsProvider, SmsProvider, WebhookEvent, WeatherProvider } from './types';

/** Twilio over fetch. One platform account and a shared sender for the pilot (the same call Flake made). [T] */
export class LiveSms implements SmsProvider {
  mock = false;
  constructor(private sid: string, private token: string, private defaultFrom: string | null) {}
  async send(msg: { from: string | null; to: string; body: string }) {
    const from = msg.from ?? this.defaultFrom;
    if (!from) throw new Error('No sending number is set up');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: msg.to, From: from, Body: msg.body }),
    });
    const body = (await res.json()) as { sid?: string; status?: string; message?: string; code?: number };
    if (!res.ok) throw Object.assign(new Error(`Twilio ${res.status}: ${body.message ?? 'failed'}`), { permanent: [21211, 21214, 21610, 21612, 21614].includes(Number(body.code)) });
    return { id: body.sid!, status: body.status ?? 'queued' };
  }
  verifyWebhook(url: string, params: Record<string, string>, signature: string | null) {
    return Boolean(signature) && safeEqual(signature!, signTwilio(this.token, url, params));
  }
}

/** Stripe Connect: the company's own account takes the money, with an application fee (docs/SPEC.md section 14). [T] */
export class LivePayments implements PaymentsProvider {
  mock = false;
  private stripe: Stripe;
  constructor(key: string, private webhookSecrets: string[]) {
    this.stripe = new Stripe(key);
  }
  async createConnectedAccount(input: { businessName: string; tenantId: string }) {
    const a = await this.stripe.accounts.create({
      business_profile: { name: input.businessName },
      metadata: { tenant_id: input.tenantId },
      controller: { fees: { payer: 'account' }, losses: { payments: 'stripe' }, stripe_dashboard: { type: 'express' } },
    });
    return { accountId: a.id };
  }
  async createAccountLink(accountId: string, returnUrl: string, refreshUrl: string) {
    const l = await this.stripe.accountLinks.create({ account: accountId, return_url: returnUrl, refresh_url: refreshUrl, type: 'account_onboarding' });
    return { url: l.url };
  }
  async chargesEnabled(accountId: string) {
    return Boolean((await this.stripe.accounts.retrieve(accountId)).charges_enabled);
  }
  async createCheckout(accountId: string, input: { amountCents: number; feeCents: number; description: string; successUrl: string; cancelUrl: string; metadata: Record<string, string>; idempotencyKey: string }) {
    const s = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: input.amountCents, product_data: { name: input.description } } }],
        payment_intent_data: { application_fee_amount: input.feeCents || undefined, metadata: input.metadata },
        metadata: input.metadata,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
      { stripeAccount: accountId, idempotencyKey: input.idempotencyKey },
    );
    return { id: s.id, url: s.url! };
  }
  verifyWebhook(rawBody: string, signature: string | null): WebhookEvent {
    for (const secret of this.webhookSecrets) {
      try {
        return this.stripe.webhooks.constructEvent(rawBody, signature ?? '', secret) as unknown as WebhookEvent;
      } catch {
        /* try the next endpoint secret */
      }
    }
    throw Object.assign(new Error('Bad signature'), { status: 400 });
  }
}

/**
 * NWS gridpoint forecast (docs/SPEC.md section 14): points -> forecastGridData, then the layers windGust,
 * probabilityOfThunder, quantitativePrecipitation and apparentTemperature, whose values are ISO 8601 intervals. Units
 * come from each layer's uom and are converted here. A layer that's missing stays null for every hour.
 */
export class NwsWeather implements WeatherProvider {
  mock = false;
  constructor(private userAgent: string) {}
  private async get(url: string) {
    const res = await fetch(url, { headers: { 'User-Agent': this.userAgent, Accept: 'application/geo+json' } });
    if (!res.ok) throw new Error(`NWS ${res.status} for ${url}`);
    return res.text();
  }
  async day(lat: number, lon: number, day: string, timeZone: string) {
    const points = JSON.parse(await this.get(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`)) as { properties?: { forecastGridData?: string } };
    const gridUrl = points.properties?.forecastGridData;
    if (!gridUrl) return null;
    const raw = await this.get(gridUrl);
    const grid = JSON.parse(raw) as { properties: Record<string, { uom?: string; values?: { validTime: string; value: number | null }[] }> };
    const hours = new Map<string, WeatherHour>();
    const slot = (at: Date) => {
      const p = localParts(at, timeZone);
      if (p.day !== day) return null;
      const key = at.toISOString().slice(0, 13);
      if (!hours.has(key)) hours.set(key, { t: `${key}:00:00.000Z`, hour: p.hour, gust_mph: null, thunder_pct: null, precip_in: null, apparent_f: null });
      return hours.get(key)!;
    };
    const layer = (name: string, set: (h: WeatherHour, v: number, perHourShare: number) => void, convert: (v: number, uom: string) => number) => {
      const l = grid.properties[name];
      for (const v of l?.values ?? []) {
        if (v.value === null) continue;
        const [startText, dur] = v.validTime.split('/');
        const n = durationHours(dur ?? 'PT1H');
        const start = new Date(startText!);
        for (let i = 0; i < n; i++) {
          const h = slot(new Date(+start + i * 3_600_000));
          if (h) set(h, convert(v.value, l?.uom ?? ''), 1 / n);
        }
      }
    };
    layer('windGust', (h, v) => (h.gust_mph = round1(v)), (v, u) => (u.includes('km_h') ? v * 0.621371 : u.includes('m_s') ? v * 2.23694 : v));
    layer('probabilityOfThunder', (h, v) => (h.thunder_pct = v), (v) => v);
    layer('quantitativePrecipitation', (h, v, share) => (h.precip_in = round2((h.precip_in ?? 0) + v * share)), (v, u) => (u.includes('mm') ? v / 25.4 : v));
    layer('apparentTemperature', (h, v) => (h.apparent_f = Math.round(v)), (v, u) => (u.includes('degC') ? (v * 9) / 5 + 32 : v));
    const list = [...hours.values()].sort((a, b) => a.t.localeCompare(b.t));
    return list.length ? { source: 'nws_gridpoints', url: gridUrl, raw, hours: list } : null;
  }
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** "PT3H" / "P1DT6H" to whole hours (at least 1). */
export function durationHours(d: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(d);
  if (!m) return 1;
  return Math.max(1, Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0) + (Number(m[3] ?? 0) >= 30 ? 1 : 0));
}
