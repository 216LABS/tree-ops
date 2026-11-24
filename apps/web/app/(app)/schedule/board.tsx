'use client';

import { CHECK_WORDS, type CheckKind } from '@treeops/core/prework';
import { WEATHER_WORDS, type WeatherFlagKind } from '@treeops/core/weather';
import { Badge } from '@treeops/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { api, ApiError } from '@/components/client-api';
import { fmtDay } from '@/lib/format';

interface JobDay { id: string; day: string; crew_id: string | null; status: string; weather_flags: { kind: WeatherFlagKind; message: string }[]; start_time: string; est_hours: number; job_id: string; number: number; address: string; equipment: string[]; open_checks: boolean }
interface Unscheduled { id: string; number: number; needs_crane: boolean; address: string; open_checks: boolean }

/**
 * Drag a job day to another crew or day; drag an unscheduled job onto a crew and day to book it. A clash with
 * equipment shows in red and nothing moves; open pre-work checks show a lock and are refused until done or overridden.
 */
export function Board({ days, crews, equipment, jobDays, unscheduled, craneId }: { days: string[]; crews: { id: string; name: string }[]; equipment: { id: string; name: string; type: string }[]; jobDays: JobDay[]; unscheduled: Unscheduled[]; craneId: string | null }) {
  const router = useRouter();
  const [weatherMove, setWeatherMove] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A ref, not state: the drop can fire before a state update from dragstart has rendered.
  const dragRef = useRef<{ kind: 'day' | 'job'; id: string } | null>(null);
  const setDrag = (d: { kind: 'day' | 'job'; id: string } | null) => (dragRef.current = d);

  const drop = async (crewId: string, day: string) => {
    const drag = dragRef.current;
    if (!drag) return;
    setBusy(true);
    setErr(null);
    try {
      if (drag.kind === 'day') await api(`/api/job-days/${drag.id}`, { method: 'PATCH', body: { day, crewId, weather: weatherMove } });
      else {
        const job = unscheduled.find((u) => u.id === drag.id);
        await api('/api/job-days', { body: { jobId: drag.id, crewId, day, equipmentIds: job?.needs_crane && craneId ? [craneId] : [] } });
      }
      router.refresh();
    } catch (e) {
      const d = e instanceof ApiError ? (e.detail as { blocking?: { kind: string; why: string }[] } | undefined) : undefined;
      setErr(e instanceof ApiError ? `${e.message}${d?.blocking ? ' ' + d.blocking.map((b) => `${CHECK_WORDS[b.kind as CheckKind]}: ${b.why}`).join(' ') : ''}` : 'Didn’t move.');
    } finally {
      setBusy(false);
      setDrag(null);
    }
  };

  const chip = (x: JobDay) => (
    <div
      key={x.id}
      draggable={!['working', 'closed'].includes(x.status)}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', x.id); setDrag({ kind: 'day', id: x.id }); }}
      className={`mb-1 cursor-grab rounded-row border bg-surface p-1.5 text-xs shadow-drop ${x.weather_flags.some((f) => f.kind !== 'unavailable') ? 'border-amber-500' : 'border-line'}`}
      data-testid={`chip-${x.number}`}
    >
      <Link href={`/jobs/${x.job_id}`} className="font-semibold text-link underline">Job {x.number}</Link> <span className="text-muted">{x.start_time}</span>
      <div className="truncate">{x.address}</div>
      <div className="mt-0.5 flex flex-wrap gap-0.5">
        {x.open_checks ? <Badge tone="red">Checks open</Badge> : null}
        {x.status !== 'planned' ? <Badge tone="blue">{x.status.replace('_', ' ')}</Badge> : null}
        {x.weather_flags.map((f, i) => <Badge key={i} tone={f.kind === 'unavailable' ? 'gray' : 'amber'} title={f.message}>{WEATHER_WORDS[f.kind]}</Badge>)}
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={weatherMove} onChange={(e) => setWeatherMove(e.target.checked)} /> Moves are for weather (text each customer the new date)</label>
        {busy ? <span className="text-sm text-muted">Saving…</span> : null}
      </div>
      {err ? <p role="alert" className="mb-3 rounded-control border border-danger-tint bg-danger-tint p-3 text-sm text-danger-ink" data-testid="board-error">{err}</p> : null}
      <div className="overflow-x-auto rounded-surface border border-line-faint bg-surface shadow-float">
        <table className="w-full min-w-[56rem] table-fixed text-left text-sm">
          <thead>
            <tr>
              <th className="font-display w-36 bg-tint-2 p-2 text-xs uppercase text-muted">Crew</th>
              {days.map((d) => <th key={d} className="font-display bg-tint-2 p-2 text-xs uppercase text-muted">{fmtDay(d)}</th>)}
            </tr>
          </thead>
          <tbody>
            {crews.map((c) => (
              <tr key={c.id} className="border-t border-line-faint align-top">
                <th className="p-2 font-semibold">{c.name}</th>
                {days.map((d) => (
                  <td key={d} className="h-24 border-l border-line-faint p-1" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void drop(c.id, d); }} data-testid={`cell-${c.name}-${d}`}>
                    {jobDays.filter((x) => x.crew_id === c.id && x.day === d).map(chip)}
                  </td>
                ))}
              </tr>
            ))}
            {equipment.map((e) => (
              <tr key={e.id} className="border-t border-line-faint bg-tint align-top">
                <th className="p-2 text-xs font-semibold text-muted">{e.name}</th>
                {days.map((d) => {
                  const uses = jobDays.filter((x) => x.day === d && x.equipment.includes(e.id));
                  return <td key={d} className="border-l border-line-faint p-1 text-xs">{uses.map((u) => <div key={u.id} className={uses.length > 1 ? 'font-semibold text-danger-ink' : ''}>Job {u.number} {u.start_time}</div>)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="font-display mb-2 mt-6 text-sm font-semibold uppercase tracking-wider text-muted">Not scheduled ({unscheduled.length})</h2>
      <div className="flex flex-wrap gap-2">
        {unscheduled.map((u) => (
          <div key={u.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', u.id); setDrag({ kind: 'job', id: u.id }); }} className="cursor-grab rounded-row border border-line bg-surface p-2 text-sm shadow-drop" data-testid={`unscheduled-${u.number}`}>
            <Link href={`/jobs/${u.id}`} className="font-semibold text-link underline">Job {u.number}</Link> {u.needs_crane ? <Badge tone="blue">Crane</Badge> : null} {u.open_checks ? <Badge tone="red">Checks open</Badge> : null}
            <div className="text-xs text-muted">{u.address}</div>
          </div>
        ))}
        {!unscheduled.length ? <p className="text-sm text-muted">Every approved job is on the board.</p> : null}
      </div>
      <p className="mt-3 text-xs text-muted">Drag onto a crew and day to book. On a phone, open the job and use Schedule a day.</p>
    </div>
  );
}
