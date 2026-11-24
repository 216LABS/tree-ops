/** Estimate vs actual (D1): the hours the estimate planned against the crew's own clock. */
export interface WorkEvent { worker_id: string | null; kind: string; at: string | Date; value?: number | string | null; equipment_id?: string | null }

/**
 * Person-hours on site from arrive/leave pairs per worker, less pauses. A worker with no leave is counted up to their
 * last event, never guessed forward.
 */
export function personHours(events: WorkEvent[]): number {
  const byWorker = new Map<string, WorkEvent[]>();
  for (const e of events) {
    if (!e.worker_id || !['arrive', 'leave', 'pause', 'resume'].includes(e.kind)) continue;
    const list = byWorker.get(e.worker_id) ?? [];
    list.push(e);
    byWorker.set(e.worker_id, list);
  }
  let ms = 0;
  for (const list of byWorker.values()) {
    list.sort((a, b) => +new Date(a.at) - +new Date(b.at));
    let since: number | null = null;
    for (const e of list) {
      const t = +new Date(e.at);
      if (e.kind === 'arrive' || e.kind === 'resume') since ??= t;
      else if (since !== null) {
        ms += t - since;
        since = null;
      }
    }
  }
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export interface Variance { estHours: number; actualHours: number; variancePct: number | null; byEquipment: Record<string, number> }

export function estimateVsActual(lines: { est_crew_hours?: number | string | null }[], events: WorkEvent[]): Variance {
  const estHours = Math.round(lines.reduce((s, l) => s + (Number(l.est_crew_hours) || 0), 0) * 100) / 100;
  const actualHours = personHours(events);
  const byEquipment: Record<string, number> = {};
  for (const e of events) {
    if (e.kind === 'equipment_hours' && e.equipment_id && e.value) byEquipment[e.equipment_id] = (byEquipment[e.equipment_id] ?? 0) + Number(e.value);
  }
  return { estHours, actualHours, variancePct: estHours > 0 ? Math.round(((actualHours - estHours) / estHours) * 1000) / 10 : null, byEquipment };
}
