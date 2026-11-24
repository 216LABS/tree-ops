import type { LineKind } from './pricing';

/** Pre-work checks: which a job needs, and whether it may be scheduled (docs/SPEC.md section 11, preworkGate). */
export type CheckKind = '811' | 'permit' | 'hoa' | 'utility_line' | 'neighbor' | 'other';
export type CheckStatus = 'needed' | 'requested' | 'cleared' | 'not_required' | 'overridden';
export type NearLines = 'none' | 'service_le_750v' | 'dist_le_35kv' | 'gt_35kv';

export interface RuleTrigger { line_kinds?: LineKind[]; near_lines?: NearLines[]; min_dbh_in?: number; pine_min_dbh_in?: number }
export interface PreworkRule { state_code: string | null; city: string | null; kind: CheckKind; trigger: RuleTrigger; lead_days: number | null; valid_days: number | null; source_note: string; verified: boolean }
export interface GateTree { id: string; dbh_in: number | null; near_lines: NearLines; is_pine?: boolean; label?: string }
export interface GateLine { kind: LineKind; tree_id?: string | null }

export interface NeededCheck { kind: CheckKind; reason: string; lead_days: number | null; source_note: string; verified: boolean }

const specificity = (r: PreworkRule) => (r.city ? 2 : 0) + (r.state_code ? 1 : 0);

/** The most specific matching rule per kind wins: city over state over the shared default. */
export function requiredChecks(input: { lines: GateLine[]; trees: GateTree[]; property: { state_code: string; city: string | null; hoa_name?: string | null }; rules: PreworkRule[] }): NeededCheck[] {
  const { lines, trees, property } = input;
  const applicable = input.rules.filter(
    (r) => (!r.state_code || r.state_code.toUpperCase() === property.state_code.toUpperCase()) && (!r.city || (property.city ?? '').trim().toLowerCase() === r.city.trim().toLowerCase()),
  );
  const best = new Map<CheckKind, PreworkRule>();
  for (const r of applicable) {
    const prev = best.get(r.kind);
    if (!prev || specificity(r) > specificity(prev)) best.set(r.kind, r);
  }
  const treeOf = new Map(trees.map((t) => [t.id, t]));
  const out: NeededCheck[] = [];
  for (const r of best.values()) {
    const reason = triggerReason(r.trigger, lines, trees, treeOf);
    if (reason) out.push({ kind: r.kind, reason, lead_days: r.lead_days, source_note: r.source_note, verified: r.verified });
  }
  if (property.hoa_name && !best.has('hoa')) out.push({ kind: 'hoa', reason: `Property is in ${property.hoa_name}.`, lead_days: null, source_note: 'HOA approval is the company’s own check.', verified: false });
  return out.sort((a, b) => a.kind.localeCompare(b.kind));
}

function triggerReason(t: RuleTrigger, lines: GateLine[], trees: GateTree[], treeOf: Map<string, GateTree>): string | null {
  const kinds = t.line_kinds;
  const scoped = kinds ? lines.filter((l) => kinds.includes(l.kind)) : lines;
  if (t.min_dbh_in !== undefined) {
    for (const l of scoped) {
      const tree = l.tree_id ? treeOf.get(l.tree_id) : undefined;
      if (!tree || tree.dbh_in === null) continue;
      const limit = tree.is_pine && t.pine_min_dbh_in !== undefined ? t.pine_min_dbh_in : t.min_dbh_in;
      if (Number(tree.dbh_in) >= limit) return `${tree.label ?? 'A tree'} is ${tree.dbh_in} in DBH (permit at ${limit} in and up).`;
    }
    return null;
  }
  if (t.near_lines) {
    const near = trees.find((x) => t.near_lines!.includes(x.near_lines));
    return near ? `${near.label ?? 'A tree'} is marked near power lines.` : null;
  }
  if (kinds) {
    const hit = scoped[0];
    return hit ? `The job includes ${hit.kind.replace('_', ' ')} work.` : null;
  }
  return null;
}

export interface CheckRow { id?: string; kind: CheckKind; status: CheckStatus; override_reason?: string | null; valid_until?: string | Date | null }

/** Whether the job may be scheduled on `day`. A cleared check that runs out before the day blocks again. */
export function preworkGate(checks: CheckRow[], day?: string): { ok: boolean; blocking: (CheckRow & { why: string })[] } {
  const blocking: (CheckRow & { why: string })[] = [];
  for (const c of checks) {
    if (c.status === 'not_required') continue;
    if (c.status === 'overridden') {
      if (c.override_reason && c.override_reason.trim().length >= 10) continue;
      blocking.push({ ...c, why: 'Override needs a reason.' });
      continue;
    }
    if (c.status === 'cleared') {
      const until = c.valid_until ? new Date(c.valid_until) : null;
      if (until && day && +until < +new Date(`${day}T23:59:59Z`) - 86_400_000) blocking.push({ ...c, why: 'Cleared, but it runs out before this day.' });
      continue;
    }
    blocking.push({ ...c, why: c.status === 'requested' ? 'Requested, not cleared yet.' : 'Not done yet.' });
  }
  return { ok: blocking.length === 0, blocking };
}

export const CHECK_WORDS: Record<CheckKind, string> = { '811': '811 utility locate', permit: 'Tree permit', hoa: 'HOA approval', utility_line: 'Power line check', neighbor: 'Neighbor sign-off', other: 'Other check' };
export const STATUS_WORDS: Record<CheckStatus, string> = { needed: 'Needed', requested: 'Requested', cleared: 'Cleared', not_required: 'Not required', overridden: 'Overridden' };
