import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { required } from './env';

/** Private buckets; the server uploads and hands out 10-minute signed links (docs/SPEC.md section 7). */
export type Bucket = 'photos' | 'signatures' | 'docs' | 'packets';

let client: SupabaseClient | null = null;
const storage = () => {
  client ??= createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  return client.storage;
};

export async function put(bucket: Bucket, path: string, bytes: Uint8Array, contentType: string) {
  const { error } = await storage().from(bucket).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function get(bucket: Bucket, path: string): Promise<Uint8Array | null> {
  const { data, error } = await storage().from(bucket).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function signedUrl(bucket: Bucket, path: string, seconds = 600): Promise<string | null> {
  const { data } = await storage().from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export async function signedUrls(bucket: Bucket, paths: string[], seconds = 600): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data } = await storage().from(bucket).createSignedUrls(paths, seconds);
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}
