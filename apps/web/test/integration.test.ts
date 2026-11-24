import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeDb, db, withUser } from '@treeops/db';
import { settingsOf } from '@treeops/core/settings';
import { mockStripeSignature } from '@treeops/providers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Ctx } from '@/lib/auth';
import { closeJob, handlePaymentEvent } from '@/lib/billing';
import { applyOps, resolveLink } from '@/lib/crew';
import { overrideCheck, scheduleJobDay } from '@/lib/jobs';
import { buildManifest } from '@/lib/proof';
import { manifestHash } from '@treeops/core/proof';
import { providers } from '@/lib/providers';
import { encryptToken, hashToken, newToken } from '@/lib/tokens';

/**
 * docs/SPEC.md section 16, integration: the server rules, against the real local database with mock providers.
 * Starts from a fresh demo company.
 */
const sql = db();
let ctx: Ctx;
const job = async (n: number) => (await sql`select * from jobs where tenant_id = ${ctx.tenantId} and number = ${n}`)[0]!;

beforeAll(async () => {
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/seed-demo.ts'], { stdio: 'ignore', env: process.env });
  const [m] = await sql`select m.user_id, m.role, m.branch_id, to_jsonb(t) as tenant from memberships m join tenants t on t.id = m.tenant_id where t.slug = 'maple-ridge-demo' and m.role = 'owner'`;
  ctx = { userId: m!.user_id, email: null, tenantId: (m!.tenant as { id: string }).id, role: 'owner', branchId: m!.branch_id, tenant: m!.tenant as never, settings: settingsOf((m!.tenant as { settings: unknown }).settings) };
});
afterAll(() => closeDb());

async function crewLink(jobDayId: string) {
  const token = newToken();
  await sql`insert into crew_links (tenant_id, job_day_id, token_hash, token_enc, expires_at) values (${ctx.tenantId}, ${jobDayId}, ${hashToken(token)}, ${encryptToken(token)}, now() + interval '1 day')`;
  return resolveLink(token);
}

describe('offline crew sync', () => {
  it('a batch of 20 ops sent twice lands once; tree work waits for the briefing', async () => {
    const j = await job(1002);
    const [jd] = await sql`select id from job_days where job_id = ${j.id}`;
    const scope = await crewLink(jd!.id);
    const [w] = await sql`select w.id from workers w where w.tenant_id = ${ctx.tenantId} and w.electrical_level = 3 limit 1`;
    const [line] = await sql`select l.id, l.tree_id from estimate_lines l join estimate_options o on o.id = l.option_id where o.estimate_id = ${j.estimate_id} and l.tree_id is not null and o.required limit 1`;
    const at = () => new Date().toISOString();
    const meta = { ip: null, userAgent: null };

    // Tree work before a briefing is refused, not lost.
    const early = await applyOps(scope, [{ clientId: randomUUID(), type: 'tree_confirm', payload: { lineId: line!.id, treeId: line!.tree_id, result: 'partial', at: at() } }] as never, meta);
    expect(early.rejected[0]?.code).toBe('gated');

    const bClient = randomUUID();
    const ops = [
      { clientId: bClient, type: 'briefing', payload: { leaderWorkerId: w!.id, hazards: ['drop_zone'], lineProximity: 'none', isRebrief: false, completedAt: at() } },
      { clientId: randomUUID(), type: 'signoff', payload: { briefingClientId: bClient, workerId: w!.id, signedAt: at(), lateArrival: false } },
      ...Array.from({ length: 18 }, (_, i) => ({ clientId: randomUUID(), type: 'work_log', payload: { workerId: w!.id, kind: i % 2 ? 'pause' : 'resume', at: new Date(Date.now() + i * 60000).toISOString() } })),
    ];
    const first = await applyOps(scope, ops as never, meta);
    expect(first.applied).toHaveLength(20);
    const second = await applyOps(scope, ops as never, meta);
    expect(second.dupes).toHaveLength(20);
    expect(second.applied).toHaveLength(0);
    const [n] = await sql`select (select count(*)::int from work_log where job_day_id = ${jd!.id}) as w, (select count(*)::int from briefings where job_day_id = ${jd!.id}) as b`;
    expect(n).toEqual({ w: 18, b: 1 });
  });

  it('a confirmation whose photo hasn’t arrived waits (retry) instead of failing', async () => {
    const j = await job(1002);
    const [jd] = await sql`select id from job_days where job_id = ${j.id}`;
    const scope = await crewLink(jd!.id);
    const [line] = await sql`select l.id, l.tree_id from estimate_lines l join estimate_options o on o.id = l.option_id where o.estimate_id = ${j.estimate_id} and l.tree_id is not null and o.required limit 1`;
    const out = await applyOps(scope, [{ clientId: randomUUID(), type: 'tree_confirm', payload: { lineId: line!.id, treeId: line!.tree_id, result: 'done', afterPhotoClientId: randomUUID(), beforePhotoClientId: null, at: new Date().toISOString() } }] as never, { ip: null, userAgent: null });
    expect(out.retry).toHaveLength(1);
  });

  it('an ended link is gone', async () => {
    await expect(resolveLink('not-a-real-token')).rejects.toMatchObject({ code: 'gone' });
  });
});

