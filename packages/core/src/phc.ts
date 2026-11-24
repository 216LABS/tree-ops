/**
 * Pesticide application records for plant health care (docs/SPEC.md sections 2.5 and 11, phcRecord).
 * The federal profile is 7 CFR 110.3. Ohio (OAC 901:5-11-10) adds concentration and requires the record on the day of
 * the application. Florida and Indiana are known only to require the customer copy within 30 days. Other states fall
 * back to the federal profile until checked (marked [T] in the spec).
 */
export interface PhcApplicationIn {
  product_name: string;
  epa_reg_no: string;
  total_amount: number | null;
  amount_unit: string;
  site_desc: string;
  applied_on: string;
  applicator_name: string;
  applicator_license_no: string;
  concentration?: string | null;
  target_pest?: string | null;
  method?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  /** Local date the record was made. */
  recorded_on?: string | null;
  is_rup: boolean;
}

export interface StateProfile { code: string; label: string; required: (keyof PhcApplicationIn)[]; sameDay: boolean; copyDays: number | null; copyAll: boolean; verified: boolean; source: string }

const FEDERAL: (keyof PhcApplicationIn)[] = ['product_name', 'epa_reg_no', 'total_amount', 'amount_unit', 'site_desc', 'applied_on', 'applicator_name', 'applicator_license_no'];

export const PROFILES: Record<string, StateProfile> = {
  US: { code: 'US', label: 'Federal (7 CFR 110.3)', required: FEDERAL, sameDay: false, copyDays: 30, copyAll: false, verified: true, source: '7 CFR 110.3: record within 14 days; copy to the customer within 30 days of a restricted-use application.' },
  OH: { code: 'OH', label: 'Ohio (OAC 901:5-11-10)', required: [...FEDERAL, 'concentration'], sameDay: true, copyDays: 30, copyAll: true, verified: true, source: 'OAC 901:5-11-10: record in English on the date of application, with concentration and total volume; copy to the customer within 30 days; employers keep records 3 years.' },
  FL: { code: 'FL', label: 'Florida', required: FEDERAL, sameDay: false, copyDays: 30, copyAll: false, verified: true, source: 'UF/IFAS: restricted-use records go to the customer within 30 days. Other fields follow federal until checked.' },
  IN: { code: 'IN', label: 'Indiana (355 IAC 4-4-1)', required: FEDERAL, sameDay: false, copyDays: 30, copyAll: false, verified: true, source: '355 IAC 4-4-1: customer copy within 30 days. Other fields follow federal until checked.' },
};

export const profileFor = (state: string): StateProfile => PROFILES[state.toUpperCase()] ?? { ...PROFILES.US!, code: state.toUpperCase(), label: `${state.toUpperCase()} (federal fields until checked)`, verified: false };

export const FIELD_WORDS: Partial<Record<keyof PhcApplicationIn, string>> = {
  product_name: 'Product', epa_reg_no: 'EPA registration number', total_amount: 'Total amount', amount_unit: 'Unit', site_desc: 'Where it was applied',
  applied_on: 'Date applied', applicator_name: 'Applicator', applicator_license_no: 'Applicator license number', concentration: 'Concentration or dilution',
};

export function phcRecord(app: PhcApplicationIn, state: string): { profile: StateProfile; missingFields: (keyof PhcApplicationIn)[]; problems: string[]; copyRequired: boolean } {
  const profile = profileFor(state);
  const missingFields = profile.required.filter((f) => {
    const v = app[f];
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (f === 'total_amount' && !(Number(v) > 0));
  });
  const problems = missingFields.map((f) => `${FIELD_WORDS[f] ?? f} is required in ${profile.label}.`);
  if (profile.sameDay && app.recorded_on && app.recorded_on !== app.applied_on) problems.push(`${profile.label} requires the record on the day of the application.`);
  return { profile, missingFields, problems, copyRequired: profile.copyAll || app.is_rup };
}

/** Days left to send the customer copy; negative when late. Null when no copy is required. */
export function copyDaysLeft(appliedOn: string, today: string, profile: StateProfile, isRup: boolean): number | null {
  if (!profile.copyDays || !(profile.copyAll || isRup)) return null;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${appliedOn}T00:00:00Z`)) / 86_400_000);
  return profile.copyDays - days;
}
