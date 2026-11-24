import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, db, withUser } from '../src/index';
import { makeTenant, TENANT_TABLES } from './fixture';

/** Runs against the real local Postgres. Nothing about RLS is mocked (docs/SPEC.md section 16). */
const sql = db();
let A: Awaited<ReturnType<typeof makeTenant>>;
let B: Awaited<ReturnType<typeof makeTenant>>;

beforeAll(async () => {
  A = await makeTenant(sql, 'Tenant A');
  B = await makeTenant(sql, 'Tenant B');
});
afterAll(async () => closeDb());

const count = async (uid: string, table: string, tenant: string) =>
  withUser(uid, async (tx) => Number((await tx.unsafe(`select count(*)::int as n from ${table} where tenant_id = $1`, [tenant]))[0]!.n));

/** Runs a write as the user; resolves to the Postgres error code, or 'ok'. Savepoints don't matter: each is its own tx. */
const attempt = async (uid: string, fn: (tx: Parameters<Parameters<typeof withUser>[1]>[0]) => Promise<unknown>) => {
  try {
    await withUser(uid, async (tx) => {
      const r = (await fn(tx)) as { count?: number } | undefined;
      if (r && typeof r === 'object' && 'count' in r && r.count === 0) throw Object.assign(new Error('no rows'), { code: 'NOROWS' });
    });
    return 'ok';
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
};

describe('tenant isolation', () => {
  it('tenant A can read its own rows in every table', async () => {
    for (const t of TENANT_TABLES) expect(await count(A.users.owner, t, A.id), t).toBeGreaterThan(0);
  });

  it('tenant A sees nothing of tenant B in any table, for every office role', async () => {
    for (const uid of [A.users.owner, A.users.office, A.users.sales, A.users.admin]) {
      for (const t of TENANT_TABLES) expect(await count(uid, t, B.id), `${t}`).toBe(0);
    }
  });

  it('tenant A cannot write into tenant B', async () => {
    expect(await attempt(A.users.owner, (tx) => tx`insert into customers (tenant_id, name) values (${B.id}, 'intruder')`)).toBe('42501');
    expect(await attempt(A.users.owner, (tx) => tx`update customers set name = 'x' where tenant_id = ${B.id}`)).toBe('NOROWS');
    expect(await attempt(A.users.owner, (tx) => tx`delete from customers where tenant_id = ${B.id}`)).toBe('NOROWS');
    expect(await attempt(A.users.owner, (tx) => tx`update tenants set name = 'x' where id = ${B.id}`)).toBe('NOROWS');
  });

  it('the tenants table shows only your own company', async () => {
    const rows = await withUser(A.users.owner, (tx) => tx`select id from tenants`);
    expect(rows.map((r) => r.id)).toEqual([A.id]);
  });

  it('anon has no access at all', async () => {
    const err = await sql
      .begin(async (tx) => {
        await tx`set local role anon`;
        await tx`select count(*) from customers`;
      })
      .catch((e: { code?: string }) => e.code);
    expect(err).toBe('42501');
  });

  it('service-only tables are closed to signed-in users', async () => {
    for (const t of ['jobs_queue', 'idempotency_keys', 'stripe_events', 'counters']) {
      expect(await attempt(A.users.owner, (tx) => tx.unsafe(`select 1 from ${t} limit 1`)), t).toBe('42501');
    }
  });
});

describe('roles', () => {
  it('a crew member sees only their own crew’s job days and nothing else', async () => {
    const days = await withUser(A.users.crew, (tx) => tx`select id from job_days`);
    expect(days.map((d) => d.id)).toEqual([A.days.day1]);
    const other = await withUser(A.users.crewOther, (tx) => tx`select id from job_days`);
    expect(other.map((d) => d.id)).toEqual([A.days.day2]);
    expect(await count(A.users.crew, 'customers', A.id)).toBe(0);
    expect(await count(A.users.crew, 'invoices', A.id)).toBe(0);
    expect((await withUser(A.users.crew, (tx) => tx`select id from jobs`)).length).toBe(1);
  });

  it('a sales arborist writes estimates but not schedules or invoices', async () => {
    expect(await attempt(A.users.sales, (tx) => tx`update estimates set notes = 'x' where id = ${A.estimate}`)).toBe('ok');
    expect(await attempt(A.users.sales, (tx) => tx`update job_days set est_hours = 6 where id = ${A.days.day1}`)).toBe('NOROWS');
    expect(await attempt(A.users.sales, (tx) => tx`update invoices set status = 'void' where id = ${A.invoice}`)).toBe('NOROWS');
  });

  it('an enterprise admin reads everything but cannot edit jobs or money', async () => {
    expect(await count(A.users.admin, 'jobs', A.id)).toBe(1);
    expect(await attempt(A.users.admin, (tx) => tx`update jobs set notes = 'x' where id = ${A.job}`)).toBe('NOROWS');
    expect(await attempt(A.users.admin, (tx) => tx`update invoices set status = 'void' where id = ${A.invoice}`)).toBe('NOROWS');
  });

  it('nobody signed in can write field records or payments directly', async () => {
    expect(await attempt(A.users.owner, (tx) => tx`insert into payments (tenant_id, invoice_id, amount_cents, method, received_at) values (${A.id}, ${A.invoice}, 1, 'cash', now())`)).toBe('42501');
    expect(await attempt(A.users.owner, (tx) => tx`insert into work_log (tenant_id, job_day_id, kind, at, client_id) values (${A.id}, ${A.days.day1}, 'note', now(), ${randomUUID()})`)).toBe('42501');
  });

  it('only owner or office can override a pre-work check, and the override is audited', async () => {
    const reason = 'Utility marked the lines in person today.';
    expect(await attempt(A.users.sales, (tx) => tx`update prework_checks set status = 'overridden', override_reason = ${reason} where id = ${A.check}`)).toBe('42501');
    expect(await attempt(A.users.office, (tx) => tx`update prework_checks set status = 'overridden', override_reason = 'short' where id = ${A.check}`)).toBe('23514');
    expect(await attempt(A.users.office, (tx) => tx`update prework_checks set status = 'overridden', override_reason = ${reason} where id = ${A.check}`)).toBe('ok');
    const [row] = await sql`select override_by from prework_checks where id = ${A.check}`;
    expect(row!.override_by).toBe(A.users.office);
    const audit = await sql`select actor_id, after from audit_log where target_table = 'prework_checks' and target_id = ${A.check} and action = 'update'`;
    expect(audit.some((a) => a.actor_id === A.users.office && (a.after as { status: string }).status === 'overridden')).toBe(true);
  });
});

describe('append-only records', () => {
  const ao = ['photos', 'photo_markups', 'signatures', 'briefings', 'briefing_signoffs', 'work_log', 'tree_confirmations', 'corrections', 'payments', 'phc_applications', 'consents', 'weather_snapshots', 'audit_log', 'proof_packets'];
  it('reject UPDATE and DELETE even on the server connection', async () => {
    for (const t of ao) {
      const upd = await sql.unsafe(`update ${t} set created_at = now() where tenant_id = $1`, [A.id]).catch((e: { code?: string }) => e.code);
      expect(upd, `${t} update`).toBe('42501');
      const del = await sql.unsafe(`delete from ${t} where tenant_id = $1`, [A.id]).catch((e: { code?: string }) => e.code);
      expect(del, `${t} delete`).toBe('42501');
    }
  });

  it('a done tree needs an after photo, a skip needs a reason, a signed change order needs a signature', async () => {
    const done = await sql`insert into tree_confirmations (tenant_id, job_day_id, line_id, result, at, client_id) values (${A.id}, ${A.days.day1}, ${A.line}, 'done', now(), ${randomUUID()})`.catch((e: { code?: string }) => e.code);
    expect(done).toBe('23514');
    const skip = await sql`insert into tree_confirmations (tenant_id, job_day_id, line_id, result, at, client_id) values (${A.id}, ${A.days.day1}, ${A.line}, 'skipped', now(), ${randomUUID()})`.catch((e: { code?: string }) => e.code);
    expect(skip).toBe('23514');
    const co = await sql`insert into change_orders (tenant_id, job_id, description, amount_cents, status, client_id) values (${A.id}, ${A.job}, 'x', 1, 'signed', ${randomUUID()})`.catch((e: { code?: string }) => e.code);
    expect(co).toBe('23514');
  });

  it('the database refuses to double-book equipment', async () => {
    const clash = await sql`insert into equipment_bookings (tenant_id, equipment_id, job_day_id, during) values (${A.id}, ${A.equip}, ${A.days.day2}, tstzrange('2026-05-04 15:00Z', '2026-05-04 20:00Z'))`.catch((e: { code?: string }) => e.code);
    expect(clash).toBe('23P01');
    const touching = await sql`insert into equipment_bookings (tenant_id, equipment_id, job_day_id, during) values (${A.id}, ${A.equip}, ${A.days.day2}, tstzrange('2026-05-04 19:30Z', '2026-05-04 21:00Z')) returning id`;
    expect(touching).toHaveLength(1);
  });
});
