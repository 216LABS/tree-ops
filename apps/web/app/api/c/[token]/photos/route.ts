import type { P } from '@/lib/api';
import { resolveLink } from '@/lib/crew';
import { fail, isUuid, rateLimit, route } from '@/lib/http';
import { readPhotoForm, savePhoto } from '@/lib/photos';
import { db } from '@treeops/db';

const KINDS = ['before', 'after', 'damage_pre', 'damage_post', 'disposal', 'other'] as const;

/** A crew photo (multipart), stored as received with its hash. Idempotent on clientId. */
export const POST = route<P<'token'>>(async (req, { params }) => {
  const { token } = await params;
  rateLimit(`c:${token.slice(0, 32)}`, 600);
  const s = await resolveLink(token);
  const { bytes, contentType, fields } = await readPhotoForm(req);
  if (!isUuid(fields.clientId ?? '')) fail('validation', 'Missing photo id.');
  const kind = (KINDS as readonly string[]).includes(fields.kind ?? '') ? (fields.kind as (typeof KINDS)[number]) : 'other';
  let treeId: string | null = null;
  if (isUuid(fields.treeId ?? '')) {
    const [t] = await db()`select id from trees where id = ${fields.treeId!} and property_id = ${s.propertyId} and tenant_id = ${s.tenantId}`;
    treeId = t?.id ?? null;
  }
  const takenAt = fields.takenAt ? new Date(fields.takenAt) : new Date();
  return savePhoto(
    { tenantId: s.tenantId, clientId: fields.clientId!, kind, propertyId: s.propertyId, jobDayId: s.jobDayId, treeId, takenAt: isNaN(+takenAt) ? new Date() : takenAt, lat: fields.lat ? Number(fields.lat) : null, lon: fields.lon ? Number(fields.lon) : null },
    bytes,
    contentType,
  );
});
