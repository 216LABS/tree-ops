/** Storm triage order (docs/SPEC.md section 11): injury, then lines, then on a structure, then blocking access, then oldest. */
export interface IntakeIn { id: string; injury: boolean; lines_involved: boolean; on_structure: boolean; blocking_access: boolean; created_at: string | Date; status?: string }

export function stormTriage<T extends IntakeIn>(intakes: T[]): T[] {
  const score = (i: IntakeIn) => (i.injury ? 8 : 0) + (i.lines_involved ? 4 : 0) + (i.on_structure ? 2 : 0) + (i.blocking_access ? 1 : 0);
  return [...intakes].sort((a, b) => score(b) - score(a) || +new Date(a.created_at) - +new Date(b.created_at) || a.id.localeCompare(b.id));
}

export const triageScore = (i: IntakeIn) => (i.injury ? 8 : 0) + (i.lines_involved ? 4 : 0) + (i.on_structure ? 2 : 0) + (i.blocking_access ? 1 : 0);

/** What the office should say first. Downed lines go to the utility, not a crew. */
export function triageAdvice(i: IntakeIn): string | null {
  if (i.injury) return 'Someone is hurt: tell the caller to call 911 first.';
  if (i.lines_involved) return 'Wires are involved: tell the caller to stay clear and call the utility. Don’t send a crew until the utility clears it.';
  return null;
}
