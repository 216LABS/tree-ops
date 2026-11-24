import { z } from 'zod';
import type { P } from '@/lib/api';
import { asUser, MANAGERS, requireApi } from '@/lib/auth';
import { parseJson, route } from '@/lib/http';
import { createCrewLink, textCrewLink } from '@/lib/jobs';

/** A fresh crew link for the day (the old one stops working). Optionally texted to the crew leader. */
export const POST = route<P<'id'>>(async (req, { params }) => {
  const ctx = await requireApi(MANAGERS);
  const { id } = await params;
  const b = await parseJson(req, z.object({ text: z.boolean().default(false) }));
  const link = await asUser(ctx, (tx) => createCrewLink(tx, ctx, id));
  const text = b.text ? await textCrewLink(ctx, id, link) : null;
  return { url: link.url, text: text?.status ?? null, smsHref: text?.smsHref ?? null };
});
