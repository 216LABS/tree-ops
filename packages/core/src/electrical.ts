import type { NearLines } from './prework';

/**
 * Electrical gate (docs/SPEC.md sections 2.5 and 11). Levels follow ANSI Z133-2026 as reported by TCI Magazine:
 * 1 unqualified, 2 up to 750 V, 3 up to 35 kV, 4 line clearance. Utility line clearance work is out of scope, so the
 * highest a job asks for here is 3, plus an abatement plan for trees near lines over 35 kV.
 */
export const LEVEL_FOR: Record<NearLines, number> = { none: 1, service_le_750v: 2, dist_le_35kv: 3, gt_35kv: 3 };

export function requiredLevel(trees: { near_lines: NearLines }[]): { level: number; needsAbatement: boolean; worst: NearLines } {
  const order: NearLines[] = ['none', 'service_le_750v', 'dist_le_35kv', 'gt_35kv'];
  let worst: NearLines = 'none';
  for (const t of trees) if (order.indexOf(t.near_lines) > order.indexOf(worst)) worst = t.near_lines;
  return { level: LEVEL_FOR[worst], needsAbatement: worst === 'gt_35kv', worst };
}

export function electricalGate(job: { level: number; needsAbatement: boolean }, onSite: { electrical_level: number }[], abatementPlan: string | null | undefined): { ok: boolean; reason: string | null } {
  const best = onSite.reduce((m, w) => Math.max(m, w.electrical_level), 0);
  if (best < job.level) return { ok: false, reason: `This job needs a level ${job.level} worker on site; the highest signed in is level ${best || 'none'}.` };
  if (job.needsAbatement && !abatementPlan) return { ok: false, reason: 'A tree is near lines over 35 kV: attach the utility-coordinated abatement plan first.' };
  return { ok: true, reason: null };
}

export const NEAR_LINES_WORDS: Record<NearLines, string> = {
  none: 'No lines nearby',
  service_le_750v: 'Service drop (750 V or less)',
  dist_le_35kv: 'Distribution line (up to 35 kV)',
  gt_35kv: 'Line over 35 kV',
};
