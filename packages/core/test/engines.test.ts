import { describe, expect, it } from 'vitest';
import {
  billingFlags, copyDaysLeft, dayRange, DEFAULT_SETTINGS, electricalGate, equipmentConflict, estimateVsActual, inQuietHours, invoiceFromJob,
  nextSendTime, paymentFee, personHours, phcRecord, preworkGate, prettyPhone, priceEstimate, profileFor, render, requiredChecks, requiredLevel,
  sendProblems, settingsOf, stormTriage, toCents, toE164, triageAdvice, weatherFlags, zonedToUtc, dollars, shortDollars, hoursToService, localParts,
  type PreworkRule, type PriceOption, type WeatherHour,
} from '../src/index';
import { canonicalJson, manifestHash, sortPhotos } from '../src/proof';

const opt = (id: string, lines: PriceOption['lines'], extra: Partial<PriceOption> = {}): PriceOption => ({ id, name: id, required: false, selected: false, lines, ...extra });
const line = (id: string, cents: number, extra: Partial<PriceOption['lines'][number]> = {}) => ({ id, kind: 'remove' as const, description: id, qty: 1, unit: 'each' as const, unit_price_cents: cents, ...extra });

describe('priceEstimate', () => {
  const options = [opt('base', [line('a', 120000), line('b', 30000, { qty: 2 })], { required: true }), opt('grind', [line('g', 25000, { kind: 'stump_grind' })]), opt('prune', [line('p', 40000)], { selected: true })];
  it('counts required and selected options, and each option total', () => {
    const r = priceEstimate(options, { min_job_cents: 0 }, 0);
    expect(r.optionTotals).toEqual({ base: 180000, grind: 25000, prune: 40000 });
    expect(r.totalCents).toBe(220000);
  });
  it('uses the customer choice when given, still including required', () => {
    expect(priceEstimate(options, { min_job_cents: 0 }, 0, new Set(['grind'])).totalCents).toBe(205000);
  });
  it('applies the minimum job charge and the deposit', () => {
    const r = priceEstimate([opt('x', [line('x', 10000)], { required: true })], { min_job_cents: 25000 }, 50);
    expect(r).toMatchObject({ workCents: 10000, minimumTopUpCents: 15000, totalCents: 25000, depositCents: 12500 });
  });
  it('rounds fractional quantities and clamps deposit percent', () => {
    const r = priceEstimate([opt('x', [line('x', 9999, { qty: 1.5 })], { required: true })], { min_job_cents: 0 }, 150);
    expect(r.totalCents).toBe(14999);
    expect(r.depositCents).toBe(14999);
  });
  it('an empty estimate costs nothing (no minimum on nothing)', () => {
    expect(priceEstimate([], { min_job_cents: 25000 }, 10).totalCents).toBe(0);
  });
});

describe('sendProblems', () => {
  it('blocks a removal with no tree or no marked photo', () => {
    const o = [opt('o', [line('Remove oak', 1000), line('Remove pine', 1000, { tree_id: 't1' }), line('Remove elm', 1000, { tree_id: 't2' })], { required: true })];
    const p = sendProblems(o, new Set(['t2']));
    expect(p).toHaveLength(2);
    expect(p[0]).toMatch(/isn't tied/);
    expect(p[1]).toMatch(/photo/);
  });
  it('needs a line and something included', () => {
    expect(sendProblems([], new Set())).toEqual(['Add at least one line.', 'Mark at least one option as required or included.']);
    expect(sendProblems([opt('o', [line('Prune', 100, { kind: 'prune' })], { required: true })], new Set())).toEqual([]);
  });
});

describe('estimateVsActual', () => {
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 4, 4, h, m)).toISOString();
  it('sums person-hours from arrive/leave and pauses', () => {
    const ev = [
      { worker_id: 'a', kind: 'arrive', at: at(12) }, { worker_id: 'a', kind: 'pause', at: at(14) }, { worker_id: 'a', kind: 'resume', at: at(14, 30) }, { worker_id: 'a', kind: 'leave', at: at(16, 30) },
      { worker_id: 'b', kind: 'arrive', at: at(12) }, { worker_id: 'b', kind: 'leave', at: at(15) },
      { worker_id: null, kind: 'note', at: at(13) },
    ];
    expect(personHours(ev)).toBe(7);
    const v = estimateVsActual([{ est_crew_hours: 4 }, { est_crew_hours: '1' }], [...ev, { worker_id: null, kind: 'equipment_hours', at: at(16), value: 3, equipment_id: 'chipper' }]);
    expect(v).toEqual({ estHours: 5, actualHours: 7, variancePct: 40, byEquipment: { chipper: 3 } });
  });
  it('never guesses a missing leave forward, and handles no estimate', () => {
    expect(personHours([{ worker_id: 'a', kind: 'arrive', at: at(12) }])).toBe(0);
    expect(estimateVsActual([], []).variancePct).toBeNull();
  });
});

