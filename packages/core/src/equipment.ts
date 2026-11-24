/** Equipment double-booking (docs/SPEC.md section 11). Ranges are half-open: one job may end when the next begins. */
export interface Booking { id?: string; job_day_id?: string; equipment_id: string; start: Date; end: Date; label?: string }

export function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  return +a.start < +b.end && +b.start < +a.end;
}

/** Clashes between bookings already made and the ones wanted. A job day's own bookings never clash with themselves. */
export function equipmentConflict(existing: Booking[], wanted: Booking[]): { equipment_id: string; clash: Booking }[] {
  const out: { equipment_id: string; clash: Booking }[] = [];
  for (const w of wanted) {
    for (const e of existing) {
      if (e.equipment_id !== w.equipment_id) continue;
      if (w.job_day_id && e.job_day_id === w.job_day_id) continue;
      if (overlaps(e, w)) out.push({ equipment_id: w.equipment_id, clash: e });
    }
  }
  return out;
}

/** A job day's booking window from its day, local start time and hours, as UTC instants. */
export function dayRange(day: string, startTime: string, hours: number, timeZone: string): { start: Date; end: Date } {
  const start = zonedToUtc(day, startTime, timeZone);
  return { start, end: new Date(+start + Number(hours) * 3_600_000) };
}

/** "2026-05-04" + "07:30" in a time zone, as the UTC instant. */
export function zonedToUtc(day: string, time: string, timeZone: string): Date {
  const [h, m] = time.split(':').map(Number) as [number, number];
  const guess = new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const offset = tzOffsetMinutes(guess, timeZone);
  const first = new Date(+guess - offset * 60_000);
  // Recheck once: the offset can differ across a daylight saving change.
  const offset2 = tzOffsetMinutes(first, timeZone);
  return offset2 === offset ? first : new Date(+guess - offset2 * 60_000);
}

export function tzOffsetMinutes(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return Math.round((asUtc - Math.floor(+at / 1000) * 1000) / 60_000);
}

/** The local date and hour of an instant in a time zone. */
export function localParts(at: Date, timeZone: string): { day: string; hour: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

/** Hours until the next service, from the hour meter. Null when the company hasn't set an interval. */
export function hoursToService(e: { hour_meter: number | null; service_every_hours: number | null; last_service_hours: number | null }): number | null {
  if (!e.service_every_hours || e.hour_meter === null) return null;
  return Math.round(((e.last_service_hours ?? 0) + Number(e.service_every_hours) - Number(e.hour_meter)) * 10) / 10;
}
