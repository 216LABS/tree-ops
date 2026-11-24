import { PageHeader } from '@treeops/ui';
import Link from 'next/link';
import { ActionButton } from '@/components/actions';
import { asUser, requirePage } from '@/lib/auth';
import { addDays, fmtDay, todayIn } from '@/lib/format';
import { Board } from './board';

export const metadata = { title: 'Schedule' };

/** The schedule board (docs/SPEC.md screen 3): rows are crews and equipment, columns are days. */
export default async function Schedule({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const ctx = await requirePage();
  const sp = await searchParams;
  const start = /^\d{4}-\d{2}-\d{2}$/.test(sp.start ?? '') ? sp.start! : todayIn(ctx.tenant.timezone);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const d = await asUser(ctx, async (tx) => ({
    crews: await tx`select id, name from crews where active order by name`,
    equipment: await tx`select id, name, type from equipment where active and type in ('crane','bucket','chipper','grinder','mini_loader','spray_rig') order by type, name`,
    jobDays: await tx`select jd.id, jd.day, jd.crew_id, jd.status, jd.weather_flags, jd.start_time, jd.est_hours, j.id as job_id, j.number, p.address,
        (select coalesce(json_agg(b.equipment_id), '[]') from equipment_bookings b where b.job_day_id = jd.id) as equipment,
        exists (select 1 from prework_checks pc where pc.job_id = j.id and pc.status in ('needed','requested')) as open_checks
      from job_days jd join jobs j on j.id = jd.job_id join properties p on p.id = j.property_id where jd.day between ${days[0]!} and ${days[6]!}`,
    unscheduled: await tx`select j.id, j.number, j.needs_crane, p.address, exists (select 1 from prework_checks pc where pc.job_id = j.id and pc.status in ('needed','requested')) as open_checks
      from jobs j join properties p on p.id = j.property_id where j.status = 'unscheduled' order by j.number`,
  }));
  return (
    <div>
      <PageHeader
        title="Schedule"
        subtitle={`${fmtDay(days[0])} to ${fmtDay(days[6])}`}
        actions={
          <>
            <Link className="rounded-control border border-line px-3 py-2 text-sm" href={`/schedule?start=${addDays(start, -7)}`}>Previous week</Link>
            <Link className="rounded-control border border-line px-3 py-2 text-sm" href={`/schedule?start=${addDays(start, 7)}`}>Next week</Link>
            <ActionButton variant="outline" path="/api/schedule/weather">Check weather</ActionButton>
          </>
        }
      />
      <Board
        days={days}
        crews={d.crews as never}
        equipment={d.equipment as never}
        jobDays={d.jobDays.map((x) => ({ ...x, start_time: String(x.start_time).slice(0, 5), est_hours: Number(x.est_hours) })) as never}
        unscheduled={d.unscheduled as never}
        craneId={(d.equipment.find((e) => e.type === 'crane')?.id as string | undefined) ?? null}
      />
    </div>
  );
}
