import { createHash } from 'node:crypto';

/**
 * Canonical JSON (docs/SPEC.md section 11, proofManifest): keys sorted, dates as UTC ISO strings, undefined dropped.
 * The same data always gives the same bytes, so the same hash.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined) out[k] = normalize(x);
    }
    return out;
  }
  if (typeof v === 'number' && !Number.isFinite(v)) return null;
  return v;
}

export const sha256Hex = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

export interface ManifestPhoto { id: string; kind: string; sha256: string; taken_at: string | Date; tree_id: string | null; lat: number | null; lon: number | null }

/** Photos sorted by when they were taken, then id, so the order never depends on the database. */
export const sortPhotos = <T extends { taken_at: string | Date; id: string }>(photos: T[]) =>
  [...photos].sort((a, b) => +new Date(a.taken_at) - +new Date(b.taken_at) || a.id.localeCompare(b.id));

export function manifestHash(manifest: unknown): string {
  return sha256Hex(canonicalJson(manifest));
}
