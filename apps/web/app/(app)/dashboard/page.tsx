import { certState } from '@/lib/certs';
import { copyDaysLeft, profileFor } from '@treeops/core/phc';
import { hoursToService } from '@treeops/core/equipment';
import { shortDollars } from '@treeops/core/money';
import { WEATHER_WORDS } from '@treeops/core/weather';
import { Badge, Card, EmptyState, Eyebrow, PageHeader, Stat } from '@treeops/ui';
import Link from 'next/link';
import { asUser, requirePage } from '@/lib/auth';
import { DAY_STATUS, fmtDay, todayIn, addDays } from '@/lib/format';

export const metadata = { title: 'Today' };

/** What the owner opens first: today's crews and anything that needs a decision (DESIGN.md: answer before tools). */
export default async function Dashboard() {
  const ctx = await requirePage();
  const today = todayIn(ctx.tenant.timezone);
  const d = await asUser(ctx, async (tx) => ({
    days: await tx`select jd.id, jd.day, jd.status, jd.weather_flags, jd.start_time, j.id as job_id, j.number, p.address, c.name as crew from job_days jd join jobs j on j.id = jd.job_id join properties p on p.id = j.property_id left join crews c on c.id = jd.crew_id
      where jd.day between ${today} and ${addDays(today, 2)} order by jd.day, jd.start_time`,
    blocked: await tx`select j.id, j.number, p.address, array_agg(pc.kind) as kinds from jobs j join properties p on p.id = j.property_id join prework_checks pc on pc.job_id = j.id
      where j.status in ('unscheduled','scheduled') and pc.status in ('needed','requested') group by j.id, j.number, p.address order by j.number limit 8`,
    unscheduled: await tx`select count(*)::int as n from jobs where status = 'unscheduled'`,
    toBill: await tx`select count(*)::int as n from jobs j where j.status = 'in_progress' and not exists (select 1 from job_days jd where jd.job_id = j.id and jd.status <> 'closed')`,
    drafts: await tx`select i.id, i.number, i.total_cents, jsonb_array_length(i.flags) as flags from invoices i where i.status = 'draft' order by i.created_at`,
    unpaid: await tx`select coalesce(sum(total_cents), 0)::int as cents, count(*)::int as n from invoices where status = 'sent'`,
    cos: await tx`select co.id, co.description, co.amount_cents, j.id as job_id, j.number from change_orders co join jobs j on j.id = co.job_id where co.status = 'proposed' order by co.created_at limit 6`,
    certs: await tx`select holder, kind, expires_on from certificates order by expires_on`,
    phc: await tx`select a.id, a.applied_on, a.state_code, a.is_rup, p.address, exists (select 1 from messages m where m.related_id = a.id and m.template = 'phc_copy' and m.status in ('sent','mock_sent')) as sent
      from phc_applications a join properties p on p.id = a.property_id where a.applied_on > current_date - 40`,
    equipment: await tx`select name, hour_meter, service_every_hours, last_service_hours from equipment where active`,
    dead: await tx`select count(*)::int as n from messages where status = 'failed'`,
    pendingEstimates: await tx`select count(*)::int as n from estimates where status = 'sent'`,
  }));
  const todays = d.days.filter((x) => x.day === today);
  const later = d.days.filter((x) => x.day !== today);
  const certAlerts = d.certs.filter((c) => certState(c.expires_on, today) !== 'ok');
  const copyDue = d.phc.filter((a) => !a.sent).map((a) => ({ ...a, left: copyDaysLeft(a.applied_on, today, profileFor(a.state_code), a.is_rup) }) as Record<string, any>).filter((a) => a.left !== null && a.left <= 5);
  const service = d.equipment.map((e) => ({ name: e.name, left: hoursToService(e as never) })).filter((e) => e.left !== null && e.left <= 25);
  const alerts = d.blocked.length + d.cos.length + d.drafts.length + certAlerts.length + copyDue.length + service.length + (d.dead[0]!.n ? 1 : 0);

  return (
    <div>
      <PageHeader title="Today" subtitle={fmtDay(today)} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><Stat label="Crews out today" value={todays.length} /></Card>
        <Card><Stat label="Needs a look" value={alerts} /></Card>
        <Card><Stat label="Awaiting payment" value={shortDollars(d.unpaid[0]!.cents)} note={`${d.unpaid[0]!.n} invoices`} /></Card>
        <Card><Stat label="Estimates out" value={d.pendingEstimates[0]!.n} /></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <Eyebrow className="mb-2">Crews today</Eyebrow>
          {todays.length ? (
            <ul className="space-y-2">
              {todays.map((x) => <DayRow key={x.id} x={x} />)}
            </ul>
          ) : (
            <EmptyState title="No crews scheduled today" body="Jobs show here once they’re on the schedule." action={<Link className="text-link underline" href="/schedule">Open the schedule</Link>} />
          )}
          {later.length ? (
            <>
              <Eyebrow className="mb-2 mt-6">Next two days</Eyebrow>
              <ul className="space-y-2">{later.map((x) => <DayRow key={x.id} x={x} />)}</ul>
            </>
          ) : null}
        </section>

        <section className="space-y-3">
          <Eyebrow>Needs a look</Eyebrow>
          {alerts === 0 ? <p className="rounded-control border border-ok-line bg-ok-tint p-3 text-sm text-ok-ink">Nothing waiting on you.</p> : null}
          {d.blocked.map((b) => (
            <Alert key={b.id} href={`/jobs/${b.id}`} tone="amber" title={`Job ${b.number}: checks open`} body={`${b.address}. Waiting on ${(b.kinds as string[]).join(', ')}.`} />
          ))}
          {d.cos.map((c) => (
            <Alert key={c.id} href={`/jobs/${c.job_id}`} tone="blue" title={`Job ${c.number}: change order not signed`} body={`${c.description} (${shortDollars(c.amount_cents)}). It stays off the bill until signed.`} />
          ))}
          {d.drafts.map((i) => (
            <Alert key={i.id} href={`/invoices/${i.id}`} tone={i.flags ? 'amber' : 'blue'} title={`Invoice ${i.number} ready to send`} body={`${shortDollars(i.total_cents)}${i.flags ? `, ${i.flags} flag${i.flags > 1 ? 's' : ''} to review` : ''}.`} />
          ))}
          {d.toBill[0]!.n ? <Alert href="/jobs?status=in_progress" tone="blue" title={`${d.toBill[0]!.n} finished job${d.toBill[0]!.n > 1 ? 's' : ''} to close and bill`} body="Every crew day is closed." /> : null}
          {d.unscheduled[0]!.n ? <Alert href="/schedule" tone="gray" title={`${d.unscheduled[0]!.n} approved job${d.unscheduled[0]!.n > 1 ? 's' : ''} not scheduled`} body="Put them on the board." /> : null}
          {certAlerts.map((c, i) => (
            <Alert key={i} href="/settings?tab=certificates" tone={certState(c.expires_on, today) === 'expired' ? 'red' : 'amber'} title={`${c.holder}: ${c.kind.toUpperCase()} certificate ${certState(c.expires_on, today) === 'expired' ? 'expired' : 'ends soon'}`} body={`Ends ${fmtDay(c.expires_on)}.`} />
          ))}
          {copyDue.map((a) => (
            <Alert key={a.id} href="/phc" tone={a.left! < 0 ? 'red' : 'amber'} title="Treatment record copy due" body={`${a.address}, applied ${fmtDay(a.applied_on)}: ${a.left! < 0 ? `${-a.left!} days late` : `${a.left} days left`} to send the customer copy.`} />
          ))}
          {service.map((e) => (
            <Alert key={e.name} href="/settings?tab=equipment" tone={e.left! <= 0 ? 'red' : 'amber'} title={`${e.name}: service ${e.left! <= 0 ? 'overdue' : 'due soon'}`} body={`${e.left! <= 0 ? `${-e.left!} hours past` : `${e.left} hours left`}.`} />
          ))}
          {d.dead[0]!.n ? <Alert href="/settings?tab=system" tone="red" title={`${d.dead[0]!.n} text${d.dead[0]!.n > 1 ? 's' : ''} didn’t send`} body="See Settings, System." /> : null}
        </section>
      </div>
    </div>
  );
}

