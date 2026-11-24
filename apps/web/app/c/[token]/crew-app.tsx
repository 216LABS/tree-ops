'use client';

import { electricalGate, NEAR_LINES_WORDS } from '@treeops/core/electrical';
import { LINE_WORDS, t as tr, type StringKey } from '@treeops/core/i18n';
import { toCents } from '@treeops/core/money';
import { WEATHER_WORDS, type WeatherFlagKind } from '@treeops/core/weather';
import { BigButton } from '@treeops/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { uuid } from '@/components/client-api';
import { MarkedPhoto, type Mark } from '@/components/markup';
import { commit, flush, kvGet, kvSet, pendingCount, rejectedList } from '@/components/outbox';
import { SignaturePad } from '@/components/signature-pad';
import { shrinkImage } from '@/lib/shrink-image';

type NearLines = keyof typeof NEAR_LINES_WORDS;
interface Bundle {
  jobDay: { id: string; day: string; status: string; startTime: string; weatherFlags: { kind: WeatherFlagKind; message: string }[]; crew: string | null; leaderId: string | null };
  job: { id: string; number: number; notes: string | null; requiredLevel: number; needsAbatement: boolean; needsCrane: boolean };
  company: { name: string; phone: string | null; locale: 'en' | 'es' };
  property: { address: string; city: string | null; state: string; lat: number | null; lon: number | null; accessNotes: string | null; gateCode: string | null; hazards: string[]; customer: string };
  lines: { id: string; kind: keyof (typeof LINE_WORDS)['en']; description: string; treeId: string | null; qty: number; unit: string; treeWork: boolean }[];
  trees: { id: string; number: number; label: string; species_common: string | null; dbh_in: number | null; near_lines: NearLines; notes: string | null; photos: { id: string; url: string | null; marks: Mark[] }[] }[];
  workers: { id: string; name: string; level: number; onCrew: boolean }[];
  equipment: { id: string; name: string; type: string }[];
  hospitals: { name: string; address: string; phone: string | null }[];
  briefings: { id: string; client_id: string; completed_at: string; signoffs: { worker_id: string; signed_at: string; late: boolean }[] }[];
  confirmations: { line_id: string; result: string; at: string }[];
  changeOrders: { id: string; description: string; amount_cents: number; status: string; client_id: string }[];
}
interface Local {
  briefingClientId: string | null;
  briefingAt: string | null;
  signed: { workerId: string; late: boolean }[];
  confirmed: Record<string, { result: string; at: string }>;
  clock: Record<string, 'on' | 'off' | 'break'>;
  cos: { clientId: string; description: string; amountCents: number; signed: boolean }[];
}
const EMPTY: Local = { briefingClientId: null, briefingAt: null, signed: [], confirmed: {}, clock: {}, cos: [] };
const HAZARDS: [string, StringKey][] = [['drop_zone', 'hazardDrop'], ['traffic', 'hazardTraffic'], ['structures', 'hazardStructures'], ['weather', 'hazardWeather'], ['lines', 'hazardLines'], ['rescue', 'hazardRescue']];

/**
 * Glove-first and offline-first: every tap is written to the phone (one atomic IndexedDB write) before the screen moves
 * on, then sent when there's signal. The server applies each action once, whatever repeats.
 */