describe('equipment', () => {
  const d = (h: number) => new Date(Date.UTC(2026, 4, 4, h));
  it('finds overlaps, allows touching ranges, ignores the same job day', () => {
    const existing = [{ equipment_id: 'crane', job_day_id: 'j1', start: d(12), end: d(20) }];
    expect(equipmentConflict(existing, [{ equipment_id: 'crane', start: d(19), end: d(22) }])).toHaveLength(1);
    expect(equipmentConflict(existing, [{ equipment_id: 'crane', start: d(20), end: d(22) }])).toHaveLength(0);
    expect(equipmentConflict(existing, [{ equipment_id: 'chipper', start: d(12), end: d(20) }])).toHaveLength(0);
    expect(equipmentConflict(existing, [{ equipment_id: 'crane', job_day_id: 'j1', start: d(12), end: d(20) }])).toHaveLength(0);
  });
  it('converts local start times across daylight saving', () => {
    expect(zonedToUtc('2026-07-01', '07:30', 'America/New_York').toISOString()).toBe('2026-07-01T11:30:00.000Z');
    expect(zonedToUtc('2026-01-05', '07:30', 'America/New_York').toISOString()).toBe('2026-01-05T12:30:00.000Z');
    const r = dayRange('2026-07-01', '07:00', 8.5, 'America/Chicago');
    expect([r.start.toISOString(), r.end.toISOString()]).toEqual(['2026-07-01T12:00:00.000Z', '2026-07-01T20:30:00.000Z']);
    expect(localParts(new Date('2026-07-01T03:30:00Z'), 'America/New_York')).toEqual({ day: '2026-06-30', hour: 23 });
  });
  it('service hours left', () => {
    expect(hoursToService({ hour_meter: 480, service_every_hours: 100, last_service_hours: 400 })).toBe(20);
    expect(hoursToService({ hour_meter: 480, service_every_hours: null, last_service_hours: 400 })).toBeNull();
  });
});

