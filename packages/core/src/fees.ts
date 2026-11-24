/**
 * The platform fee on payments run through Tree Ops (docs/SPEC.md section 5). fee = min(round(amount x rate), cap).
 * Never charged on a refund or a zero amount. Enterprise tenants on their own processor pay none.
 */
export type Plan = 'free' | 'pro' | 'enterprise';
export const FEE_RULES: Record<Plan, { rate: number; capCents: number }> = {
  free: { rate: 0.01, capCents: 1500 },
  pro: { rate: 0.005, capCents: 1000 },
  enterprise: { rate: 0.005, capCents: 1000 },
};

export function paymentFee(amountCents: number, plan: Plan, ownProcessor = false): number {
  if (amountCents <= 0 || ownProcessor) return 0;
  const r = FEE_RULES[plan];
  return Math.min(Math.round(amountCents * r.rate), r.capCents);
}
