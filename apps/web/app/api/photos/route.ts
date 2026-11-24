import { asUser, requireApi, SELLERS } from '@/lib/auth';
import { fail, isUuid, route } from '@/lib/http';
import { readPhotoForm, savePhoto } from '@/lib/photos';

const KINDS = ['estimate', 'damage_pre', 'damage_post', 'claim', 'other'] as const;

/** Office photo upload (multipart): estimate photos from the sales arborist, claim photos. Idempotent on clientId. */
export const POST = route(async (req) => {
  const ctx = await requireApi(SELLERS);
  const { bytes, contentType, fields } = await readPhotoForm(req);
  if (!isUuid(fields.clientId ?? '') || !isUuid(fields.propertyId ?? '')) fail('validation', 'Missing photo or property id.');
  const kind = (KINDS as readonly string[]).includes(fields.kind ?? '') ? (fields.kind as (typeof KINDS)[number]) : 'estimate';
  // RLS check that the property and estimate are this user's company's.
  await asUser(ctx, async (tx) => {
    const [p] = await tx`select id from properties where id = ${fields.propertyId!}`;
    if (!p) fail('not_found', 'Property not found.');
    if (fields.estimateId) {
      const [e] = await tx`select id from estimates where id = ${fields.estimateId} and property_id = ${fields.propertyId!}`;
      if (!e) fail('not_found', 'Estimate not found.');
    }
  });
  const takenAt = fields.takenAt ? new Date(fields.takenAt) : new Date();
  const out = await savePhoto(
    { tenantId: ctx.tenantId, clientId: fields.clientId!, kind, propertyId: fields.propertyId!, estimateId: fields.estimateId || null, treeId: isUuid(fields.treeId ?? '') ? fields.treeId! : null, takenAt: isNaN(+takenAt) ? new Date() : takenAt, lat: fields.lat ? Number(fields.lat) : null, lon: fields.lon ? Number(fields.lon) : null },
    bytes,
    contentType,
  );
  return out;
});