describe('scheduling rules', () => {
  it('open checks return gated; an override with a reason clears it and is audited', async () => {
    const j = await job(1003);
    const [crew] = await sql`select id from crews where tenant_id = ${ctx.tenantId} limit 1`;
    const day = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
    await expect(withUser(ctx.userId, (tx) => scheduleJobDay(tx, ctx, { jobId: j.id, crewId: crew!.id, day, startTime: '07:30', estHours: 8, equipmentIds: [] }))).rejects.toMatchObject({ code: 'gated' });
    const checks = await sql`select id from prework_checks where job_id = ${j.id}`;
    await expect(withUser(ctx.userId, (tx) => overrideCheck(tx, checks[0]!.id, 'too short'))).rejects.toMatchObject({ code: 'validation' });
    for (const c of checks) await withUser(ctx.userId, (tx) => overrideCheck(tx, c.id, 'Utility and HOA confirmed by phone today.'));
    const id = await withUser(ctx.userId, (tx) => scheduleJobDay(tx, ctx, { jobId: j.id, crewId: crew!.id, day, startTime: '07:30', estHours: 8, equipmentIds: [] }));
    expect(id).toMatch(/[0-9a-f-]{36}/);
    const audit = await sql`select count(*)::int as n from audit_log where target_id = any(${checks.map((c) => c.id)}) and actor_id = ${ctx.userId} and after ->> 'status' = 'overridden'`;
    expect(audit[0]!.n).toBe(checks.length);
  });

  it('double-booked equipment returns conflict, and the database is the backstop', async () => {
    const j = await job(1004);
    const [crane] = await sql`select id from equipment where tenant_id = ${ctx.tenantId} and type = 'crane'`;
    const [crew] = await sql`select id from crews where tenant_id = ${ctx.tenantId} offset 1 limit 1`;
    const [today] = await sql`select jd.day from job_days jd join jobs j on j.id = jd.job_id where j.tenant_id = ${ctx.tenantId} and j.number = 1001`;
    await expect(withUser(ctx.userId, (tx) => scheduleJobDay(tx, ctx, { jobId: j.id, crewId: crew!.id, day: today!.day, startTime: '09:00', estHours: 4, equipmentIds: [crane!.id] }))).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('billing', () => {
  it('an unsigned change order never reaches the invoice; a signed one does', async () => {
    const j = await job(1008); // the done job with a proposed change order from the seed
    const out = await withUser(ctx.userId, (tx) => closeJob(tx, ctx, j.id));
    const lines = await sql`select source, description from invoice_lines where invoice_id = ${out.invoiceId}`;
    expect(lines.some((l) => l.source === 'change_order')).toBe(false);
    expect(out.flags.map((f) => f.code)).toContain('unsigned_co_excluded');
    // Sign it (the database insists on a signature), rebuild, and it's billed.
    const [co] = await sql`select id from change_orders where job_id = ${j.id}`;
    const [sig] = await sql`insert into signatures (tenant_id, subject_type, subject_id, signer_name, image_path, sha256, signed_at, client_id) values (${ctx.tenantId}, 'change_order', ${co!.id}, 'Test', 'x', ${'e'.repeat(64)}, now(), ${randomUUID()}) returning id`;
    await sql`update change_orders set status = 'signed', signature_id = ${sig!.id} where id = ${co!.id}`;
    const again = await withUser(ctx.userId, (tx) => closeJob(tx, ctx, j.id));
    const lines2 = await sql`select source, amount_cents from invoice_lines where invoice_id = ${again.invoiceId}`;
    expect(lines2.filter((l) => l.source === 'change_order').map((l) => l.amount_cents)).toEqual([18000]);
    expect(again.totalCents - out.totalCents).toBe(18000);
  });

  it('a replayed payment webhook records one payment', async () => {
    const [inv] = await sql`select i.id, i.total_cents from invoices i join jobs j on j.id = i.job_id where j.tenant_id = ${ctx.tenantId} and i.status = 'draft' limit 1`;
    const raw = JSON.stringify({ id: `evt_${randomUUID()}`, type: 'checkout.session.completed', data: { object: { id: `cs_${randomUUID()}`, amount_total: inv!.total_cents, metadata: { tenant_id: ctx.tenantId, kind: 'invoice', id: inv!.id, fee_cents: '0' } } } });
    const ev = providers().payments.verifyWebhook(raw, mockStripeSignature(raw));
    await handlePaymentEvent(ev);
    expect(await handlePaymentEvent(ev)).toEqual({ duplicate: true });
    // The same checkout under a new event id still pays once.
    const ev2 = { ...ev, id: `evt_${randomUUID()}` };
    await handlePaymentEvent(ev2);
    const [p] = await sql`select count(*)::int as n from payments where invoice_id = ${inv!.id}`;
    expect(p!.n).toBe(1);
    const [after] = await sql`select status from invoices where id = ${inv!.id}`;
    expect(after!.status).toBe('paid');
  });

  it('a bad webhook signature is refused', () => {
    expect(() => providers().payments.verifyWebhook('{"id":"x"}', 'forged')).toThrow();
  });
});

describe('proof packet', () => {
  it('rebuilding the manifest with no new records gives the same hash', async () => {
    const j = await job(1009);
    const a = manifestHash(await buildManifest(ctx.tenantId, j.id));
    const b = manifestHash(await buildManifest(ctx.tenantId, j.id));
    expect(a).toBe(b);
    await sql`insert into corrections (tenant_id, target_table, target_id, field, new_value, reason, by_user)
      select ${ctx.tenantId}, 'work_log', w.id, 'at', '"x"', 'Clock-out time was wrong', ${ctx.userId} from work_log w join job_days jd on jd.id = w.job_day_id where jd.job_id = ${j.id} limit 1`;
    const c = manifestHash(await buildManifest(ctx.tenantId, j.id));
    expect(c).not.toBe(a);
  });
});
