'use client';

import { openDB, type IDBPDatabase } from 'idb';

/**
 * The offline outbox (the pattern from Flake's driver app). Every action is written to IndexedDB first, then sent:
 * photos first (actions refer to them), then actions in order. The server is idempotent on client ids, so a flush
 * can repeat safely; an action the server can't apply yet ("retry") stays queued; one it refuses is set aside, never
 * silently dropped.
 */
export interface QueuedOp { seq?: number; scope: string; op: { clientId: string; type: string; payload: unknown } }
export interface QueuedPhoto { clientId: string; scope: string; bytes: ArrayBuffer; type: string; meta: Record<string, string> }

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  dbp ??= openDB('tree-ops-outbox', 1, {
    upgrade(d) {
      d.createObjectStore('ops', { keyPath: 'seq', autoIncrement: true });
      d.createObjectStore('photos', { keyPath: 'clientId' });
      d.createObjectStore('kv');
      d.createObjectStore('rejected', { keyPath: 'clientId' });
    },
  });
  return dbp;
}

export const kvGet = async <T,>(key: string) => (await (await db()).get('kv', key)) as T | undefined;
export const kvSet = async (key: string, value: unknown) => void (await (await db()).put('kv', value, key));

/** One atomic write: ops, an optional photo, and the screen's local state commit together or not at all. */
export async function commit(scope: string, opts: { ops?: QueuedOp['op'][]; photo?: { clientId: string; blob: Blob; meta: Record<string, string> }; local?: { key: string; value: unknown } }) {
  const bytes = opts.photo ? await opts.photo.blob.arrayBuffer() : null;
  const tx = (await db()).transaction(['ops', 'photos', 'kv'], 'readwrite');
  const quiet = (p: Promise<unknown>) => void p.catch(() => {});
  for (const op of opts.ops ?? []) quiet(tx.objectStore('ops').add({ scope, op } satisfies QueuedOp));
  if (opts.photo) quiet(tx.objectStore('photos').put({ clientId: opts.photo.clientId, scope, bytes: bytes!, type: opts.photo.blob.type || 'image/jpeg', meta: opts.photo.meta } satisfies QueuedPhoto));
  if (opts.local) quiet(tx.objectStore('kv').put(opts.local.value, opts.local.key));
  await tx.done;
}

export async function pendingCount(scope: string) {
  const d = await db();
  const ops = ((await d.getAll('ops')) as QueuedOp[]).filter((o) => o.scope === scope).length;
  const photos = ((await d.getAll('photos')) as QueuedPhoto[]).filter((p) => p.scope === scope).length;
  return { ops, photos, total: ops + photos };
}

export async function rejectedList(scope: string) {
  return ((await (await db()).getAll('rejected')) as { clientId: string; scope: string; message: string; op?: QueuedOp['op'] }[]).filter((r) => r.scope === scope);
}

let flushing = false;
export type FlushResult = 'idle' | 'synced' | 'offline' | 'gone' | 'partial';

/**
 * Sends everything for a scope. `photoUrl` takes multipart uploads; `syncUrl` takes `{ops}` and answers
 * `{applied, dupes, rejected, retry}`. A 410 means the link ended.
 */
export async function flush(scope: string, urls: { photoUrl: string; syncUrl: string }): Promise<FlushResult> {
  if (flushing) return 'idle';
  flushing = true;
  try {
    const d = await db();
    const photos = ((await d.getAll('photos')) as QueuedPhoto[]).filter((p) => p.scope === scope);
    const ops = ((await d.getAll('ops')) as QueuedOp[]).filter((o) => o.scope === scope);
    if (!photos.length && !ops.length) return 'synced';
    let waiting = false;
    for (const p of photos) {
      const form = new FormData();
      for (const [k, v] of Object.entries(p.meta)) form.set(k, v);
      form.set('clientId', p.clientId);
      form.set('file', new Blob([p.bytes], { type: p.type }), `${p.clientId}.jpg`);
      const res = await fetch(urls.photoUrl, { method: 'POST', body: form, signal: AbortSignal.timeout(180_000) });
      if (res.status === 410) return 'gone';
      if (res.ok) await d.delete('photos', p.clientId);
      else if (res.status === 422 || res.status === 413) {
        const msg = ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? 'Photo refused';
        await d.put('rejected', { clientId: p.clientId, scope, message: msg });
        await d.delete('photos', p.clientId);
      } else waiting = true;
    }
    for (let i = 0; i < ops.length; i += 50) {
      const batch = ops.slice(i, i + 50);
      const res = await fetch(urls.syncUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: batch.map((b) => b.op) }), signal: AbortSignal.timeout(30_000) });
      if (res.status === 410) return 'gone';
      if (!res.ok) return 'partial';
      const out = (await res.json()) as { applied: string[]; dupes: string[]; rejected: { clientId: string; message: string }[]; retry: string[] };
      const done = new Set([...out.applied, ...out.dupes]);
      for (const b of batch) {
        const rej = out.rejected.find((r) => r.clientId === b.op.clientId);
        if (rej) {
          await d.put('rejected', { clientId: b.op.clientId, scope, message: rej.message, op: b.op });
          await d.delete('ops', b.seq!);
        } else if (done.has(b.op.clientId)) await d.delete('ops', b.seq!);
        else waiting = true;
      }
    }
    return waiting ? 'partial' : 'synced';
  } catch {
    return 'offline';
  } finally {
    flushing = false;
  }
}
