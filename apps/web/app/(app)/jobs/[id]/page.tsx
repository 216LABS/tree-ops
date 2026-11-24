import { estimateVsActual } from '@treeops/core/actual';
import { NEAR_LINES_WORDS } from '@treeops/core/electrical';
import { prettyPhone } from '@treeops/core/messages';
import { dollars, shortDollars } from '@treeops/core/money';
import { CHECK_WORDS, STATUS_WORDS, type CheckKind, type CheckStatus } from '@treeops/core/prework';
import { WEATHER_WORDS } from '@treeops/core/weather';
import { Badge, Card, Eyebrow, PageHeader } from '@treeops/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionButton } from '@/components/actions';
import { asUser, requirePage } from '@/lib/auth';
import { loadOptions } from '@/lib/estimates';
import { DAY_STATUS, fmtDay, fmtTime, INV_STATUS, JOB_STATUS } from '@/lib/format';
import { signedUrl, signedUrls } from '@/lib/storage';
import { AddChangeOrder, CheckEditor, CrewLinkButton, MoveDay, NewClaim, ProofButton, ScheduleDay } from './job-actions';

export const metadata = { title: 'Job' };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePage();
  const { id } = await params;
  const tz = ctx.tenant.timezone;
  const d = await asUser(ctx, async (tx) => {
    const [j] = await tx`select j.*, p.address, p.city, p.id as property_id, c.name as customer, c.phone, c.id as customer_id, e.number as est_number, e.id as estimate_id, e.total_cents
      from jobs j join properties p on p.id = j.property_id join customers c on c.id = p.customer_id join estimates e on e.id = j.estimate_id where j.id = ${id}`;
    if (!j) return null;
    const days = await tx`select jd.*, c.name as crew, (select coalesce(json_agg(json_build_object('id', e.id, 'name', e.name)), '[]') from equipment_bookings b join equipment e on e.id = b.equipment_id where b.job_day_id = jd.id) as equipment,
      (select max(created_at) from crew_links l where l.job_day_id = jd.id and not l.revoked) as link_at, (select bool_or(opened_at is not null) from crew_links l where l.job_day_id = jd.id and not l.revoked) as link_opened
      from job_days jd left join crews c on c.id = jd.crew_id where jd.job_id = ${id} order by jd.day`;
    const dayIds = days.map((x) => x.id as string);
    return {
      j, days,
      checks: await tx`select * from prework_checks where job_id = ${id} order by kind`,
      trees: await tx`select id, number, label, species_common, near_lines from trees where property_id = ${j.property_id} order by number`,
      options: await loadOptions(tx, j.estimate_id),
      briefings: dayIds.length ? await tx`select b.*, w.full_name as leader, (select coalesce(json_agg(json_build_object('name', w2.full_name, 'at', so.signed_at, 'late', so.late_arrival, 'level', w2.electrical_level) order by so.signed_at), '[]') from briefing_signoffs so join workers w2 on w2.id = so.worker_id where so.briefing_id = b.id) as signoffs
        from briefings b join workers w on w.id = b.leader_worker_id where b.job_day_id = any(${dayIds}) order by b.completed_at` : [],
      confirmations: dayIds.length ? await tx`select tc.*, t.number as tree_number, w.full_name as by_name, bp.storage_path as before_path, ap.storage_path as after_path from tree_confirmations tc left join trees t on t.id = tc.tree_id left join workers w on w.id = tc.confirmed_by
        left join photos bp on bp.id = tc.before_photo_id left join photos ap on ap.id = tc.after_photo_id where tc.job_day_id = any(${dayIds}) order by tc.at` : [],
      work: dayIds.length ? await tx`select worker_id, kind, at, value, equipment_id from work_log where job_day_id = any(${dayIds})` : [],
      disposal: dayIds.length ? await tx`select * from disposal_tickets where job_day_id = any(${dayIds}) order by created_at` : [],
      cos: await tx`select co.*, s.signer_name, s.signed_at from change_orders co left join signatures s on s.id = co.signature_id where co.job_id = ${id} order by co.created_at`,
      invoice: (await tx`select id, number, status, total_cents, jsonb_array_length(flags) as flags from invoices where job_id = ${id}`)[0] ?? null,
      packets: await tx`select id, sha256, pdf_path, created_at from proof_packets where job_id = ${id} order by created_at desc limit 5`,
      claims: await tx`select id, kind, status, opened_on, description from claims where job_id = ${id} order by opened_on desc`,
      crews: await tx`select id, name from crews where active order by name`,
      equipment: await tx`select id, name, type from equipment where active order by type, name`,
      deposit: (await tx`select d.amount_cents, d.status from deposits d where d.estimate_id = ${j.estimate_id}`)[0] ?? null,
    };
  });
  if (!d) notFound();
  const { j } = d;
  const photoUrls = await signedUrls('photos', d.confirmations.flatMap((c) => [c.before_path, c.after_path]).filter(Boolean), 3600);
  const packetUrls = await Promise.all(d.packets.map((p) => signedUrl('packets', p.pdf_path)));
  const included = d.options.filter((o) => o.required || o.selected);
  const v = estimateVsActual(included.flatMap((o) => o.lines), d.work as never);
  const manager = ['owner', 'office'].includes(ctx.role);
  const openChecks = d.checks.filter((c) => ['needed', 'requested'].includes(c.status));
  const allClosed = d.days.length > 0 && d.days.every((x) => x.status === 'closed' || x.status === 'working' || x.status === 'briefed');
  const treeNum = new Map(d.trees.map((t) => [t.id as string, t.number as number]));

  return (
    <div>
      <PageHeader
        title={<>Job {j.number} <Badge tone={JOB_STATUS[j.status]![1]} className="align-middle">{JOB_STATUS[j.status]![0]}</Badge></>}
        subtitle={<><Link className="text-link underline" href={`/customers/${j.customer_id}`}>{j.customer}</Link> · <Link className="text-link underline" href={`/properties/${j.property_id}`}>{j.address}</Link>{j.phone ? ` · ${prettyPhone(j.phone)}` : ''}</>}
        actions={<Link className="rounded-control border border-line px-3 py-2 text-sm" href={`/estimates/${j.estimate_id}`}>Estimate {j.est_number}</Link>}
      />
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Badge tone={j.required_electrical_level > 1 ? 'amber' : 'gray'}>Electrical level {j.required_electrical_level}+</Badge>
        {j.needs_crane ? <Badge tone="blue">Crane job</Badge> : null}
        {d.trees.filter((t) => t.near_lines !== 'none').map((t) => <Badge key={t.id} tone="amber">Tree {t.number}: {NEAR_LINES_WORDS[t.near_lines as keyof typeof NEAR_LINES_WORDS]}</Badge>)}
        {d.deposit ? <Badge tone={d.deposit.status === 'paid' ? 'green' : 'amber'}>Deposit {shortDollars(d.deposit.amount_cents)} {d.deposit.status}</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <Eyebrow className="mb-2">Before the work {openChecks.length ? <Badge tone="amber">{openChecks.length} open</Badge> : <Badge tone="green">Clear</Badge>}</Eyebrow>
          <div className="space-y-2">
            {d.checks.map((c) => (
              <Card key={c.id} data-testid={`check-${c.kind}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{CHECK_WORDS[c.kind as CheckKind]}</span>
                  <Badge tone={c.status === 'cleared' || c.status === 'not_required' ? 'green' : c.status === 'overridden' ? 'blue' : 'amber'}>{STATUS_WORDS[c.status as CheckStatus]}</Badge>
                  {c.ref_no ? <span className="text-sm">#{c.ref_no}</span> : null}
                  {c.valid_until ? <span className="text-sm text-muted">good until {fmtDay(new Date(c.valid_until).toISOString().slice(0, 10))}</span> : null}
                </div>
                {c.reason ? <p className="mt-1 text-xs text-muted">{c.reason}</p> : null}
                {c.override_reason ? <p className="mt-1 text-sm">Override: {c.override_reason}</p> : null}
                {j.status !== 'billed' ? <CheckEditor jobId={id} check={{ id: c.id, kind: c.kind, status: c.status, refNo: c.ref_no, validUntil: c.valid_until ? new Date(c.valid_until).toISOString().slice(0, 10) : '' }} canOverride={manager} /> : null}
              </Card>
            ))}
            {!d.checks.length ? <p className="text-sm text-muted">No checks needed for this job’s work and location.</p> : null}
            {j.status !== 'billed' ? <CheckEditor jobId={id} check={null} canOverride={false} /> : null}
          </div>
        </section>

        <section>
          <Eyebrow className="mb-2">Schedule</Eyebrow>
          <div className="space-y-2">
            {d.days.map((x) => {
              const flags = (x.weather_flags as { kind: keyof typeof WEATHER_WORDS; message: string }[]) ?? [];
              return (
                <Card key={x.id} data-testid="job-day">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{fmtDay(x.day)} {String(x.start_time).slice(0, 5)}</span>
                    <Badge tone={DAY_STATUS[x.status]![1]}>{DAY_STATUS[x.status]![0]}</Badge>
                    <span className="text-sm">{x.crew ?? 'No crew'} · {Number(x.est_hours)} h</span>
                    {(x.equipment as { name: string }[]).map((e, i) => <Badge key={i} tone="gray">{e.name}</Badge>)}
                  </div>
                  {flags.length ? <p className="mt-1 text-sm text-warn-ink">{flags.map((f) => f.message).join(' ')}</p> : <p className="mt-1 text-xs text-muted">Weather: nothing over your limits.</p>}
                  {manager && x.status !== 'closed' ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <CrewLinkButton jobDayId={x.id} opened={Boolean(x.link_opened)} hasLink={Boolean(x.link_at)} />
                      {['planned', 'weather_hold', 'briefed'].includes(x.status) ? <MoveDay jobDayId={x.id} day={x.day} /> : null}
                      <ActionButton size="sm" variant="ghost" path={`/api/job-days/${x.id}/weather`}>Check weather</ActionButton>
                      {x.status === 'planned' ? <ActionButton size="sm" variant="ghost" method="DELETE" path={`/api/job-days/${x.id}`} confirm="Take this day off the schedule?">Remove</ActionButton> : null}
                    </div>
                  ) : null}
                </Card>
              );
            })}
            {manager && ['unscheduled', 'scheduled', 'in_progress'].includes(j.status) ? <ScheduleDay jobId={id} crews={d.crews as never} equipment={d.equipment as never} needsCrane={j.needs_crane} /> : null}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <Eyebrow className="mb-2">On site</Eyebrow>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <p className="font-semibold">Briefings</p>
            {d.briefings.length ? d.briefings.map((b) => (
              <div key={b.id} className="mt-2 text-sm">
                <p>{fmtTime(b.completed_at, tz)} · {b.is_rebrief ? 'Re-brief' : 'Briefing'} by {b.leader}</p>
                <p className="text-muted">Lines: {NEAR_LINES_WORDS[b.line_proximity as keyof typeof NEAR_LINES_WORDS]} · Hospital: {b.hospital_name ?? 'not set'}</p>
                <ul className="mt-1 list-inside list-disc">{(b.signoffs as { name: string; at: string; late: boolean; level: number }[]).map((s, i) => <li key={i}>{s.name} (level {s.level}){s.late ? ', arrived late' : ''}</li>)}</ul>
              </div>
            )) : <p className="mt-1 text-sm text-muted">Not done yet. The crew does it on their link before tree work unlocks.</p>}
          </Card>
          <Card className="lg:col-span-2">
            <p className="font-semibold">Trees confirmed</p>
            {d.confirmations.length ? (
              <ul className="mt-2 space-y-3">
                {d.confirmations.map((c) => (
                  <li key={c.id} className="text-sm">
                    <p><strong>Tree {c.tree_number ?? (c.tree_id ? treeNum.get(c.tree_id) : '')}</strong>: {c.result}{c.reason ? ` (${c.reason})` : ''} · {fmtTime(c.at, tz)}{c.by_name ? ` · ${c.by_name}` : ''}</p>
                    <div className="mt-1 flex gap-2">
                      {c.before_path && photoUrls.get(c.before_path) ? <img src={photoUrls.get(c.before_path)} alt="Before" className="h-24 w-32 rounded object-cover" /> : null}
                      {c.after_path && photoUrls.get(c.after_path) ? <img src={photoUrls.get(c.after_path)} alt="After" className="h-24 w-32 rounded object-cover" /> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-muted">No trees confirmed yet.</p>}
            <p className="mt-3 text-sm">Crew hours: <strong>{v.actualHours}</strong> of {v.estHours} estimated{v.variancePct !== null ? ` (${v.variancePct > 0 ? '+' : ''}${v.variancePct}%)` : ''}.{d.disposal.length ? ` Dump tickets: ${d.disposal.map((x) => `${x.loads ?? '?'} ${x.kind}`).join(', ')}.` : ''}</p>
          </Card>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <Eyebrow className="mb-2">Change orders</Eyebrow>
          <div className="space-y-2">
            {d.cos.map((c) => (
              <Card key={c.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{c.description}</span>
                  <span>{dollars(c.amount_cents)}</span>
                  <Badge tone={c.status === 'signed' ? 'green' : c.status === 'declined' ? 'red' : 'amber'}>{c.status === 'proposed' ? 'Not signed' : c.status}</Badge>
                </div>
                {c.signer_name ? <p className="text-sm text-muted">Signed by {c.signer_name} {fmtTime(c.signed_at, tz)}</p> : null}
                {c.status === 'proposed' ? <p className="text-xs text-muted">Stays off the bill until the customer signs.</p> : null}
                {c.status === 'proposed' ? <div className="mt-2"><ActionButton size="sm" variant="outline" path={`/api/change-orders/${c.id}/send`}>Text it to sign</ActionButton></div> : null}
              </Card>
            ))}
            {j.status !== 'billed' ? <AddChangeOrder jobId={id} /> : null}
          </div>
        </div>
        <div>
          <Eyebrow className="mb-2">Bill</Eyebrow>
          <Card>
            {d.invoice ? (
              <p>Invoice <Link className="font-semibold text-link underline" href={`/invoices/${d.invoice.id}`}>{d.invoice.number}</Link> · {dollars(d.invoice.total_cents)} · <Badge tone={INV_STATUS[d.invoice.status]![1]}>{INV_STATUS[d.invoice.status]![0]}</Badge>{d.invoice.flags ? ` · ${d.invoice.flags} flag${d.invoice.flags > 1 ? 's' : ''}` : ''}</p>
            ) : <p className="text-sm text-muted">Close the job when the work is done. The invoice comes from the signed estimate plus signed change orders, less the deposit.</p>}
            {manager && (!d.invoice || d.invoice.status === 'draft') && ['in_progress', 'scheduled', 'done'].includes(j.status) ? (
              <div className="mt-3">
                <ActionButton variant={allClosed || j.status === 'done' ? 'accent' : 'outline'} path={`/api/jobs/${id}/close`} testId="close-job" confirm={allClosed ? undefined : 'Not every crew day has been worked. Close and bill anyway?'}>{d.invoice ? 'Rebuild the invoice' : 'Close and bill'}</ActionButton>
              </div>
            ) : null}
          </Card>
          <Eyebrow className="mb-2 mt-6">Proof packet</Eyebrow>
          <Card>
            <p className="text-sm text-muted">Signed estimate, checks, briefings, every photo with its hash, change orders, messages and corrections, in one PDF.</p>
            {manager ? <div className="mt-2"><ProofButton jobId={id} /></div> : null}
            <ul className="mt-2 space-y-1 text-sm">
              {d.packets.map((p, i) => <li key={p.id}>{packetUrls[i] ? <a className="text-link underline" href={packetUrls[i]!} target="_blank" rel="noreferrer">{fmtTime(p.created_at, tz)}</a> : fmtTime(p.created_at, tz)} <span className="font-mono text-xs text-muted">{p.sha256.slice(0, 16)}…</span></li>)}
            </ul>
          </Card>
          <Eyebrow className="mb-2 mt-6">Claims</Eyebrow>
          <Card>
            {d.claims.map((c) => <p key={c.id} className="text-sm"><Link className="text-link underline" href={`/claims?open=${c.id}`}>{c.kind.replace('_', ' ')}</Link> · {c.status} · {c.description}</p>)}
            {manager ? <NewClaim jobId={id} /> : null}
          </Card>
        </div>
      </section>
    </div>
  );
}
