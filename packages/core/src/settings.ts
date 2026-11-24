/** Company settings kept in tenants.settings. Every number is the company's own choice, never a regulation. */
export interface WeatherThresholds {
  /** Gust at or above this (mph) flags crane and bucket work. */
  gust_mph_lift: number;
  /** Gust at or above this (mph) flags climbing and everything else. */
  gust_mph_climb: number;
  /** Chance of thunder at or above this (%) in work hours. */
  thunder_pct: number;
  /** Rain over any 3 work hours at or above this (inches). */
  precip_in_3h: number;
  /** Feels-like temperature at or above this (F). */
  heat_f: number;
}

export interface TenantSettings {
  weather: WeatherThresholds;
  min_job_cents: number;
  default_deposit_pct: number;
  estimate_valid_days: number;
  /** Texts wait outside these local hours (24 h clock): quiet from quiet_start_hour until quiet_end_hour. */
  quiet_start_hour: number;
  quiet_end_hour: number;
  work_start_hour: number;
  work_end_hour: number;
}

/** Starting values, labeled in the UI as the company's to change. Confirm with customers (docs/SPEC.md section 11). */
export const DEFAULT_SETTINGS: TenantSettings = {
  weather: { gust_mph_lift: 25, gust_mph_climb: 35, thunder_pct: 30, precip_in_3h: 0.25, heat_f: 95 },
  min_job_cents: 25000,
  default_deposit_pct: 0,
  estimate_valid_days: 30,
  quiet_start_hour: 21,
  quiet_end_hour: 8,
  work_start_hour: 7,
  work_end_hour: 17,
};

export function settingsOf(raw: unknown): TenantSettings {
  const r = (raw ?? {}) as Partial<TenantSettings>;
  return { ...DEFAULT_SETTINGS, ...r, weather: { ...DEFAULT_SETTINGS.weather, ...(r.weather ?? {}) } };
}
