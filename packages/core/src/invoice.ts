import { lineTotal, priceEstimate, TREE_KINDS, type PriceOption } from './pricing';

export interface ChangeOrderIn { id: string; description: string; amount_cents: number; status: 'proposed' | 'signed' | 'declined' }
export interface InvoiceLineOut { source: 'estimate_line' | 'change_order' | 'adjustment'; source_id: string | null; description: string; amount_cents: number }

/**
 * The invoice from the signed estimate (docs/SPEC.md section 11, invoiceFromJob): lines from the options the customer
 * chose, plus ONLY signed change orders, less deposits paid. An unsigned change order can't reach a bill.
 */
export function invoiceFromJob(input: { options: PriceOption[]; minJobCents: number; changeOrders: ChangeOrderIn[]; depositsPaidCents: number }): { lines: InvoiceLineOut[]; subtotalCents: number; depositAppliedCents: number; totalCents: number } {
  const lines: InvoiceLineOut[] = [];
  const chosen = new Set(input.options.filter((o) => o.required || o.selected).map((o) => o.id));
  for (const o of input.options) {
    if (!chosen.has(o.id)) continue;
    for (const l of o.lines) lines.push({ source: 'estimate_line', source_id: l.id, description: l.description, amount_cents: lineTotal(l) });
  }
  const priced = priceEstimate(input.options, { min_job_cents: input.minJobCents }, 0, chosen);
  if (priced.minimumTopUpCents > 0) lines.push({ source: 'adjustment', source_id: null, description: 'Minimum job charge', amount_cents: priced.minimumTopUpCents });
  for (const co of input.changeOrders) {
    if (co.status !== 'signed') continue;
    lines.push({ source: 'change_order', source_id: co.id, description: `Change order: ${co.description}`, amount_cents: co.amount_cents });
  }
  const subtotalCents = lines.reduce((s, l) => s + l.amount_cents, 0);
  const depositAppliedCents = Math.min(subtotalCents, Math.max(0, input.depositsPaidCents));
  return { lines, subtotalCents, depositAppliedCents, totalCents: subtotalCents - depositAppliedCents };
}

export type BillingFlagCode = 'tree_not_confirmed' | 'skipped_tree_billed' | 'partial_tree_billed' | 'no_after_photo' | 'hours_over_150pct' | 'unsigned_co_excluded';
export interface BillingFlag { code: BillingFlagCode; line_id?: string; message: string }

export interface ConfirmationIn { line_id: string; result: 'done' | 'partial' | 'skipped'; after_photo_id: string | null; at: string | Date }

/** What the office should look at before sending (docs/SPEC.md section 11, billingFlags). */
export function billingFlags(input: { options: PriceOption[]; confirmations: ConfirmationIn[]; estHours: number; actualHours: number; changeOrders: ChangeOrderIn[] }): BillingFlag[] {
  const flags: BillingFlag[] = [];
  const latest = new Map<string, ConfirmationIn>();
  for (const c of [...input.confirmations].sort((a, b) => +new Date(a.at) - +new Date(b.at))) latest.set(c.line_id, c);
  for (const o of input.options) {
    if (!(o.required || o.selected)) continue;
    for (const l of o.lines) {
      if (!TREE_KINDS.includes(l.kind) || !l.tree_id) continue;
      const c = latest.get(l.id);
      if (!c) flags.push({ code: 'tree_not_confirmed', line_id: l.id, message: `"${l.description}" was never confirmed by the crew.` });
      else if (c.result === 'skipped') flags.push({ code: 'skipped_tree_billed', line_id: l.id, message: `"${l.description}" was skipped but is on the bill.` });
      else if (c.result === 'partial') flags.push({ code: 'partial_tree_billed', line_id: l.id, message: `"${l.description}" was only partly done.` });
      else if (!c.after_photo_id) flags.push({ code: 'no_after_photo', line_id: l.id, message: `"${l.description}" has no after photo.` });
    }
  }
  if (input.estHours > 0 && input.actualHours > input.estHours * 1.5) {
    flags.push({ code: 'hours_over_150pct', message: `Crew hours ${input.actualHours} vs ${input.estHours} estimated: more than 150%.` });
  }
  const unsigned = input.changeOrders.filter((c) => c.status === 'proposed');
  if (unsigned.length) flags.push({ code: 'unsigned_co_excluded', message: `${unsigned.length} change order${unsigned.length > 1 ? 's are' : ' is'} not signed, so left off.` });
  return flags;
}
