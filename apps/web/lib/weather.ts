import { db } from '@treeops/db';
import { settingsOf } from '@treeops/core/settings';
import { weatherFlags, type WeatherFlag } from '@treeops/core/weather';
import { sha256Hex } from './tokens';
import { providers } from './providers';

const LIFT_TYPES = ['crane', 'bucket'];

/**
 * Fetches the forecast for one job day, keeps the raw response's hash with the snapshot (append-only), and stores the
 * flags on the job day. If the fetch fails, the last snapshot stays and the board marks it stale.
 */
export async function refreshJobDay(jobDayId: string): Promise<WeatherFlag[] | null> {
  const sql = db();
  const [jd] = await sql`
    select jd.id, jd.day, jd.tenant_id, p.lat, p.lon, t.timezone, t.settings, j.needs_crane,
      exists (select 1 from equipment_bookings b join equipment e on e.id = b.equipment_id where b.job_day_id = jd.id and e.type = any(${LIFT_TYPES})) as lift
    from job_days jd join jobs j on j.id = jd.job_id join properties p on p.id = j.property_id join tenants t on t.id = jd.tenant_id
    where jd.id = ${jobDayId}`;
  if (!jd || jd.lat === null || jd.lon === null) return null;
  const s = settingsOf(jd.settings);
  const day = await providers().weather.day(Number(jd.lat), Number(jd.lon), jd.day, jd.timezone);
  const flags: WeatherFlag[] = day
    ? weatherFlags(day.hours, s.weather, { lift: jd.lift || jd.needs_crane, startHour: s.work_start_hour, endHour: s.work_end_hour })
    : [{ kind: 'unavailable', at: null, value: null, threshold: null, message: 'Forecast unavailable for this day.' }];
  if (day) {
    await sql`insert into weather_snapshots (tenant_id, lat, lon, for_date, source, fetched_at, request_url, sha256, hourly, flags)
      values (${jd.tenant_id}, ${jd.lat}, ${jd.lon}, ${jd.day}, ${day.source}, now(), ${day.url}, ${sha256Hex(day.raw)}, ${sql.json(day.hours as never)}, ${sql.json(flags as never)})`;
  }
  await sql`update job_days set weather_flags = ${sql.json(flags as never)} where id = ${jobDayId}`;
  return flags;
}

/** Refreshes every planned job day in the next week for a tenant (the 05:00 job, and the board's button). */
export async function refreshUpcoming(tenantId: string, days = 7) {
  const sql = db();
  const rows = await sql`select id from job_days where tenant_id = ${tenantId} and status in ('planned','briefed','weather_hold')
    and day between current_date - 1 and current_date + ${days}::int`;
  let ok = 0;
  for (const r of rows) {
    try {
      await refreshJobDay(r.id);
      ok++;
    } catch (err) {
      console.error(JSON.stringify({ level: 'warn', msg: 'weather refresh failed', jobDay: r.id, error: String(err) }));
    }
  }
  return { checked: rows.length, ok };
}

export async function latestSnapshot(tenantId: string, jobDayId: string) {
  const sql = db();
  const [s] = await sql`select ws.* from weather_snapshots ws join job_days jd on jd.id = ${jobDayId} join jobs j on j.id = jd.job_id join properties p on p.id = j.property_id
    where ws.tenant_id = ${tenantId} and ws.for_date = jd.day and ws.lat = p.lat and ws.lon = p.lon order by ws.fetched_at desc limit 1`;
  return s ?? null;
}