function DayRow({ x }: { x: Record<string, any> }) {
  const flags = (x.weather_flags as { kind: keyof typeof WEATHER_WORDS; message: string }[]) ?? [];
  const [label, tone] = DAY_STATUS[x.status] ?? ['', 'gray'];
  return (
    <li>
      <Link href={`/jobs/${x.job_id}`} className="block rounded-surface border border-line-faint bg-surface p-3 shadow-float hover:border-line-strong">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-lg font-semibold">Job {x.number}</span>
          <Badge tone={tone}>{label}</Badge>
          {flags.map((f, i) => <Badge key={i} tone={f.kind === 'unavailable' ? 'gray' : 'amber'} title={f.message}>{WEATHER_WORDS[f.kind]}</Badge>)}
          <span className="ml-auto text-sm text-muted">{fmtDay(x.day)} · {String(x.start_time).slice(0, 5)}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{x.address} · {x.crew ?? 'No crew'}</p>
        {flags.length ? <p className="mt-1 text-xs text-warn-ink">{flags.map((f) => f.message).join(' ')}</p> : null}
      </Link>
    </li>
  );
}

function Alert({ href, title, body, tone }: { href: string; title: string; body: string; tone: 'amber' | 'red' | 'blue' | 'gray' }) {
  const edge = { amber: 'border-l-amber-500', red: 'border-l-red-600', blue: 'border-l-sky-600', gray: 'border-l-slate-400' }[tone];
  return (
    <Link href={href} className={`block rounded-control border border-l-4 border-line-faint ${edge} bg-surface p-3 shadow-drop hover:border-line-strong`}>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted">{body}</p>
    </Link>
  );
}
