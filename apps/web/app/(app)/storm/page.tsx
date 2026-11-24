import { stormTriage, triageAdvice, triageScore } from '@treeops/core/storm';
import { prettyPhone } from '@treeops/core/messages';
import { Badge, Card, EmptyState, Eyebrow, PageHeader } from '@treeops/ui';
import Link from 'next/link';
import { asUser, requirePage } from '@/lib/auth';
import { fmtDay, fmtTime, todayIn } from '@/lib/format';
import { ConvertCall, IntakeForm, NewStorm, StatusSelect } from './storm-actions';

export const metadata = { title: 'Storm' };

/** Storm mode (docs/SPEC.md screen 10): take each call in under a minute; the queue orders itself by danger. */
export default async function Storm({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const ctx = await requirePage();
  const sp = await searchParams;
  const events = await asUser(ctx, (tx) => tx`select id, name, started_on, closed_at, (select count(*)::int from storm_intake i where i.storm_event_id = e.id) as calls from storm_events e order by started_on desc limit 20`);
  const current = events.find((e) => e.id === sp.event) ?? events.find((e) => !e.closed_at) ?? null;
  const intake = current ? await asUser(ctx, (tx) => tx`select * from storm_intake where storm_event_id = ${current.id}`) : [];
  const open = stormTriage(intake.filter((i) => !['done', 'declined'].includes(i.status)) as never[]) as typeof intake;
  return (
    <div>
      <PageHeader title="Storm" subtitle={current ? `${current.name}, since ${fmtDay(current.started_on)}` : 'No storm open'} actions={<NewStorm today={todayIn(ctx.tenant.timezone)} />} />
      {events.length > 1 ? <nav className="mb-4 flex flex-wrap gap-2 text-sm">{events.map((e) => <Link key={e.id} href={`/storm?event=${e.id}`} className={`rounded-control px-3 py-1.5 ${e.id === current?.id ? 'bg-ink text-surface' : 'bg-tint-2'}`}>{e.name} ({e.calls})</Link>)}</nav> : null}
      {current ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          <section><Eyebrow className="mb-2">Take a call</Eyebrow><IntakeForm eventId={current.id} /></section>
          <section>
            <Eyebrow className="mb-2">Queue, most dangerous first ({open.length})</Eyebrow>
            <ol className="space-y-2" data-testid="storm-queue">
              {open.map((i, n) => {
                const advice = triageAdvice(i as never);
                return (
                  <li key={i.id}>
                    <Card className={i.injury || i.lines_involved ? 'border-l-4 border-l-red-600' : triageScore(i as never) >= 2 ? 'border-l-4 border-l-amber-500' : ''}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg font-bold">{n + 1}.</span>
                        <span className="font-semibold">{i.address}</span>
                        {i.injury ? <Badge tone="red">Injury</Badge> : null}
                        {i.lines_involved ? <Badge tone="red">Wires</Badge> : null}
                        {i.on_structure ? <Badge tone="amber">On a structure</Badge> : null}
                        {i.blocking_access ? <Badge tone="amber">Blocking access</Badge> : null}
                        <span className="ml-auto text-xs text-muted">{fmtTime(i.created_at, ctx.tenant.timezone)}</span>
                      </div>
                      <p className="mt-1 text-sm">{i.caller_name ?? 'Caller'}{i.phone ? ` · ${prettyPhone(i.phone)}` : ''}{i.insurer ? ` · insurer: ${i.insurer}` : ''}</p>
                      {i.notes ? <p className="text-sm text-muted">{i.notes}</p> : null}
                      {advice ? <p className="mt-1 rounded-control bg-danger-tint p-2 text-sm text-danger-ink">{advice}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusSelect id={i.id} status={i.status} />
                        {i.status !== 'utility' ? <ConvertCall id={i.id} done={Boolean(i.property_id)} /> : null}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ol>
            {!open.length ? <p className="text-sm text-muted">No open calls.</p> : null}
          </section>
        </div>
      ) : <EmptyState title="No storm open" body="Open one when calls start coming in. Every call gets triaged by danger." />}
    </div>
  );
}