export function CrewApp({ token, initial }: { token: string; initial: Bundle }) {
  const [b, setB] = useState<Bundle>(initial);
  const [lang, setLang] = useState<'en' | 'es'>(initial.company.locale);
  const [local, setLocal] = useState<Local>(EMPTY);
  const [tab, setTab] = useState<'today' | 'brief' | 'trees' | 'more'>('today');
  const [pending, setPending] = useState(0);
  const [state, setState] = useState<'synced' | 'sending' | 'saved' | 'offline' | 'gone'>('synced');
  const [rejected, setRejected] = useState<{ clientId: string; message: string }[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const pos = useRef<{ lat: number; lon: number } | null>(null);
  const L = (k: StringKey) => tr(lang, k);
  const scope = `crew:${token.slice(0, 24)}`;
  const urls = { photoUrl: `/api/c/${token}/photos`, syncUrl: `/api/c/${token}/sync` };

  // Merge what the server knows with what this phone did (the phone's record wins until synced).
  useEffect(() => {
    void (async () => {
      const cached = await kvGet<Bundle>(`${scope}:bundle`);
      const saved = (await kvGet<Local>(`${scope}:local`)) ?? EMPTY;
      const srv = initial.briefings.at(-1);
      const merged: Local = {
        ...saved,
        briefingClientId: saved.briefingClientId ?? srv?.client_id ?? null,
        briefingAt: saved.briefingAt ?? srv?.completed_at ?? null,
        signed: saved.signed.length ? saved.signed : (srv?.signoffs ?? []).map((s) => ({ workerId: s.worker_id, late: s.late })),
        confirmed: { ...Object.fromEntries(initial.confirmations.map((c) => [c.line_id, { result: c.result, at: c.at }])), ...saved.confirmed },
      };
      setLocal(merged);
      if (!cached || cached.jobDay.id === initial.jobDay.id) await kvSet(`${scope}:bundle`, initial);
      setPending((await pendingCount(scope)).total);
    })();
    // The service worker keeps this page and its scripts for offline reloads.
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => {});
    const id = navigator.geolocation?.watchPosition((p) => (pos.current = { lat: p.coords.latitude, lon: p.coords.longitude }), () => {}, { enableHighAccuracy: false, maximumAge: 60000 });
    return () => { if (id !== undefined) navigator.geolocation.clearWatch(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async () => {
    const before = (await pendingCount(scope)).total;
    if (!before) return setState('synced');
    setState('sending');
    const out = await flush(scope, urls);
    const after = (await pendingCount(scope)).total;
    setPending(after);
    setRejected(await rejectedList(scope));
    setState(out === 'gone' ? 'gone' : out === 'offline' ? 'offline' : after ? 'saved' : 'synced');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    void send();
    const on = () => void send();
    window.addEventListener('online', on);
    document.addEventListener('visibilitychange', on);
    const timer = setInterval(on, 15000);
    return () => {
      window.removeEventListener('online', on);
      document.removeEventListener('visibilitychange', on);
      clearInterval(timer);
    };
  }, [send]);

  /** One tap: write the ops (and photo) and the phone's view together, then try to send. */
  const act = async (ops: { type: string; payload: unknown; clientId?: string }[], next: Local, photo?: { clientId: string; blob: Blob; meta: Record<string, string> }, note?: string) => {
    const withIds = ops.map((o) => ({ clientId: o.clientId ?? uuid(), type: o.type, payload: o.payload }));
    await commit(scope, { ops: withIds, photo, local: { key: `${scope}:local`, value: next } });
    setLocal(next);
    navigator.vibrate?.(30);
    if (note) {
      setToast(note);
      setTimeout(() => setToast(null), 1800);
    }
    setPending((await pendingCount(scope)).total);
    setState('saved');
    void send();
  };
  const now = () => new Date().toISOString();
  const me = local.signed[0]?.workerId ?? b.jobDay.leaderId ?? b.workers[0]?.id ?? null;

  const briefed = Boolean(local.briefingClientId);
  const onSite = b.workers.filter((w) => local.signed.some((s) => s.workerId === w.id));
  const gate = electricalGate({ level: b.job.requiredLevel, needsAbatement: b.job.needsAbatement }, onSite.map((w) => ({ electrical_level: w.level })), null);
  const canWork = briefed && local.signed.length > 0 && gate.ok;
  const treeLines = b.lines.filter((l) => l.treeWork);
  const doneCount = treeLines.filter((l) => local.confirmed[l.id] && local.confirmed[l.id]!.result !== 'skipped').length;
  const badge = { synced: [L('synced'), 'bg-emerald-400 text-black'], sending: [L('sending'), 'bg-sky-300 text-black'], saved: [`${L('saved')} · ${pending} ${L('waiting')}`, 'bg-amber-300 text-black'], offline: [L('offline'), 'bg-amber-300 text-black'], gone: [L('linkGone'), 'bg-red-500 text-white'] }[state];

  return (
    <div className="min-h-dvh bg-slate-950 pb-28 text-white" data-testid="crew-app">
      <header className="sticky top-0 z-20 bg-slate-900 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-slate-300">{b.company.name} · {L('today')} {b.jobDay.startTime}</p>
            <p className="font-display truncate text-xl font-bold">{b.property.address}</p>
          </div>
          <button type="button" className="min-h-12 rounded-lg bg-slate-700 px-3 text-sm font-semibold" onClick={() => setLang(lang === 'en' ? 'es' : 'en')}>{L('language')}</button>
        </div>
        <p className={`mt-2 rounded px-2 py-1 text-center text-sm font-semibold ${badge[1]}`} data-testid="crew-sync" role="status">{badge[0]}</p>
      </header>

      {toast ? <div className="fixed inset-x-4 top-24 z-30 rounded-lg bg-emerald-400 p-3 text-center font-bold text-black" role="status">{toast}</div> : null}
      {rejected.length ? <div className="m-3 rounded-lg border-2 border-red-400 p-3 text-sm">{rejected.map((r) => <p key={r.clientId}>{r.message}</p>)}</div> : null}

      <main className="space-y-4 p-4">
        {tab === 'today' ? (
          <>
            <section className="rounded-xl bg-slate-800 p-4">
              <p className="text-lg">{b.property.customer}</p>
              {b.property.gateCode ? <p className="mt-1 text-lg">Gate: <strong>{b.property.gateCode}</strong></p> : null}
              {b.property.accessNotes ? <p className="mt-1 text-slate-200">{b.property.accessNotes}</p> : null}
              {b.job.notes ? <p className="mt-1 text-slate-200">{b.job.notes}</p> : null}
              {b.property.hazards.length ? <ul className="mt-2 list-inside list-disc text-orange-300">{b.property.hazards.map((h) => <li key={h}>{h}</li>)}</ul> : null}
              {b.jobDay.weatherFlags.length ? <div className="mt-2 rounded-lg border-2 border-orange-400 p-2 text-orange-200">{b.jobDay.weatherFlags.map((f, i) => <p key={i}><strong>{WEATHER_WORDS[f.kind]}:</strong> {f.message}</p>)}</div> : null}
              <a className="mt-3 flex min-h-16 items-center justify-center rounded-lg bg-slate-600 text-xl font-bold" href={b.property.lat ? `https://maps.google.com/?q=${b.property.lat},${b.property.lon}` : `https://maps.google.com/?q=${encodeURIComponent(`${b.property.address} ${b.property.city ?? ''} ${b.property.state}`)}`}>{L('navigate')}</a>
            </section>
            <section className="rounded-xl bg-slate-800 p-4">
              <p className="font-display mb-2 text-lg font-semibold">{L('whoIsHere')}</p>
              <div className="space-y-2">
                {b.workers.filter((w) => w.onCrew || local.clock[w.id]).map((w) => {
                  const c = local.clock[w.id] ?? 'off';
                  return (
                    <div key={w.id} className="flex items-center gap-2">
                      <span className="flex-1 text-lg">{w.name}</span>
                      {c === 'off' ? <BigButton tone="go" className="min-h-14 text-lg" onClick={() => act([{ type: 'work_log', payload: { workerId: w.id, kind: 'arrive', at: now() } }], { ...local, clock: { ...local.clock, [w.id]: 'on' } })} data-testid={`arrive-${w.name}`}>{L('clockIn')}</BigButton> : null}
                      {c === 'on' ? <><BigButton className="min-h-14 text-base" onClick={() => act([{ type: 'work_log', payload: { workerId: w.id, kind: 'pause', at: now() } }], { ...local, clock: { ...local.clock, [w.id]: 'break' } })}>{L('pause')}</BigButton><BigButton tone="warn" className="min-h-14 text-base" onClick={() => act([{ type: 'work_log', payload: { workerId: w.id, kind: 'leave', at: now() } }], { ...local, clock: { ...local.clock, [w.id]: 'off' } })}>{L('clockOut')}</BigButton></> : null}
                      {c === 'break' ? <BigButton tone="on" className="min-h-14 text-base" onClick={() => act([{ type: 'work_log', payload: { workerId: w.id, kind: 'resume', at: now() } }], { ...local, clock: { ...local.clock, [w.id]: 'on' } })}>{L('resume')}</BigButton> : null}
                    </div>
                  );
                })}
              </div>
            </section>
            <BigButton tone={briefed ? 'done' : 'go'} height="tall" className="w-full" onClick={() => setTab(briefed && canWork ? 'trees' : 'brief')} data-testid="go-next">
              {briefed && canWork ? `${L('trees')} ${doneCount}/${treeLines.length}` : L('startBriefing')}
            </BigButton>
          </>
        ) : null}

        {tab === 'brief' ? <Briefing b={b} lang={lang} local={local} me={me} act={act} onDone={() => setTab('trees')} gate={gate} /> : null}

        {tab === 'trees' ? (
          !canWork ? (
            <section className="rounded-xl border-2 border-orange-400 p-4 text-lg">
              <p>{L('needBriefing')}</p>
              {briefed && !gate.ok ? <p className="mt-2 text-orange-300">{L('electricalBlocked')}: {gate.reason}</p> : null}
              <BigButton tone="go" className="mt-3 w-full" onClick={() => setTab('brief')}>{L('briefing')}</BigButton>
            </section>
          ) : (
            <TreeWork b={b} lang={lang} local={local} me={me} act={act} pos={pos} scope={scope} />
          )
        ) : null}

        {tab === 'more' ? <More b={b} lang={lang} local={local} me={me} act={act} /> : null}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-1 bg-slate-900 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]" aria-label="Sections">
        {([['today', L('today')], ['brief', L('briefing')], ['trees', L('trees')], ['more', L('addWork').split(' ')[0]!]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`min-h-14 rounded-lg text-sm font-bold ${tab === k ? 'bg-beacon text-black' : 'bg-slate-800 text-white'}`} data-testid={`tab-${k}`}>{label}</button>
        ))}
      </nav>
    </div>
  );
}

type Act = (ops: { type: string; payload: unknown; clientId?: string }[], next: Local, photo?: { clientId: string; blob: Blob; meta: Record<string, string> }, note?: string) => Promise<void>;

function Briefing({ b, lang, local, me, act, onDone, gate }: { b: Bundle; lang: 'en' | 'es'; local: Local; me: string | null; act: Act; onDone: () => void; gate: { ok: boolean; reason: string | null } }) {
  const L = (k: StringKey) => tr(lang, k);
  const worst = b.trees.reduce<NearLines>((w, t) => (['none', 'service_le_750v', 'dist_le_35kv', 'gt_35kv'].indexOf(t.near_lines) > ['none', 'service_le_750v', 'dist_le_35kv', 'gt_35kv'].indexOf(w) ? t.near_lines : w), 'none');
  const [checked, setChecked] = useState<string[]>([]);
  const [lines, setLines] = useState<NearLines>(worst);
  const [hospital, setHospital] = useState(0);
  const [rescue, setRescue] = useState('');
  const [leader, setLeader] = useState(b.jobDay.leaderId ?? me ?? b.workers[0]?.id ?? '');
  const h = b.hospitals[hospital];
  const briefed = Boolean(local.briefingClientId);

  if (!briefed) {
    return (
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold">{L('briefing')}</h2>
        <div className="grid grid-cols-1 gap-2">
          {HAZARDS.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setChecked(checked.includes(k) ? checked.filter((x) => x !== k) : [...checked, k])} className={`flex min-h-16 items-center gap-3 rounded-lg px-4 text-left text-lg font-semibold ${checked.includes(k) ? 'bg-emerald-400 text-black' : 'bg-slate-800'}`} data-testid={`hazard-${k}`} aria-pressed={checked.includes(k)}>
              <span className="text-2xl">{checked.includes(k) ? '✓' : '○'}</span>{L(label)}
            </button>
          ))}
        </div>
        <label className="block text-lg">{L('lines')}
          <select className="mt-1 block min-h-14 w-full rounded-lg bg-slate-800 px-3 text-lg" value={lines} onChange={(e) => setLines(e.target.value as NearLines)}>
            {(Object.keys(NEAR_LINES_WORDS) as NearLines[]).map((k) => <option key={k} value={k}>{NEAR_LINES_WORDS[k]}</option>)}
          </select>
        </label>
        <div className="rounded-lg bg-slate-800 p-3">
          <p className="text-sm text-slate-300">{L('hospital')}</p>
          {b.hospitals.length ? (
            <select className="mt-1 block min-h-14 w-full rounded-lg bg-slate-700 px-3 text-lg" value={hospital} onChange={(e) => setHospital(Number(e.target.value))}>{b.hospitals.map((x, i) => <option key={i} value={i}>{x.name}</option>)}</select>
          ) : <p className="text-orange-300">No hospital saved. Ask the office to add one.</p>}
          {h ? <p className="mt-1">{h.address}</p> : null}
          <p className="mt-2 text-sm text-slate-300">{L('address911')}</p>
          <p className="text-lg font-semibold">{b.property.address}{b.property.city ? `, ${b.property.city}` : ''}</p>
        </div>
        <label className="block text-lg">{L('rescuePlan')}
          <textarea className="mt-1 block w-full rounded-lg bg-slate-800 p-3 text-lg" rows={2} value={rescue} onChange={(e) => setRescue(e.target.value)} />
        </label>
        <label className="block text-lg">{L('leader')}
          <select className="mt-1 block min-h-14 w-full rounded-lg bg-slate-800 px-3 text-lg" value={leader} onChange={(e) => setLeader(e.target.value)}>{b.workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        </label>
        <BigButton
          tone="go"
          height="tall"
          className="w-full"
          disabled={checked.length < HAZARDS.length || !leader}
          data-testid="finish-briefing"
          onClick={() => {
            const clientId = uuid();
            const at = new Date().toISOString();
            void act([{ type: 'briefing', clientId, payload: { leaderWorkerId: leader, hazards: checked, lineProximity: lines, hospitalName: h?.name ?? null, hospitalAddress: h?.address ?? null, emergencyAddress: `${b.property.address}${b.property.city ? `, ${b.property.city}` : ''}`, rescuePlan: rescue || null, isRebrief: false, completedAt: at } }], { ...local, briefingClientId: clientId, briefingAt: at }, undefined, L('saved'));
          }}
        >
          {L('finishBriefing')}
        </BigButton>
        {checked.length < HAZARDS.length ? <p className="text-center text-slate-400">{HAZARDS.length - checked.length} left to check</p> : null}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl font-bold">{L('tapToSign')}</h2>
      {b.workers.map((w) => {
        const s = local.signed.find((x) => x.workerId === w.id);
        return (
          <button
            key={w.id}
            type="button"
            disabled={Boolean(s)}
            data-testid={`sign-${w.name}`}
            className={`flex min-h-16 w-full items-center justify-between rounded-lg px-4 text-left text-lg font-semibold ${s ? 'bg-emerald-400 text-black' : w.onCrew ? 'bg-slate-700' : 'bg-slate-800 text-slate-300'}`}
            onClick={() => {
              const late = Boolean(local.briefingAt && Date.now() - +new Date(local.briefingAt) > 15 * 60000);
              void act([{ type: 'signoff', payload: { briefingClientId: local.briefingClientId, workerId: w.id, signedAt: new Date().toISOString(), lateArrival: late } }], { ...local, signed: [...local.signed, { workerId: w.id, late }] }, undefined, `${w.name}: ${L('signed')}`);
            }}
          >
            <span>{w.name} <span className="text-sm font-normal">L{w.level}</span></span>
            <span>{s ? `✓ ${L('signed')}${s.late ? ` (${L('lateArrival')})` : ''}` : ''}</span>
          </button>
        );
      })}
      {!gate.ok && local.signed.length ? <p className="rounded-lg border-2 border-orange-400 p-3 text-orange-200">{tr(lang, 'electricalBlocked')}: {gate.reason}</p> : null}
      <BigButton tone="go" height="tall" className="w-full" disabled={!local.signed.length || !gate.ok} onClick={onDone} data-testid="to-trees">{tr(lang, 'trees')}</BigButton>
    </section>
  );
}

