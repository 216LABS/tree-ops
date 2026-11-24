import type { WeatherThresholds } from './settings';

/** One hour of forecast at the job, in the company's local time. Missing values are null, never guessed. */
export interface WeatherHour {
  t: string;
  /** Local hour 0 to 23. */
  hour: number;
  gust_mph: number | null;
  thunder_pct: number | null;
  precip_in: number | null;
  apparent_f: number | null;
}

export type WeatherFlagKind = 'wind_gust' | 'thunder' | 'precip' | 'heat' | 'unavailable';
export interface WeatherFlag { kind: WeatherFlagKind; at: string | null; value: number | null; threshold: number | null; message: string }

/**
 * Flags for one job day (docs/SPEC.md section 11). Thresholds are the company's, not a safety standard, and the
 * messages say so by naming the company setting. `lift` jobs use the lower gust limit.
 */
export function weatherFlags(hourly: WeatherHour[], t: WeatherThresholds, opts: { lift: boolean; startHour: number; endHour: number }): WeatherFlag[] {
  const hours = hourly.filter((h) => h.hour >= opts.startHour && h.hour < opts.endHour);
  if (!hours.length) return [{ kind: 'unavailable', at: null, value: null, threshold: null, message: 'Forecast unavailable for work hours.' }];
  const out: WeatherFlag[] = [];
  const gustLimit = opts.lift ? t.gust_mph_lift : t.gust_mph_climb;
  const worst = <K extends keyof WeatherHour>(k: K) =>
    hours.reduce<WeatherHour | null>((m, h) => (h[k] !== null && (m === null || (h[k] as number) > (m[k] as number)) ? h : m), null);

  const g = worst('gust_mph');
  if (g && (g.gust_mph as number) >= gustLimit) out.push({ kind: 'wind_gust', at: g.t, value: g.gust_mph, threshold: gustLimit, message: `Gusts to ${Math.round(g.gust_mph!)} mph (your limit ${gustLimit}${opts.lift ? ' for lifts' : ''}).` });
  const th = worst('thunder_pct');
  if (th && (th.thunder_pct as number) >= t.thunder_pct) out.push({ kind: 'thunder', at: th.t, value: th.thunder_pct, threshold: t.thunder_pct, message: `${Math.round(th.thunder_pct!)}% chance of thunder (your limit ${t.thunder_pct}%).` });
  let rain: { at: string; sum: number } | null = null;
  for (let i = 0; i < hours.length; i++) {
    const window = hours.slice(i, i + 3);
    if (window.some((h) => h.precip_in === null)) continue;
    const sum = window.reduce((s, h) => s + (h.precip_in as number), 0);
    if (!rain || sum > rain.sum) rain = { at: hours[i]!.t, sum };
  }
  if (rain && rain.sum >= t.precip_in_3h) out.push({ kind: 'precip', at: rain.at, value: Math.round(rain.sum * 100) / 100, threshold: t.precip_in_3h, message: `${rain.sum.toFixed(2)} in of rain over 3 hours (your limit ${t.precip_in_3h}).` });
  const heat = worst('apparent_f');
  if (heat && (heat.apparent_f as number) >= t.heat_f) out.push({ kind: 'heat', at: heat.t, value: heat.apparent_f, threshold: t.heat_f, message: `Feels like ${Math.round(heat.apparent_f!)}°F (your limit ${t.heat_f}°F).` });
  const missing = hours.every((h) => h.gust_mph === null && h.thunder_pct === null && h.precip_in === null && h.apparent_f === null);
  if (missing) out.push({ kind: 'unavailable', at: null, value: null, threshold: null, message: 'Forecast unavailable for work hours.' });
  return out;
}

export const WEATHER_WORDS: Record<WeatherFlagKind, string> = { wind_gust: 'Wind', thunder: 'Thunder', precip: 'Rain', heat: 'Heat', unavailable: 'No forecast' };
