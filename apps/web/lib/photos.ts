import { db, type Q } from '@treeops/db';
import { fail } from './http';
import { put } from './storage';
import { sha256Hex } from './tokens';

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };

export interface PhotoMeta {
  tenantId: string;
  clientId: string;
  kind: 'estimate' | 'before' | 'after' | 'damage_pre' | 'damage_post' | 'disposal' | 'claim' | 'other';
  propertyId: string | null;
  estimateId?: string | null;
  jobDayId?: string | null;
  treeId?: string | null;
  takenAt: Date;
  lat?: number | null;
  lon?: number | null;
}

async function exifOf(bytes: Uint8Array): Promise<Record<string, unknown> | null> {
  try {
    const exifr = (await import('exifr')).default;
    const out = await exifr.parse(Buffer.from(bytes), { pick: ['DateTimeOriginal', 'Make', 'Model', 'latitude', 'longitude'] });
    return out ? JSON.parse(JSON.stringify(out)) : null;
  } catch {
    return null;
  }
}

/**
 * Stores a photo exactly as received and records its SHA-256 (append-only). Repeating a client id returns the first
 * row, so a retried upload never makes a second photo.
 */
export async function savePhoto(meta: PhotoMeta, bytes: Uint8Array, contentType: string, sql: Q = db()): Promise<{ id: string; sha256: string; duplicate: boolean }> {
  const [prior] = await sql`select id, sha256 from photos where client_id = ${meta.clientId} and tenant_id = ${meta.tenantId}`;
  if (prior) return { id: prior.id, sha256: prior.sha256, duplicate: true };
  if (bytes.byteLength === 0) fail('validation', 'The photo was empty.');
  if (bytes.byteLength > MAX_PHOTO_BYTES) fail('validation', 'The photo is too large. Take it again; the app shrinks it.');
  const ext = TYPES[contentType.toLowerCase()];
  if (!ext) fail('validation', 'That file type isn’t a photo this app takes.');
  const sha256 = sha256Hex(bytes);
  const yyyy = meta.takenAt.getUTCFullYear();
  const path = `${meta.tenantId}/${meta.propertyId ?? 'none'}/${yyyy}/${meta.clientId}.${ext}`;
  await put('photos', path, bytes, contentType);
  const exif = await exifOf(bytes);
  const [row] = await sql`
    insert into photos (tenant_id, property_id, estimate_id, job_day_id, tree_id, kind, storage_path, sha256, taken_at, lat, lon, exif, client_id)
    values (${meta.tenantId}, ${meta.propertyId}, ${meta.estimateId ?? null}, ${meta.jobDayId ?? null}, ${meta.treeId ?? null}, ${meta.kind}, ${path}, ${sha256},
      ${meta.takenAt}, ${meta.lat ?? null}, ${meta.lon ?? null}, ${exif ? sql.json(exif as never) : null}, ${meta.clientId})
    on conflict (client_id) do nothing returning id`;
  if (!row) {
    const [again] = await sql`select id, sha256 from photos where client_id = ${meta.clientId} and tenant_id = ${meta.tenantId}`;
    if (!again) fail('conflict', 'That photo id is already used.');
    return { id: again!.id, sha256: again!.sha256, duplicate: true };
  }
  return { id: row.id, sha256, duplicate: false };
}

/** Reads a multipart photo upload: the file plus string fields. */
export async function readPhotoForm(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) fail('validation', 'Expected a photo upload.');
  const file = form!.get('file');
  if (!(file instanceof Blob)) fail('validation', 'No photo in the upload.');
  const fields: Record<string, string> = {};
  for (const [k, v] of form!.entries()) if (typeof v === 'string') fields[k] = v;
  const blob = file as Blob;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), contentType: blob.type || 'image/jpeg', fields };
}

/** Saves a signature PNG from a data URL. */
export async function saveSignature(sql: Q, input: { tenantId: string; subjectType: 'estimate' | 'change_order' | 'briefing' | 'phc_notice'; subjectId: string; signerName: string; signerRole?: string | null; png: string; signedAt: Date; ip?: string | null; userAgent?: string | null; clientId: string }) {
  const [prior] = await sql`select id from signatures where client_id = ${input.clientId} and tenant_id = ${input.tenantId}`;
  if (prior) return prior.id as string;
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(input.png);
  if (!m) fail('validation', 'The signature didn’t come through. Sign again.');
  const bytes = new Uint8Array(Buffer.from(m![1]!, 'base64'));
  if (bytes.byteLength < 100 || bytes.byteLength > 400_000) fail('validation', 'The signature didn’t come through. Sign again.');
  const sha256 = sha256Hex(bytes);
  const path = `${input.tenantId}/${input.clientId}.png`;
  await put('signatures', path, bytes, 'image/png');
  const [row] = await sql`
    insert into signatures (tenant_id, subject_type, subject_id, signer_name, signer_role, image_path, sha256, signed_at, ip, user_agent, client_id)
    values (${input.tenantId}, ${input.subjectType}, ${input.subjectId}, ${input.signerName}, ${input.signerRole ?? null}, ${path}, ${sha256}, ${input.signedAt},
      ${input.ip ?? null}, ${input.userAgent?.slice(0, 300) ?? null}, ${input.clientId})
    returning id`;
  return row!.id as string;
}