function TreeWork({ b, lang, local, me, act, pos, scope }: { b: Bundle; lang: 'en' | 'es'; local: Local; me: string | null; act: Act; pos: React.RefObject<{ lat: number; lon: number } | null>; scope: string }) {
  const L = (k: StringKey) => tr(lang, k);
  const lines = b.lines.filter((l) => l.treeWork);
  const [open, setOpen] = useState<string | null>(lines.find((l) => !local.confirmed[l.id])?.id ?? null);
  const [shots, setShots] = useState<Record<string, { before?: { id: string; url: string }; after?: { id: string; url: string } }>>({});
  const [skipFor, setSkipFor] = useState<string | null>(null);
  const treeOf = new Map(b.trees.map((t) => [t.id, t]));
  if (!lines.length) return <p className="text-lg">{L('noTrees')}</p>;

  const photo = async (lineId: string, treeId: string | null, phase: 'before' | 'after', file: File) => {
    const clientId = uuid();
    const blob = await shrinkImage(file, 2048, 0.85);
    const meta: Record<string, string> = { kind: phase, takenAt: new Date().toISOString(), ...(treeId ? { treeId } : {}), ...(pos.current ? { lat: String(pos.current.lat), lon: String(pos.current.lon) } : {}) };
    await commit(scope, { photo: { clientId, blob, meta } });
    setShots((s) => ({ ...s, [lineId]: { ...s[lineId], [phase]: { id: clientId, url: URL.createObjectURL(blob) } } }));
    navigator.vibrate?.(30);
  };
  const confirm = (lineId: string, treeId: string | null, result: 'done' | 'partial' | 'skipped', reason?: string) => {
    const s = shots[lineId] ?? {};
    const at = new Date().toISOString();
    void act(
      [{ type: 'tree_confirm', payload: { lineId, treeId, result, reason: reason ?? null, beforePhotoClientId: s.before?.id ?? null, afterPhotoClientId: s.after?.id ?? null, workerId: me, at, lat: pos.current?.lat ?? null, lon: pos.current?.lon ?? null } }],
      { ...local, confirmed: { ...local.confirmed, [lineId]: { result, at } } },
      undefined,
      `${L('tree')} ${treeId ? treeOf.get(treeId)?.number : ''}: ${result === 'done' ? L('done') : result === 'partial' ? L('partial') : L('skip')}`,
    );
    setSkipFor(null);
    setOpen(lines.find((l) => l.id !== lineId && !local.confirmed[l.id])?.id ?? null);
  };

  return (
    <section className="space-y-3">
      {lines.every((l) => local.confirmed[l.id]) ? <p className="rounded-lg bg-emerald-400 p-3 text-center text-lg font-bold text-black">{L('allDone')}</p> : null}
      {lines.map((l) => {
        const t = l.treeId ? treeOf.get(l.treeId) : undefined;
        const c = local.confirmed[l.id];
        const s = shots[l.id] ?? {};
        return (
          <div key={l.id} className={`rounded-xl ${c ? 'bg-slate-900 ring-2 ring-emerald-500' : 'bg-slate-800'} p-3`} data-testid={`tree-line-${t?.number ?? l.id}`}>
            <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(open === l.id ? null : l.id)}>
              <span className="font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-600 text-3xl font-bold">{t?.number ?? '?'}</span>
              <span className="flex-1">
                <span className="block text-lg font-bold">{LINE_WORDS[lang][l.kind]}{t?.species_common ? `: ${t.species_common}` : ''}{t?.dbh_in ? ` ${t.dbh_in} in` : ''}</span>
                <span className="block text-sm text-slate-300">{l.description}</span>
                {t && t.near_lines !== 'none' ? <span className="block text-sm font-semibold text-orange-300">⚡ {NEAR_LINES_WORDS[t.near_lines]}</span> : null}
              </span>
              {c ? <span className="text-lg font-bold text-emerald-400">✓</span> : null}
            </button>
            {open === l.id ? (
              <div className="mt-3 space-y-3">
                {t?.photos.length ? (
                  <div>
                    <p className="mb-1 text-sm text-slate-300">{L('salesPhoto')}</p>
                    {t.photos.map((p) => <MarkedPhoto key={p.id} src={p.url} marks={p.marks} alt={`${L('tree')} ${t.number}`} className="mb-2" />)}
                  </div>
                ) : null}
                {t?.notes ? <p className="text-slate-200">{t.notes}</p> : null}
                <div className="grid grid-cols-2 gap-2">
                  {(['before', 'after'] as const).map((phase) => (
                    <label key={phase} className={`flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-lg text-center text-lg font-bold ${s[phase] ? 'bg-emerald-400 text-black' : phase === 'before' ? 'bg-beacon text-black' : 'bg-slate-600'}`}>
                      {s[phase] ? <img src={s[phase]!.url} alt="" className="mb-1 h-16 w-24 rounded object-cover" /> : null}
                      {phase === 'before' ? (s.before ? '✓ ' : '') + L('confirmTree') : (s.after ? '✓ ' : '') + L('afterPhoto')}
                      <input type="file" accept="image/*" capture="environment" className="sr-only" data-testid={`${phase}-photo-${t?.number ?? ''}`} onChange={(e) => e.target.files?.[0] && void photo(l.id, l.treeId, phase, e.target.files[0])} />
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <BigButton tone="done" disabled={!s.after || !s.before} onClick={() => confirm(l.id, l.treeId, 'done')} data-testid={`done-${t?.number ?? ''}`}>{L('done')}</BigButton>
                  <BigButton disabled={!s.before} onClick={() => confirm(l.id, l.treeId, 'partial')}>{L('partial')}</BigButton>
                  <BigButton tone="warn" onClick={() => setSkipFor(l.id)}>{L('skip')}</BigButton>
                </div>
                {!s.before ? <p className="text-center text-sm text-slate-300">{L('beforePhoto')} → {L('afterPhoto')} → {L('done')}</p> : null}
                {skipFor === l.id ? (
                  <div className="grid grid-cols-1 gap-2">
                    <p className="text-lg">{L('skipReason')}</p>
                    {(lang === 'es' ? ['El cliente cambió de idea', 'No es seguro', 'No hay acceso', 'Otro'] : ['Customer changed their mind', 'Not safe today', 'Can’t get access', 'Other']).map((r) => (
                      <BigButton key={r} onClick={() => confirm(l.id, l.treeId, 'skipped', r)}>{r}</BigButton>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      {b.lines.filter((l) => !l.treeWork).length ? (
        <div className="rounded-xl bg-slate-900 p-3 text-slate-300">
          <p className="text-sm font-semibold uppercase">{L('work')}</p>
          <ul className="mt-1 list-inside list-disc">{b.lines.filter((l) => !l.treeWork).map((l) => <li key={l.id}>{l.description}</li>)}</ul>
        </div>
      ) : null}
    </section>
  );
}

function More({ b, lang, local, me, act }: { b: Bundle; lang: 'en' | 'es'; local: Local; me: string | null; act: Act }) {
  const L = (k: StringKey) => tr(lang, k);
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [name, setName] = useState('');
  const [sig, setSig] = useState<string | null>(null);
  const [disp, setDisp] = useState({ kind: 'chips', loads: '', cost: '' });
  const [hours, setHours] = useState<Record<string, string>>({});
  const cents = toCents(price);
  return (
    <section className="space-y-6">
      <div className="space-y-3 rounded-xl bg-slate-800 p-4">
        <h2 className="font-display text-xl font-bold">{L('addWork')}</h2>
        <label className="block">{L('describeWork')}<input className="mt-1 block min-h-14 w-full rounded-lg bg-slate-700 px-3 text-lg" value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        <label className="block">{L('price')} ($)<input inputMode="decimal" className="mt-1 block min-h-14 w-full rounded-lg bg-slate-700 px-3 text-lg" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <label className="block">{L('customerName')}<input className="mt-1 block min-h-14 w-full rounded-lg bg-slate-700 px-3 text-lg" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <SignaturePad dark label={L('customerSigns')} clearLabel={L('clear')} onChange={setSig} />
        <BigButton
          tone="go"
          className="w-full"
          disabled={!desc || cents === null || !sig || name.trim().length < 2}
          onClick={() => {
            const clientId = uuid();
            void act([{ type: 'change_order_propose', clientId, payload: { description: desc, amountCents: cents, workerId: me, signature: { name, png: sig, signedAt: new Date().toISOString(), clientId: uuid() } } }], { ...local, cos: [...local.cos, { clientId, description: desc, amountCents: cents!, signed: true }] }, undefined, L('signed'));
            setDesc(''); setPrice(''); setName(''); setSig(null);
          }}
          data-testid="co-signed"
        >
          {L('signed')} ✓
        </BigButton>
        <BigButton
          className="w-full"
          disabled={!desc || cents === null}
          onClick={() => {
            const clientId = uuid();
            void act([{ type: 'change_order_propose', clientId, payload: { description: desc, amountCents: cents, workerId: me, signature: null } }], { ...local, cos: [...local.cos, { clientId, description: desc, amountCents: cents!, signed: false }] }, undefined, L('saved'));
            setDesc(''); setPrice('');
          }}
        >
          {L('sendForSignature')}
        </BigButton>
        {[...b.changeOrders.map((c) => ({ clientId: c.client_id, description: c.description, amountCents: c.amount_cents, signed: c.status === 'signed' })), ...local.cos.filter((c) => !b.changeOrders.some((x) => x.client_id === c.clientId))].map((c) => (
          <p key={c.clientId} className="text-slate-200">{c.description}: ${(c.amountCents / 100).toFixed(2)} {c.signed ? `· ${L('signed')}` : ''}</p>
        ))}
      </div>

      <div className="space-y-3 rounded-xl bg-slate-800 p-4">
        <h2 className="font-display text-xl font-bold">{L('disposal')}</h2>
        <select className="block min-h-14 w-full rounded-lg bg-slate-700 px-3 text-lg" value={disp.kind} onChange={(e) => setDisp({ ...disp, kind: e.target.value })}><option value="chips">Chips</option><option value="logs">Logs</option><option value="brush">Brush</option><option value="stumps">Stumps</option></select>
        <div className="grid grid-cols-2 gap-2">
          <input aria-label={L('loads')} placeholder={L('loads')} inputMode="decimal" className="min-h-14 rounded-lg bg-slate-700 px-3 text-lg" value={disp.loads} onChange={(e) => setDisp({ ...disp, loads: e.target.value })} />
          <input aria-label={L('cost')} placeholder={`${L('cost')} $`} inputMode="decimal" className="min-h-14 rounded-lg bg-slate-700 px-3 text-lg" value={disp.cost} onChange={(e) => setDisp({ ...disp, cost: e.target.value })} />
        </div>
        <BigButton className="w-full" disabled={!disp.loads} onClick={() => { void act([{ type: 'disposal', payload: { kind: disp.kind, loads: Number(disp.loads) || 0, costCents: toCents(disp.cost) ?? null } }], local, undefined, L('saved')); setDisp({ kind: 'chips', loads: '', cost: '' }); }}>{L('saved').split(' ')[0]}</BigButton>
      </div>

      {b.equipment.length ? (
        <div className="space-y-2 rounded-xl bg-slate-800 p-4">
          <h2 className="font-display text-xl font-bold">Equipment hours</h2>
          {b.equipment.map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              <span className="flex-1 text-lg">{e.name}</span>
              <input aria-label={`${e.name} hours`} inputMode="decimal" className="min-h-14 w-24 rounded-lg bg-slate-700 px-3 text-lg" value={hours[e.id] ?? ''} onChange={(x) => setHours({ ...hours, [e.id]: x.target.value })} />
              <BigButton className="min-h-14" disabled={!Number(hours[e.id])} onClick={() => { void act([{ type: 'work_log', payload: { equipmentId: e.id, kind: 'equipment_hours', at: new Date().toISOString(), value: Number(hours[e.id]) } }], local, undefined, L('saved')); setHours({ ...hours, [e.id]: '' }); }}>+</BigButton>
            </div>
          ))}
        </div>
      ) : null}
      {b.company.phone ? <a href={`tel:${b.company.phone}`} className="flex min-h-16 items-center justify-center rounded-lg bg-slate-700 text-lg font-bold">Call the office</a> : null}
    </section>
  );
}
