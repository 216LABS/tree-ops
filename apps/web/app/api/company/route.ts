import { toE164 } from '@treeops/core/messages';
import { z } from 'zod';
import { asUser, requireApi } from '@/lib/auth';
import { parseJson, route } from '@/lib/http';

const body = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().max(30).nullish(),
  stateCode: z.string().length(2).optional(),
  timezone: z.string().max(60).optional(),
  defaultLocale: z.enum(['en', 'es']).optional(),
  ssoDomain: z.string().max(200).nullish(),
  settings: z.object({
    weather: z.object({ gust_mph_lift: z.number().min(5).max(80), gust_mph_climb: z.number().min(5).max(80), thunder_pct: z.number().min(0).max(100), precip_in_3h: z.number().min(0).max(5), heat_f: z.number().min(60).max(130) }).partial().optional(),
    min_job_cents: z.number().int().min(0).max(10_000_000).optional(),
    default_deposit_pct: z.number().int().min(0).max(100).optional(),
    estimate_valid_days: z.number().int().min(1).max(365).optional(),
    quiet_start_hour: z.number().int().min(0).max(23).optional(),
    quiet_end_hour: z.number().int().min(0).max(23).optional(),
    work_start_hour: z.number().int().min(0).max(23).optional(),
    work_end_hour: z.number().int().min(1).max(24).optional(),
  }).optional(),
});

/** Company details and settings. Weather thresholds are the company's own, never presented as a standard. */
export const PATCH = route(async (req) => {
  const ctx = await requireApi(['owner', 'enterprise_admin']);
  const b = await parseJson(req, body);
  const settings = b.settings ? { ...(ctx.tenant.settings as object), ...b.settings, weather: { ...((ctx.tenant.settings as { weather?: object })?.weather ?? {}), ...(b.settings.weather ?? {}) } } : null;
  await asUser(ctx, (tx) => tx`update tenants set name = coalesce(${b.name ?? null}, name), phone = ${b.phone === undefined ? ctx.tenant.phone : b.phone ? (toE164(b.phone) ?? b.phone) : null},
    state_code = coalesce(${b.stateCode?.toUpperCase() ?? null}, state_code), timezone = coalesce(${b.timezone ?? null}, timezone), default_locale = coalesce(${b.defaultLocale ?? null}, default_locale),
    sso_domain = ${b.ssoDomain === undefined ? ctx.tenant.sso_domain : b.ssoDomain || null},
    settings = coalesce(${settings ? tx.json(settings as never) : null}, settings) where id = ${ctx.tenantId}`);
  return { ok: true };
});
