import { describe, expect, it } from 'vitest';
import { createProviders, durationHours, mockStripeSignature, MockWeather, signTwilio } from '../src/index';
import { renderBriefingForm, renderProofPacket, type ProofManifest } from '../src/pdf';

describe('providers', () => {
  it('mock mode needs no keys', () => {
    const p = createProviders({ mode: 'mock', appEnv: 'local', env: {}, baseUrl: 'http://x' });
    expect([p.sms.mock, p.payments.mock, p.weather.mock]).toEqual([true, true, true]);
  });
  it('live mode without keys refuses payments and texts, but has weather', async () => {
    const p = createProviders({ mode: 'live', appEnv: 'local', env: {}, baseUrl: 'http://x' });
    expect(p.payments.unconfigured).toBe(true);
    await expect(p.sms.send({ from: null, to: '+1', body: 'x' })).rejects.toThrow(/not configured/);
    expect(p.weather.mock).toBe(false);
  });
  it('live Stripe keys are blocked outside production', () => {
    expect(() => createProviders({ mode: 'live', appEnv: 'staging', env: { STRIPE_SECRET_KEY: 'sk_live_x' }, baseUrl: 'http://x' })).toThrow(/blocked/);
  });
  it('mock webhooks verify like live ones', () => {
    const p = createProviders({ mode: 'mock', appEnv: 'local', env: {}, baseUrl: 'http://x' });
    const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
    expect(p.payments.verifyWebhook(body, mockStripeSignature(body)).id).toBe('evt_1');
    expect(() => p.payments.verifyWebhook(body, 'nope')).toThrow();
    const params = { Body: 'STOP', From: '+1' };
    expect(p.sms.verifyWebhook('http://x/hook', params, signTwilio('mock', 'http://x/hook', params))).toBe(true);
  });
  it('mock weather is deterministic and covers every local hour', async () => {
    const w = new MockWeather();
    const a = await w.day(41.15, -81.36, '2026-05-04', 'America/New_York');
    const b = await w.day(41.15, -81.36, '2026-05-04', 'America/New_York');
    expect(a!.hours).toEqual(b!.hours);
    expect(a!.hours.map((h) => h.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });
  it('NWS durations', () => {
    expect([durationHours('PT1H'), durationHours('PT3H'), durationHours('P1DT6H'), durationHours('PT30M'), durationHours('junk')]).toEqual([1, 3, 30, 1, 1]);
  });
});

describe('pdf', () => {
  const manifest: ProofManifest = {
    version: 1, company: { name: 'Demo Tree' }, job: { id: 'j', number: 1001, status: 'done', created_at: '2026-05-01T12:00:00Z', closed_at: null },
    customer: { name: 'Pat' }, property: { address: '1 Oak', city: 'Kent', state_code: 'OH', lat: 41.1, lon: -81.3 },
    estimate: { number: 1001, approved_at: '2026-05-01T12:00:00Z', total_cents: 120000, options: [{ name: 'Base', included: true, lines: [{ id: 'l', kind: 'remove', description: 'Remove oak', qty: 1, unit: 'each', unit_price_cents: 120000, tree_number: 1 }] }] },
    signatures: [], trees: [], checks: [], job_days: [], briefings: [], work_log: [], confirmations: [], photos: [], change_orders: [], messages: [], corrections: [], weather: [],
  };
  it('renders a proof packet and the briefing forms', async () => {
    const pdf = await renderProofPacket({ manifest, hash: 'a'.repeat(64), generatedAt: new Date(), timeZone: 'America/New_York', images: new Map() });
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe('%PDF-');
    for (const locale of ['en', 'es'] as const) expect(Buffer.from((await renderBriefingForm({ locale })).slice(0, 5)).toString()).toBe('%PDF-');
  }, 30000);
});
