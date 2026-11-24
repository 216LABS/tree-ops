'use client';

import { NEAR_LINES_WORDS } from '@treeops/core/electrical';
import { dollars, toCents } from '@treeops/core/money';
import { LINE_KINDS, LINE_UNITS, lineTotal, priceEstimate, sendProblems, TREE_KINDS, type LineKind, type LineUnit } from '@treeops/core/pricing';
import { LINE_WORDS } from '@treeops/core/i18n';
import { Badge, Button, Card, Eyebrow, Input, Label, Segmented, Select, Textarea } from '@treeops/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShareLink } from '@/components/actions';
import { api, ApiError, uuid } from '@/components/client-api';
import { MapPins } from '@/components/map-pins';
import { MarkedPhoto, MarkupEditor, type MarkShape } from '@/components/markup';
import { kvGet, kvSet } from '@/components/outbox';
import { shrinkImage } from '@/lib/shrink-image';

type NearLines = 'none' | 'service_le_750v' | 'dist_le_35kv' | 'gt_35kv';
export interface DraftTree { id: string; number: number; label: string; speciesCommon: string | null; speciesLatin: string | null; dbhIn: number | null; heightFt: number | null; lat: number | null; lon: number | null; condition: string | null; nearLines: NearLines; notes: string | null }
export interface DraftLine { id: string; treeId: string | null; kind: LineKind; description: string; qty: number; unit: LineUnit; unitPriceCents: number; estCrewHours: number | null; equipmentType: string | null }
export interface DraftOption { id: string; name: string; required: boolean; selected: boolean; lines: DraftLine[] }
export interface DraftPhoto { clientId: string; serverId?: string; treeId: string | null; url: string | null; uploaded: boolean; takenAt?: string; lat?: number | null; lon?: number | null; mark: { shape: MarkShape; number: number; color: string; saved: boolean } | null }
export interface DraftState { trees: DraftTree[]; options: DraftOption[]; photos: DraftPhoto[]; depositPct: number; validUntil: string | null; notes: string | null; updatedAt: string; dirty?: boolean }
interface Head { id: string; number: number; status: string; propertyId: string; address: string; customer: string; phone: string | null; center: { lat: number; lon: number }; hasLocation: boolean }

const KEY = (id: string) => `est:${id}`;
const PHOTO = (clientId: string) => `ephoto:${clientId}`;

/**
 * The estimate builder (docs/SPEC.md screen 1). Everything saves to the phone first (IndexedDB), then syncs when there's
 * signal: trees, then photos, then the circles and numbers drawn on them, then the estimate. Each step is idempotent, so a
 * dropped connection just means it tries again. Send needs signal and a clean sync.
 */