describe('weatherFlags', () => {
  const hour = (h: number, x: Partial<WeatherHour> = {}): WeatherHour => ({ t: `2026-05-04T${String(h).padStart(2, '0')}:00`, hour: h, gust_mph: 10, thunder_pct: 0, precip_in: 0, apparent_f: 70, ...x });
  const day = Array.from({ length: 24 }, (_, h) => hour(h));
  const t = DEFAULT_SETTINGS.weather;
  it('quiet day has no flags', () => {
    expect(weatherFlags(day, t, { lift: true, startHour: 7, endHour: 17 })).toEqual([]);
  });
  it('flags gusts with the lower limit for lifts only', () => {
    const windy = day.map((h) => (h.hour === 10 ? { ...h, gust_mph: 28 } : h));
    expect(weatherFlags(windy, t, { lift: true, startHour: 7, endHour: 17 }).map((f) => f.kind)).toEqual(['wind_gust']);
    expect(weatherFlags(windy, t, { lift: false, startHour: 7, endHour: 17 })).toEqual([]);
  });
  it('ignores weather outside work hours', () => {
    const night = day.map((h) => (h.hour === 2 ? { ...h, thunder_pct: 90 } : h));
    expect(weatherFlags(night, t, { lift: false, startHour: 7, endHour: 17 })).toEqual([]);
  });
  it('flags thunder, 3-hour rain and heat', () => {
    const bad = day.map((h) => (h.hour === 9 ? { ...h, thunder_pct: 40, precip_in: 0.1 } : h.hour === 10 || h.hour === 11 ? { ...h, precip_in: 0.1 } : h.hour === 15 ? { ...h, apparent_f: 99 } : h));
    expect(weatherFlags(bad, t, { lift: false, startHour: 7, endHour: 17 }).map((f) => f.kind)).toEqual(['thunder', 'precip', 'heat']);
  });
  it('says unavailable instead of guessing', () => {
    expect(weatherFlags([], t, { lift: false, startHour: 7, endHour: 17 })[0]!.kind).toBe('unavailable');
    const blank = day.map((h) => ({ ...h, gust_mph: null, thunder_pct: null, precip_in: null, apparent_f: null }));
    expect(weatherFlags(blank, t, { lift: false, startHour: 7, endHour: 17 }).map((f) => f.kind)).toEqual(['unavailable']);
  });
  it('merges partial settings with defaults', () => {
    expect(settingsOf({ weather: { gust_mph_lift: 20 } }).weather).toMatchObject({ gust_mph_lift: 20, thunder_pct: 30 });
    expect(settingsOf(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('pre-work', () => {
  const rules: PreworkRule[] = [
    { state_code: null, city: null, kind: '811', trigger: { line_kinds: ['stump_grind', 'clearing'] }, lead_days: 2, valid_days: null, source_note: 'shared', verified: false },
    { state_code: 'OH', city: null, kind: '811', trigger: { line_kinds: ['stump_grind', 'clearing'] }, lead_days: 2, valid_days: null, source_note: 'ohio', verified: true },
    { state_code: null, city: null, kind: 'utility_line', trigger: { near_lines: ['service_le_750v', 'dist_le_35kv', 'gt_35kv'] }, lead_days: null, valid_days: null, source_note: 'lines', verified: false },
    { state_code: 'GA', city: 'Atlanta', kind: 'permit', trigger: { min_dbh_in: 6, pine_min_dbh_in: 12, line_kinds: ['remove'] }, lead_days: null, valid_days: null, source_note: 'atl', verified: true },
  ];
  const trees = [{ id: 'oak', dbh_in: 8, near_lines: 'none' as const, label: 'Tree 1' }, { id: 'pine', dbh_in: 10, near_lines: 'service_le_750v' as const, is_pine: true, label: 'Tree 2' }];
  it('picks the most specific 811 rule and adds the line check', () => {
    const r = requiredChecks({ lines: [{ kind: 'stump_grind', tree_id: 'oak' }], trees, property: { state_code: 'oh', city: 'Kent' }, rules });
    expect(r.map((c) => [c.kind, c.source_note])).toEqual([['811', 'ohio'], ['utility_line', 'lines']]);
  });
  it('Atlanta permit by trunk size, with the pine threshold', () => {
    const atl = { state_code: 'GA', city: 'atlanta ' };
    expect(requiredChecks({ lines: [{ kind: 'remove', tree_id: 'pine' }], trees: [trees[1]!], property: atl, rules }).map((c) => c.kind)).toEqual(['utility_line']);
    const r = requiredChecks({ lines: [{ kind: 'remove', tree_id: 'oak' }], trees, property: atl, rules });
    expect(r.map((c) => c.kind)).toEqual(['permit', 'utility_line']);
    expect(r[0]!.reason).toMatch(/8 in DBH/);
    expect(requiredChecks({ lines: [{ kind: 'prune', tree_id: 'oak' }], trees: [trees[0]!], property: atl, rules })).toEqual([]);
  });
  it('adds an HOA check when the property has one', () => {
    expect(requiredChecks({ lines: [], trees: [], property: { state_code: 'OH', city: null, hoa_name: 'Maple Glen' }, rules }).map((c) => c.kind)).toEqual(['hoa']);
  });
  it('gates scheduling until checks clear or are overridden with a reason', () => {
    expect(preworkGate([{ kind: '811', status: 'needed' }]).ok).toBe(false);
    expect(preworkGate([{ kind: '811', status: 'requested' }]).blocking[0]!.why).toMatch(/Requested/);
    expect(preworkGate([{ kind: '811', status: 'cleared' }, { kind: 'hoa', status: 'not_required' }]).ok).toBe(true);
    expect(preworkGate([{ kind: '811', status: 'overridden', override_reason: 'short' }]).ok).toBe(false);
    expect(preworkGate([{ kind: '811', status: 'overridden', override_reason: 'Customer marked lines; utility confirmed.' }]).ok).toBe(true);
    expect(preworkGate([{ kind: '811', status: 'cleared', valid_until: '2026-05-01T00:00:00Z' }], '2026-05-04').ok).toBe(false);
    expect(preworkGate([{ kind: '811', status: 'cleared', valid_until: '2026-05-10T00:00:00Z' }], '2026-05-04').ok).toBe(true);
  });
});

describe('electrical gate', () => {
  it('takes the worst line near any tree', () => {
    expect(requiredLevel([{ near_lines: 'none' }, { near_lines: 'service_le_750v' }])).toEqual({ level: 2, needsAbatement: false, worst: 'service_le_750v' });
    expect(requiredLevel([{ near_lines: 'gt_35kv' }])).toMatchObject({ level: 3, needsAbatement: true });
    expect(requiredLevel([]).level).toBe(1);
  });
  it('blocks when nobody on site is qualified or the plan is missing', () => {
    expect(electricalGate({ level: 2, needsAbatement: false }, [{ electrical_level: 1 }], null).ok).toBe(false);
    expect(electricalGate({ level: 2, needsAbatement: false }, [{ electrical_level: 1 }, { electrical_level: 3 }], null).ok).toBe(true);
    expect(electricalGate({ level: 3, needsAbatement: true }, [{ electrical_level: 3 }], null).reason).toMatch(/abatement/);
    expect(electricalGate({ level: 3, needsAbatement: true }, [{ electrical_level: 3 }], 'docs/plan.pdf').ok).toBe(true);
    expect(electricalGate({ level: 1, needsAbatement: false }, [], null).ok).toBe(false);
  });
});

describe('invoice and flags', () => {
  const options = [
    opt('base', [line('L1', 120000, { tree_id: 't1' }), line('L2', 50000, { tree_id: 't2', kind: 'prune' }), line('haul', 20000, { kind: 'disposal' })], { required: true }),
    opt('grind', [line('G', 30000, { tree_id: 't1', kind: 'stump_grind' })], { selected: false }),
  ];
  const cos = [
    { id: 'c1', description: 'Extra limb', amount_cents: 15000, status: 'signed' as const },
    { id: 'c2', description: 'Shrub', amount_cents: 9000, status: 'proposed' as const },
    { id: 'c3', description: 'Fence', amount_cents: 5000, status: 'declined' as const },
  ];
  it('bills chosen options plus signed change orders only, less deposit', () => {
    const inv = invoiceFromJob({ options, minJobCents: 0, changeOrders: cos, depositsPaidCents: 50000 });
    expect(inv.lines.map((l) => l.source_id)).toEqual(['L1', 'L2', 'haul', 'c1']);
    expect(inv).toMatchObject({ subtotalCents: 205000, depositAppliedCents: 50000, totalCents: 155000 });
    expect(inv.lines.some((l) => l.source_id === 'c2')).toBe(false);
  });
  it('adds the minimum and never applies more deposit than owed', () => {
    const inv = invoiceFromJob({ options: [opt('o', [line('x', 5000)], { required: true })], minJobCents: 25000, changeOrders: [], depositsPaidCents: 99999 });
    expect(inv.lines.at(-1)).toMatchObject({ source: 'adjustment', amount_cents: 20000 });
    expect(inv).toMatchObject({ subtotalCents: 25000, depositAppliedCents: 25000, totalCents: 0 });
  });
  it('flags unconfirmed, skipped, partial, no-photo trees, hours and unsigned change orders', () => {
    const t0 = '2026-05-04T12:00:00Z';
    const flags = billingFlags({
      options: [opt('o', [line('A', 1, { tree_id: 'a' }), line('B', 1, { tree_id: 'b' }), line('C', 1, { tree_id: 'c' }), line('D', 1, { tree_id: 'd' }), line('E', 1, { tree_id: 'e' }), line('haul', 1, { kind: 'disposal' })], { required: true }), opt('skip-me', [line('Z', 1, { tree_id: 'z' })])],
      confirmations: [
        { line_id: 'B', result: 'skipped', after_photo_id: null, at: t0 },
        { line_id: 'C', result: 'done', after_photo_id: 'p', at: t0 },
        { line_id: 'D', result: 'partial', after_photo_id: 'p', at: t0 },
        { line_id: 'E', result: 'skipped', after_photo_id: null, at: t0 },
        { line_id: 'E', result: 'done', after_photo_id: null, at: '2026-05-04T13:00:00Z' },
      ],
      estHours: 10, actualHours: 16, changeOrders: cos,
    });
    expect(flags.map((f) => f.code)).toEqual(['tree_not_confirmed', 'skipped_tree_billed', 'partial_tree_billed', 'no_after_photo', 'hours_over_150pct', 'unsigned_co_excluded']);
    expect(flags.map((f) => f.line_id)).toEqual(['A', 'B', 'D', 'E', undefined, undefined]);
  });
  it('a clean job has no flags', () => {
    expect(billingFlags({ options: [opt('o', [line('A', 1, { tree_id: 'a' })], { required: true })], confirmations: [{ line_id: 'A', result: 'done', after_photo_id: 'p', at: '2026-05-04T12:00:00Z' }], estHours: 4, actualHours: 6, changeOrders: [] })).toEqual([]);
  });
});

describe('proof manifest', () => {
  it('same data gives the same hash regardless of key order and date objects', () => {
    const a = { job: { id: 'j', at: new Date('2026-05-04T12:00:00Z') }, photos: [1, 2], skip: undefined };
    const b = { photos: [1, 2], job: { at: '2026-05-04T12:00:00.000Z', id: 'j' } };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(manifestHash(a)).toBe(manifestHash(b));
    expect(manifestHash(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(manifestHash({ ...b, photos: [2, 1] })).not.toBe(manifestHash(b));
    expect(canonicalJson({ n: Number.NaN })).toBe('{"n":null}');
  });
  it('sorts photos by time then id', () => {
    const p = sortPhotos([{ id: 'b', taken_at: '2026-01-01T00:00:00Z' }, { id: 'a', taken_at: '2026-01-01T00:00:00Z' }, { id: 'c', taken_at: '2025-01-01T00:00:00Z' }]);
    expect(p.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('PHC records', () => {
  const full = { product_name: 'DEMO Shield', epa_reg_no: 'DEMO-1001', total_amount: 2, amount_unit: 'gal', site_desc: 'Front yard oaks', applied_on: '2026-05-04', applicator_name: 'R. Diaz', applicator_license_no: 'OH-1', is_rup: false };
  it('federal fields, with Ohio adding concentration and the same-day rule', () => {
    expect(phcRecord(full, 'TX').problems).toEqual([]);
    expect(phcRecord(full, 'TX').profile.verified).toBe(false);
    const oh = phcRecord({ ...full, recorded_on: '2026-05-05' }, 'OH');
    expect(oh.missingFields).toEqual(['concentration']);
    expect(oh.problems).toHaveLength(2);
    expect(oh.copyRequired).toBe(true);
    expect(phcRecord({ ...full, concentration: '1 oz/gal', recorded_on: '2026-05-04' }, 'oh').problems).toEqual([]);
    expect(phcRecord({ ...full, epa_reg_no: ' ', total_amount: 0 }, 'US').missingFields).toEqual(['epa_reg_no', 'total_amount']);
  });
  it('copy deadline: 30 days, only when a copy is required', () => {
    expect(copyDaysLeft('2026-05-01', '2026-05-26', profileFor('OH'), false)).toBe(5);
    expect(copyDaysLeft('2026-05-01', '2026-06-05', profileFor('OH'), false)).toBe(-5);
    expect(copyDaysLeft('2026-05-01', '2026-05-26', profileFor('TX'), false)).toBeNull();
    expect(copyDaysLeft('2026-05-01', '2026-05-26', profileFor('TX'), true)).toBe(5);
  });
});

describe('storm triage', () => {
  it('orders by danger then age', () => {
    const base = { injury: false, lines_involved: false, on_structure: false, blocking_access: false };
    const list = [
      { id: 'old-block', ...base, blocking_access: true, created_at: '2026-01-01T01:00:00Z' },
      { id: 'house', ...base, on_structure: true, created_at: '2026-01-01T03:00:00Z' },
      { id: 'wire', ...base, lines_involved: true, created_at: '2026-01-01T04:00:00Z' },
      { id: 'hurt', ...base, injury: true, created_at: '2026-01-01T05:00:00Z' },
      { id: 'new-block', ...base, blocking_access: true, created_at: '2026-01-01T02:00:00Z' },
      { id: 'yard', ...base, created_at: '2026-01-01T00:00:00Z' },
    ];
    expect(stormTriage(list).map((x) => x.id)).toEqual(['hurt', 'wire', 'house', 'old-block', 'new-block', 'yard']);
    expect(triageAdvice(list[2]!)).toMatch(/utility/);
    expect(triageAdvice(list[0]!)).toBeNull();
  });
});

describe('fees, money, messages', () => {
  it('fee is rate capped, nothing on refunds or own processor', () => {
    expect(paymentFee(100000, 'free')).toBe(1000);
    expect(paymentFee(500000, 'free')).toBe(1500);
    expect(paymentFee(500000, 'pro')).toBe(1000);
    expect(paymentFee(-5000, 'free')).toBe(0);
    expect(paymentFee(500000, 'enterprise', true)).toBe(0);
    expect(paymentFee(149, 'free')).toBe(1);
  });
  it('money', () => {
    expect(dollars(123456)).toBe('$1,234.56');
    expect(dollars(-50)).toBe('-$0.50');
    expect(shortDollars(150000)).toBe('$1,500');
    expect(shortDollars(1250)).toBe('$12.50');
    expect(toCents('$1,250.5')).toBe(125050);
    expect(toCents('abc')).toBeNull();
    expect(toCents('')).toBeNull();
  });
  it('renders templates in both languages', () => {
    expect(render('estimate_sent', 'en', { company: 'Maple', link: 'https://x' })).toBe('Maple: your tree estimate is ready. View and approve: https://x. Reply STOP to opt out.');
    expect(render('scheduled', 'es', { company: 'Maple', date: 'lunes 4 de mayo' })).toMatch(/^Maple: su trabajo de árboles está programado para el lunes 4 de mayo/);
  });
  it('quiet hours wrap midnight', () => {
    const s = { quiet_start_hour: 21, quiet_end_hour: 8 };
    expect(inQuietHours(new Date('2026-05-04T02:00:00Z'), 'America/New_York', s)).toBe(true);
    expect(inQuietHours(new Date('2026-05-04T16:00:00Z'), 'America/New_York', s)).toBe(false);
    expect(nextSendTime(new Date('2026-05-04T02:30:00Z'), 'America/New_York', s).toISOString()).toBe('2026-05-04T12:00:00.000Z');
  });
  it('phones', () => {
    expect(prettyPhone('+12165550100')).toBe('(216) 555-0100');
    expect(toE164('(216) 555-0100')).toBe('+12165550100');
    expect(toE164('555-0100')).toBeNull();
  });
});
