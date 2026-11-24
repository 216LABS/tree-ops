/** Estimate pricing (docs/SPEC.md section 11, priceEstimate). */
export type LineKind = 'remove' | 'prune' | 'stump_grind' | 'cable_brace' | 'phc' | 'clearing' | 'crane' | 'equipment' | 'disposal' | 'permit_fee' | 'other';
export type LineUnit = 'each' | 'hour' | 'day' | 'inch_dbh' | 'load' | 'lump';

export interface PriceLine {
  id: string;
  kind: LineKind;
  description: string;
  qty: number;
  unit: LineUnit;
  unit_price_cents: number;
  tree_id?: string | null;
  est_crew_hours?: number | null;
  equipment_type?: string | null;
}
export interface PriceOption { id: string; name: string; required: boolean; selected: boolean; lines: PriceLine[] }

export const LINE_KINDS: LineKind[] = ['remove', 'prune', 'stump_grind', 'cable_brace', 'phc', 'clearing', 'crane', 'equipment', 'disposal', 'permit_fee', 'other'];
export const LINE_UNITS: LineUnit[] = ['each', 'hour', 'day', 'inch_dbh', 'load', 'lump'];
/** Work on one specific tree: the crew confirms that tree before and after. */
export const TREE_KINDS: LineKind[] = ['remove', 'prune', 'stump_grind', 'cable_brace', 'phc'];

export const lineTotal = (l: Pick<PriceLine, 'qty' | 'unit_price_cents'>) => Math.round(Number(l.qty) * l.unit_price_cents);

export interface PriceResult {
  optionTotals: Record<string, number>;
  /** Required options plus the chosen ones, before the minimum. */
  workCents: number;
  /** What the minimum job charge added, if anything. */
  minimumTopUpCents: number;
  totalCents: number;
  depositCents: number;
}

/**
 * `chosen` decides which optional options count. On the sales screen it's left out and an option counts when marked
 * selected; on the customer page it's what they ticked. Required options always count.
 */
export function priceEstimate(options: PriceOption[], settings: { min_job_cents: number }, depositPct: number, chosen?: Set<string>): PriceResult {
  const optionTotals: Record<string, number> = {};
  let work = 0;
  for (const o of options) {
    const t = o.lines.reduce((s, l) => s + lineTotal(l), 0);
    optionTotals[o.id] = t;
    if (o.required || (chosen ? chosen.has(o.id) : o.selected)) work += t;
  }
  const minimumTopUpCents = work > 0 && work < settings.min_job_cents ? settings.min_job_cents - work : 0;
  const totalCents = work + minimumTopUpCents;
  const pct = Math.min(100, Math.max(0, Math.round(depositPct)));
  return { optionTotals, workCents: work, minimumTopUpCents, totalCents, depositCents: Math.round((totalCents * pct) / 100) };
}

/** What blocks sending an estimate (screen 1, AC 4). */
export function sendProblems(options: PriceOption[], treesWithMarkedPhoto: Set<string>): string[] {
  const out: string[] = [];
  if (!options.some((o) => o.lines.length)) out.push('Add at least one line.');
  if (!options.some((o) => o.required || o.selected)) out.push('Mark at least one option as required or included.');
  for (const o of options) {
    for (const l of o.lines) {
      if (l.kind === 'remove' && !l.tree_id) out.push(`"${l.description}" removes a tree but isn't tied to one.`);
      else if (l.kind === 'remove' && !treesWithMarkedPhoto.has(l.tree_id!)) out.push(`"${l.description}" needs a photo with the tree's number drawn on it.`);
    }
  }
  return out;
}