export function Builder({ head, server, species, minJobCents, tiles }: { head: Head; server: DraftState; species: { common: string; latin: string | null; pine: boolean }[]; minJobCents: number; tiles: { url: string; attribution: string } }) {
  const [s, setS] = useState<DraftState>(server);
  const [loaded, setLoaded] = useState(false);
  const [sync, setSync] = useState<'saved' | 'syncing' | 'synced' | 'offline' | 'error'>('synced');
  const [syncErr, setSyncErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(server.trees[0]?.id ?? null);
  const [marking, setMarking] = useState<{ clientId: string; treeId: string } | null>(null);
  const [sent, setSent] = useState<{ url: string; smsHref: string | null; text: string } | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const blobUrls = useRef(new Map<string, string>());
  const markShape = useRef<MarkShape | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncing = useRef(false);
  const latest = useRef(s);
  latest.current = s;

  // Load the phone's copy: if it has unsynced changes newer than the server, it wins.
  useEffect(() => {
    void kvGet<DraftState>(KEY(head.id)).then(async (local) => {
      if (local && local.dirty) {
        for (const p of local.photos.filter((x) => !x.uploaded)) {
          const bytes = await kvGet<ArrayBuffer>(PHOTO(p.clientId));
          if (bytes) blobUrls.current.set(p.clientId, URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' })));
        }
        setS(local);
        setSync('saved');
      }
      setLoaded(true);
    });
  }, [head.id]);

  const runSync = useCallback(async () => {
    if (syncing.current) return;
    if (!navigator.onLine) return setSync('offline');
    syncing.current = true;
    setSync('syncing');
    setSyncErr(null);
    try {
      let cur = latest.current;
      for (const t of cur.trees) {
        await api(`/api/trees/${t.id}`, { method: 'PUT', body: { propertyId: head.propertyId, number: t.number, label: t.label, speciesCommon: t.speciesCommon, speciesLatin: t.speciesLatin, dbhIn: t.dbhIn, heightFt: t.heightFt, lat: t.lat, lon: t.lon, condition: t.condition, nearLines: t.nearLines, notes: t.notes } });
      }
      for (const p of cur.photos) {
        if (p.uploaded) continue;
        const bytes = await kvGet<ArrayBuffer>(PHOTO(p.clientId));
        if (!bytes) continue;
        const form = new FormData();
        form.set('file', new Blob([bytes], { type: 'image/jpeg' }), `${p.clientId}.jpg`);
        form.set('clientId', p.clientId);
        form.set('propertyId', head.propertyId);
        form.set('estimateId', head.id);
        form.set('kind', 'estimate');
        if (p.treeId) form.set('treeId', p.treeId);
        if (p.takenAt) form.set('takenAt', p.takenAt);
        if (p.lat != null) form.set('lat', String(p.lat));
        if (p.lon != null) form.set('lon', String(p.lon));
        const res = await fetch('/api/photos', { method: 'POST', body: form });
        const out = (await res.json()) as { id?: string; error?: { message: string } };
        if (!res.ok) throw new ApiError('photo', out.error?.message ?? 'A photo didn’t upload.');
        cur = { ...latest.current, photos: latest.current.photos.map((x) => (x.clientId === p.clientId ? { ...x, uploaded: true, serverId: out.id } : x)) };
        latest.current = cur;
        setS(cur);
        await kvSet(KEY(head.id), { ...cur, dirty: true });
      }
      for (const p of latest.current.photos) {
        if (!p.mark || p.mark.saved || !p.serverId || !p.treeId) continue;
        await api('/api/photo-markups', { body: { photoId: p.serverId, treeId: p.treeId, number: p.mark.number, color: p.mark.color, shape: p.mark.shape } });
        cur = { ...latest.current, photos: latest.current.photos.map((x) => (x.clientId === p.clientId ? { ...x, mark: { ...x.mark!, saved: true } } : x)) };
        latest.current = cur;
        setS(cur);
      }
      cur = latest.current;
      await api(`/api/estimates/${head.id}`, { method: 'PUT', body: { depositPct: cur.depositPct, validUntil: cur.validUntil, notes: cur.notes, options: cur.options.map((o) => ({ ...o, lines: o.lines.map((l) => ({ ...l, treeId: l.treeId || null })) })) } });
      // Only clear the dirty mark if nothing changed while we were sending.
      if (latest.current === cur) {
        await kvSet(KEY(head.id), { ...cur, dirty: false });
        setSync('synced');
      } else setSync('saved');
    } catch (e) {
      setSync(navigator.onLine ? 'error' : 'offline');
      setSyncErr(e instanceof ApiError ? e.message : 'Couldn’t sync yet. Your work is saved on this phone.');
    } finally {
      syncing.current = false;
    }
  }, [head.id, head.propertyId]);

  useEffect(() => {
    const on = () => void runSync();
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [runSync]);

  /** Every change: write to the phone right away, then sync after a short pause. */
  const update = (fn: (d: DraftState) => DraftState) => {
    setS((prev) => {
      const next = { ...fn(prev), dirty: true };
      latest.current = next;
      void kvSet(KEY(head.id), next);
      return next;
    });
    setSync('saved');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void runSync(), 1200);
  };

  const priceOpts = useMemo(() => s.options.map((o) => ({ ...o, lines: o.lines.map((l) => ({ id: l.id, kind: l.kind, description: l.description, qty: l.qty, unit: l.unit, unit_price_cents: l.unitPriceCents, tree_id: l.treeId, est_crew_hours: l.estCrewHours })) })), [s.options]);
  const priced = priceEstimate(priceOpts, { min_job_cents: minJobCents }, s.depositPct);
  const marked = new Set(s.photos.filter((p) => p.mark && p.treeId).map((p) => p.treeId!));
  const problems = sendProblems(priceOpts, marked);
  const treeById = new Map(s.trees.map((t) => [t.id, t]));

  const addTree = () => {
    const id = uuid();
    const number = Math.max(0, ...s.trees.map((t) => t.number)) + 1;
    update((d) => ({ ...d, trees: [...d.trees, { id, number, label: `Tree ${number}`, speciesCommon: null, speciesLatin: null, dbhIn: null, heightFt: null, lat: null, lon: null, condition: null, nearLines: 'none', notes: null }] }));
    setSelected(id);
  };
  const setTree = (id: string, patch: Partial<DraftTree>) => update((d) => ({ ...d, trees: d.trees.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const pinHere = (id: string) =>
    navigator.geolocation?.getCurrentPosition(
      (pos) => setTree(id, { lat: Math.round(pos.coords.latitude * 1e6) / 1e6, lon: Math.round(pos.coords.longitude * 1e6) / 1e6 }),
      () => setSyncErr('Location is off. Tap the map instead.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );

  const addPhoto = async (treeId: string, file: File) => {
    const clientId = uuid();
    const blob = await shrinkImage(file, 2048, 0.85);
    const bytes = await blob.arrayBuffer();
    await kvSet(PHOTO(clientId), bytes);
    blobUrls.current.set(clientId, URL.createObjectURL(blob));
    let lat: number | null = null;
    let lon: number | null = null;
    const t = treeById.get(treeId);
    if (t?.lat != null) [lat, lon] = [t.lat, t.lon];
    update((d) => ({ ...d, photos: [...d.photos, { clientId, treeId, url: null, uploaded: false, takenAt: new Date().toISOString(), lat, lon, mark: null }] }));
    markShape.current = null;
    setMarking({ clientId, treeId });
  };
  const photoSrc = (p: DraftPhoto) => blobUrls.current.get(p.clientId) ?? p.url;

  const addLine = (optId: string, treeId: string | null, kind: LineKind) => {
    const t = treeId ? treeById.get(treeId) : null;
    const desc = t ? `${LINE_WORDS.en[kind]} ${t.label}${t.speciesCommon ? ` (${t.speciesCommon}${t.dbhIn ? `, ${t.dbhIn} in` : ''})` : ''}` : LINE_WORDS.en[kind];
    update((d) => ({ ...d, options: d.options.map((o) => (o.id === optId ? { ...o, lines: [...o.lines, { id: uuid(), treeId, kind, description: desc, qty: 1, unit: kind === 'crane' ? 'hour' : 'each', unitPriceCents: 0, estCrewHours: null, equipmentType: kind === 'crane' ? 'crane' : kind === 'stump_grind' ? 'grinder' : null }] } : o)) }));
  };
  const setLine = (optId: string, lineId: string, patch: Partial<DraftLine>) => update((d) => ({ ...d, options: d.options.map((o) => (o.id === optId ? { ...o, lines: o.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) } : o)) }));
  const removeLine = (optId: string, lineId: string) => update((d) => ({ ...d, options: d.options.map((o) => (o.id === optId ? { ...o, lines: o.lines.filter((l) => l.id !== lineId) } : o)) }));
  const setOption = (optId: string, patch: Partial<DraftOption>) => update((d) => ({ ...d, options: d.options.map((o) => (o.id === optId ? { ...o, ...patch } : o)) }));

  const badge = { saved: ['Saved on phone', 'amber'], syncing: ['Syncing', 'blue'], synced: ['Synced', 'green'], offline: ['No signal: saved on phone', 'amber'], error: ['Not synced', 'red'] } as const;
  const pins = s.trees.filter((t) => t.lat != null).map((t) => ({ id: t.id, lat: t.lat!, lon: t.lon!, n: t.number, selected: t.id === selected }));

  if (sent) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-3xl font-semibold">Estimate {head.number} sent</h1>
        <p className="mt-2 text-muted">{sent.text === 'mock_sent' || sent.text === 'sent' || sent.text === 'queued' ? `Texted to ${head.customer}.` : sent.text === 'held_quiet_hours' ? 'It will text in the morning (quiet hours).' : 'They haven’t said OK to texts yet, so send the link yourself:'}</p>
        <ShareLink url={sent.url} smsHref={sent.smsHref} />
        <a className="mt-6 inline-block text-link underline" href={`/estimates/${head.id}`}>Back to the estimate</a>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-3xl font-semibold">Estimate {head.number}</h1>
        <Badge tone={badge[sync][1]} data-testid="sync-badge">{badge[sync][0]}</Badge>
        {!loaded ? <span className="text-sm text-muted">Loading the phone’s copy…</span> : null}
        <p className="w-full text-sm text-muted">{head.customer} · {head.address}</p>
        {syncErr ? <p className="w-full text-sm text-danger-ink" role="alert">{syncErr}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section>
          <Eyebrow className="mb-2">Map</Eyebrow>
          <MapPins tiles={tiles} center={pins.find((p) => p.selected) ?? head.center} pins={pins} className="h-72 w-full" onPinClick={setSelected} onPlace={(lat, lon) => selected && setTree(selected, { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 })} />
          <p className="mt-1 text-xs text-muted">{selected ? `Tap the map to place tree ${treeById.get(selected)?.number}.` : 'Add a tree, then tap the map to pin it.'}</p>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <Eyebrow>Trees</Eyebrow>
            <Button variant="accent" onClick={addTree} data-testid="add-tree">Add tree</Button>
          </div>
          <div className="space-y-3">
            {s.trees.map((t) => {
              const photos = s.photos.filter((p) => p.treeId === t.id);
              return (
                <Card key={t.id} className={t.id === selected ? 'ring-2 ring-orange-400' : ''} data-testid={`tree-${t.number}`}>
                  <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setSelected(t.id)}>
                    <span className="font-display flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-xl font-bold text-white">{t.number}</span>
                    <span className="font-semibold">{t.speciesCommon ?? 'Species?'}{t.dbhIn ? ` · ${t.dbhIn} in` : ''}</span>
                    {t.lat == null ? <Badge tone="amber">Not pinned</Badge> : null}
                    {!photos.some((p) => p.mark) ? <Badge tone="amber">No marked photo</Badge> : null}
                  </button>
                  {t.id === selected ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="col-span-2"><Label htmlFor={`sp-${t.id}`}>Species</Label><Input id={`sp-${t.id}`} list="species" value={t.speciesCommon ?? ''} onChange={(e) => setTree(t.id, { speciesCommon: e.target.value || null, speciesLatin: species.find((x) => x.common === e.target.value)?.latin ?? null })} /></div>
                        <div><Label htmlFor={`dbh-${t.id}`}>DBH (in)</Label><Input id={`dbh-${t.id}`} inputMode="decimal" value={t.dbhIn ?? ''} onChange={(e) => setTree(t.id, { dbhIn: e.target.value ? Number(e.target.value) || null : null })} /></div>
                        <div><Label htmlFor={`ht-${t.id}`}>Height (ft)</Label><Input id={`ht-${t.id}`} inputMode="numeric" value={t.heightFt ?? ''} onChange={(e) => setTree(t.id, { heightFt: e.target.value ? Math.round(Number(e.target.value)) || null : null })} /></div>
                      </div>
                      <Segmented label="Condition" name={`cond-${t.id}`} value={(t.condition ?? 'fair') as 'good'} options={[['good', 'Good'], ['fair', 'Fair'], ['poor', 'Poor'], ['dead', 'Dead']] as const} onChange={(v) => setTree(t.id, { condition: v })} />
                      <div>
                        <Label htmlFor={`nl-${t.id}`}>Power lines near the work</Label>
                        <Select id={`nl-${t.id}`} value={t.nearLines} onChange={(e) => setTree(t.id, { nearLines: e.target.value as NearLines })}>
                          {(Object.keys(NEAR_LINES_WORDS) as NearLines[]).map((k) => <option key={k} value={k}>{NEAR_LINES_WORDS[k]}</option>)}
                        </Select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => pinHere(t.id)}>Pin where I’m standing</Button>
                        <label className="inline-flex h-10 cursor-pointer items-center rounded-control bg-ink px-4 text-sm font-semibold text-surface">
                          Take photo
                          <input type="file" accept="image/*" capture="environment" className="sr-only" data-testid={`photo-input-${t.number}`} onChange={(e) => e.target.files?.[0] && void addPhoto(t.id, e.target.files[0])} />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {photos.map((p) => (
                          <button type="button" key={p.clientId} onClick={() => {
                            markShape.current = null;
                            setMarking({ clientId: p.clientId, treeId: t.id });
                          }} className="text-left">
                            <MarkedPhoto src={photoSrc(p)} marks={p.mark ? [p.mark] : []} alt={`Tree ${t.number}`} />
                            <span className="text-xs text-muted">{p.mark ? 'Marked' : 'Tap to circle the tree'}{p.uploaded ? '' : ' · on phone'}</span>
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(['remove', 'prune', 'stump_grind', 'cable_brace', 'phc'] as LineKind[]).map((k) => (
                          <Button key={k} size="sm" variant="outline" onClick={() => addLine(s.options[0]!.id, t.id, k)}>+ {LINE_WORDS.en[k]}</Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Card>
              );
            })}
            {!s.trees.length ? <p className="text-sm text-muted">Walk the property. Add each tree, pin it, take a photo, and circle it so the crew sees exactly which one.</p> : null}
          </div>
          <datalist id="species">{species.map((x) => <option key={x.common} value={x.common} />)}</datalist>
        </section>
      </div>

      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <Eyebrow>Work and price</Eyebrow>
          <Button size="sm" variant="outline" onClick={() => update((d) => ({ ...d, options: [...d.options, { id: uuid(), name: 'Optional work', required: false, selected: false, lines: [] }] }))}>Add an option</Button>
        </div>
        <div className="space-y-4">
          {s.options.map((o) => (
            <Card key={o.id}>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-48 flex-1"><Label htmlFor={`on-${o.id}`}>Option</Label><Input id={`on-${o.id}`} value={o.name} onChange={(e) => setOption(o.id, { name: e.target.value })} /></div>
                <Segmented label="Customer" name={`req-${o.id}`} value={o.required ? 'req' : o.selected ? 'inc' : 'opt'} options={[['req', 'Must take'], ['inc', 'Ticked'], ['opt', 'Can add']] as const} onChange={(v) => setOption(o.id, { required: v === 'req', selected: v === 'inc' })} />
                <span className="font-display tabular text-xl font-semibold">{dollars(priced.optionTotals[o.id] ?? 0)}</span>
              </div>
              <div className="mt-3 space-y-3">
                {o.lines.map((l) => (
                  <div key={l.id} className="rounded-control border border-line-faint p-3" data-testid="line">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                      <div><Label htmlFor={`k-${l.id}`}>Work</Label><Select id={`k-${l.id}`} value={l.kind} onChange={(e) => setLine(o.id, l.id, { kind: e.target.value as LineKind })}>{LINE_KINDS.map((k) => <option key={k} value={k}>{LINE_WORDS.en[k]}</option>)}</Select></div>
                      <div><Label htmlFor={`t-${l.id}`}>Tree</Label><Select id={`t-${l.id}`} value={l.treeId ?? ''} onChange={(e) => setLine(o.id, l.id, { treeId: e.target.value || null })}><option value="">None</option>{s.trees.map((t) => <option key={t.id} value={t.id}>#{t.number} {t.speciesCommon ?? ''}</option>)}</Select></div>
                      <div className="col-span-2"><Label htmlFor={`d-${l.id}`}>Description</Label><Input id={`d-${l.id}`} value={l.description} onChange={(e) => setLine(o.id, l.id, { description: e.target.value })} /></div>
                      <div><Label htmlFor={`q-${l.id}`}>Qty</Label><Input id={`q-${l.id}`} inputMode="decimal" value={l.qty} onChange={(e) => setLine(o.id, l.id, { qty: Number(e.target.value) || 1 })} /></div>
                      <div><Label htmlFor={`u-${l.id}`}>Unit</Label><Select id={`u-${l.id}`} value={l.unit} onChange={(e) => setLine(o.id, l.id, { unit: e.target.value as LineUnit })}>{LINE_UNITS.map((u) => <option key={u} value={u}>{u.replace('_', ' ')}</option>)}</Select></div>
                      <div><Label htmlFor={`p-${l.id}`}>Price each ($)</Label><Input id={`p-${l.id}`} inputMode="decimal" data-testid="line-price" defaultValue={l.unitPriceCents ? (l.unitPriceCents / 100).toString() : ''} onBlur={(e) => setLine(o.id, l.id, { unitPriceCents: toCents(e.target.value) ?? 0 })} /></div>
                      <div><Label htmlFor={`h-${l.id}`}>Crew hours</Label><Input id={`h-${l.id}`} inputMode="decimal" value={l.estCrewHours ?? ''} onChange={(e) => setLine(o.id, l.id, { estCrewHours: e.target.value ? Number(e.target.value) || 0 : null })} /></div>
                      <div><Label htmlFor={`e-${l.id}`}>Equipment</Label><Select id={`e-${l.id}`} value={l.equipmentType ?? ''} onChange={(e) => setLine(o.id, l.id, { equipmentType: e.target.value || null })}><option value="">None</option>{['crane', 'bucket', 'chipper', 'grinder', 'mini_loader', 'log_truck', 'spray_rig'].map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}</Select></div>
                      <div className="flex items-end justify-between gap-2 md:col-span-2">
                        <span className="whitespace-nowrap font-semibold">{dollars(lineTotal({ qty: l.qty, unit_price_cents: l.unitPriceCents }))}</span>
                        <Button size="sm" variant="ghost" onClick={() => removeLine(o.id, l.id)}>Remove</Button>
                      </div>
                    </div>
                    {TREE_KINDS.includes(l.kind) && !l.treeId ? <p className="mt-1 text-xs text-warn-ink">Pick the tree so the crew confirms the right one.</p> : null}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  {(['crane', 'equipment', 'disposal', 'permit_fee', 'clearing', 'other'] as LineKind[]).map((k) => <Button key={k} size="sm" variant="ghost" onClick={() => addLine(o.id, null, k)}>+ {LINE_WORDS.en[k]}</Button>)}
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="dep">Deposit %</Label><Input id="dep" inputMode="numeric" value={s.depositPct} onChange={(e) => update((d) => ({ ...d, depositPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} /></div>
          <div><Label htmlFor="valid">Good until</Label><Input id="valid" type="date" value={s.validUntil ?? ''} onChange={(e) => update((d) => ({ ...d, validUntil: e.target.value || null }))} /></div>
          <div className="sm:col-span-3"><Label htmlFor="notes">Notes for the customer</Label><Textarea id="notes" rows={2} value={s.notes ?? ''} onChange={(e) => update((d) => ({ ...d, notes: e.target.value || null }))} /></div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 shadow-popup backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <div>
            <div className="font-display tabular text-2xl font-semibold" data-testid="estimate-total">{dollars(priced.totalCents)}</div>
            <div className="text-xs text-muted">{priced.minimumTopUpCents ? `Includes ${dollars(priced.minimumTopUpCents)} to reach the minimum. ` : ''}{priced.depositCents ? `Deposit ${dollars(priced.depositCents)}` : 'No deposit'}</div>
          </div>
          <div className="ml-auto flex flex-col items-end">
            <Button
              variant="accent"
              size="lg"
              data-testid="send-estimate"
              disabled={problems.length > 0 || sync === 'syncing'}
              onClick={async () => {
                setSendErr(null);
                if (!navigator.onLine) return setSendErr('Sending needs signal. Everything is saved; send when you have it.');
                await runSync();
                if (latest.current.dirty && sync !== 'synced') {
                  const again = await kvGet<DraftState>(KEY(head.id));
                  if (again?.dirty) return setSendErr('Some changes haven’t synced yet. Try again in a moment.');
                }
                try {
                  const out = await api<{ publicUrl: string; smsHref: string | null; text: string }>(`/api/estimates/${head.id}/send`, { body: {} });
                  setSent({ url: out.publicUrl, smsHref: out.smsHref, text: out.text });
                } catch (e) {
                  setSendErr(e instanceof ApiError ? e.message : 'Didn’t send.');
                }
              }}
            >
              Send to customer
            </Button>
            {problems.length ? <span className="mt-1 max-w-md text-right text-xs text-warn-ink">{problems[0]}{problems.length > 1 ? ` (and ${problems.length - 1} more)` : ''}</span> : null}
            {sendErr ? <span role="alert" className="mt-1 max-w-md text-right text-xs text-danger-ink">{sendErr}</span> : null}
          </div>
        </div>
      </div>

      {marking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="Circle the tree">
          <div className="w-full max-w-xl rounded-popup bg-surface p-4">
            {(() => {
              const p = s.photos.find((x) => x.clientId === marking.clientId);
              const t = treeById.get(marking.treeId);
              if (!p || !t) return null;
              return (
                <>
                  <h2 className="font-display mb-2 text-xl font-semibold">Circle tree {t.number}</h2>
                  <MarkupEditor src={photoSrc(p) ?? ''} number={t.number} initial={p.mark?.shape ?? null} onChange={(sh) => (markShape.current = sh)} />
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="accent"
                      data-testid="save-markup"
                      onClick={() => {
                        const finalShape = markShape.current ?? p.mark?.shape ?? { circle: { cx: 0.5, cy: 0.45, r: 0.25 }, arrow: null, label: [0.7, 0.2] as [number, number] };
                        update((d) => ({ ...d, photos: d.photos.map((x) => (x.clientId === p.clientId ? { ...x, mark: { shape: finalShape, number: t.number, color: '#f97316', saved: false } } : x)) }));
                        setMarking(null);
                      }}
                    >
                      Save mark
                    </Button>
                    <Button variant="ghost" onClick={() => setMarking(null)}>Later</Button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
