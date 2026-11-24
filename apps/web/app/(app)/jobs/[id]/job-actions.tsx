'use client';

import { toCents } from '@treeops/core/money';
import { CHECK_WORDS, type CheckKind } from '@treeops/core/prework';
import { Button, Input, Label, Select, Textarea } from '@treeops/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorNote, ShareLink } from '@/components/actions';
import { api, ApiError, uuid } from '@/components/client-api';

const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong.');

export function CheckEditor({ jobId, check, canOverride }: { jobId: string; check: { id: string; kind: string; status: string; refNo: string | null; validUntil: string } | null; canOverride: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: check?.kind ?? '811', status: check?.status === 'overridden' ? 'cleared' : (check?.status ?? 'needed'), refNo: check?.refNo ?? '', validUntil: check?.validUntil ?? '' });
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <Button size="sm" variant={check ? 'ghost' : 'outline'} className="mt-1" onClick={() => setOpen(true)} data-testid={check ? `edit-check-${check.kind}` : 'add-check'}>{check ? 'Update' : 'Add a check'}</Button>;
  const save = async () => {
    setErr(null);
    try {
      await api(`/api/jobs/${jobId}/prework`, { body: { kind: f.kind, status: f.status, refNo: f.refNo || null, validUntil: f.validUntil || null } });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(msg(e));
    }
  };
  return (
    <div className="mt-2 rounded-control border border-line p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {!check ? <div><Label htmlFor="ck">Check</Label><Select id="ck" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{(Object.keys(CHECK_WORDS) as CheckKind[]).map((k) => <option key={k} value={k}>{CHECK_WORDS[k]}</option>)}</Select></div> : null}
        <div><Label htmlFor={`cs-${check?.id}`}>Status</Label><Select id={`cs-${check?.id}`} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="needed">Needed</option><option value="requested">Requested</option><option value="cleared">Cleared</option><option value="not_required">Not required</option></Select></div>
        <div><Label htmlFor={`cr-${check?.id}`}>Ticket or permit number</Label><Input id={`cr-${check?.id}`} value={f.refNo} onChange={(e) => setF({ ...f, refNo: e.target.value })} /></div>
        <div><Label htmlFor={`cv-${check?.id}`}>Good until</Label><Input id={`cv-${check?.id}`} type="date" value={f.validUntil} onChange={(e) => setF({ ...f, validUntil: e.target.value })} /></div>
      </div>
      <div className="mt-2 flex gap-2"><Button size="sm" onClick={save} data-testid="save-check">Save</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
      {check && canOverride && check.status !== 'overridden' ? (
        <div className="mt-4 border-t border-line-faint pt-3">
          <Label htmlFor={`ov-${check.id}`}>Override (owner or office): why is it safe to go ahead?</Label>
          <Textarea id={`ov-${check.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button
            size="sm"
            variant="danger"
            className="mt-2"
            data-testid="override-check"
            onClick={async () => {
              setErr(null);
              try {
                await api(`/api/prework/${check.id}/override`, { body: { reason } });
                setOpen(false);
                router.refresh();
              } catch (e) {
                setErr(msg(e));
              }
            }}
          >
            Override with this reason
          </Button>
          <p className="mt-1 text-xs text-muted">Your name, the time and the reason are kept in the audit log.</p>
        </div>
      ) : null}
      <ErrorNote>{err}</ErrorNote>
    </div>
  );
}

export function ScheduleDay({ jobId, crews, equipment, needsCrane }: { jobId: string; crews: { id: string; name: string }[]; equipment: { id: string; name: string; type: string }[]; needsCrane: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ crewId: crews[0]?.id ?? '', day: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), startTime: '07:30', estHours: '8' });
  const [eq, setEq] = useState<string[]>(needsCrane ? equipment.filter((e) => e.type === 'crane').slice(0, 1).map((e) => e.id) : []);
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <Button variant="accent" onClick={() => setOpen(true)} data-testid="schedule-day">Schedule a day</Button>;
  return (
    <div className="rounded-surface border border-line bg-surface p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="sm:col-span-2"><Label htmlFor="sc">Crew</Label><Select id="sc" value={f.crewId} onChange={(e) => setF({ ...f, crewId: e.target.value })}>{crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
        <div><Label htmlFor="sd">Day</Label><Input id="sd" type="date" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} /></div>
        <div><Label htmlFor="st">Start</Label><Input id="st" type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></div>
        <div><Label htmlFor="sh">Hours</Label><Input id="sh" inputMode="decimal" value={f.estHours} onChange={(e) => setF({ ...f, estHours: e.target.value })} /></div>
      </div>
      <fieldset className="mt-2">
        <legend className="text-sm font-semibold">Equipment</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {equipment.map((e) => (
            <label key={e.id} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-control border px-3 text-sm ${eq.includes(e.id) ? 'border-ink bg-tint-2 font-semibold' : 'border-line'}`}>
              <input type="checkbox" className="h-4 w-4" checked={eq.includes(e.id)} onChange={(x) => setEq(x.target.checked ? [...eq, e.id] : eq.filter((y) => y !== e.id))} /> {e.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 flex gap-2">
        <Button
          variant="accent"
          data-testid="save-day"
          onClick={async () => {
            setErr(null);
            try {
              await api('/api/job-days', { body: { jobId, crewId: f.crewId, day: f.day, startTime: f.startTime, estHours: Number(f.estHours) || 8, equipmentIds: eq } });
              setOpen(false);
              router.refresh();
            } catch (e) {
              const d = e instanceof ApiError ? (e.detail as { blocking?: { kind: string; why: string }[] } | undefined) : undefined;
              setErr(d?.blocking ? `${msg(e)} ${d.blocking.map((b) => `${CHECK_WORDS[b.kind as CheckKind]}: ${b.why}`).join(' ')}` : msg(e));
            }
          }}
        >
          Put it on the schedule
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <ErrorNote>{err}</ErrorNote>
    </div>
  );
}

export function MoveDay({ jobDayId, day }: { jobDayId: string; day: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(day);
  const [err, setErr] = useState<string | null>(null);
  const move = async (weather: boolean) => {
    setErr(null);
    try {
      await api(`/api/job-days/${jobDayId}`, { method: 'PATCH', body: { day: to, weather } });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(msg(e));
    }
  };
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Move</Button>;
  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      <div><Label htmlFor={`mv-${jobDayId}`}>New day</Label><Input id={`mv-${jobDayId}`} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <Button size="sm" onClick={() => move(false)}>Move</Button>
      <Button size="sm" variant="outline" onClick={() => move(true)} data-testid="move-weather">Move for weather (texts customer)</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <ErrorNote>{err}</ErrorNote>
    </div>
  );
}

export function CrewLinkButton({ jobDayId, opened, hasLink }: { jobDayId: string; opened: boolean; hasLink: boolean }) {
  const [link, setLink] = useState<{ url: string; smsHref: string | null; text: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const make = async (text: boolean) => {
    if (hasLink && !window.confirm('A new link replaces the one already sent. Make a new one?')) return;
    setErr(null);
    try {
      setLink(await api(`/api/job-days/${jobDayId}/link`, { body: { text } }));
    } catch (e) {
      setErr(msg(e));
    }
  };
  return (
    <>
      <Button size="sm" variant="accent" onClick={() => make(true)} data-testid="crew-link">{hasLink ? 'New crew link' : 'Send crew link'}</Button>
      {hasLink ? <span className="self-center text-xs text-muted">{opened ? 'Crew opened the link' : 'Link not opened yet'}</span> : null}
      {link ? <div className="w-full"><ShareLink url={link.url} smsHref={link.smsHref} note={link.text === 'mock_sent' || link.text === 'sent' ? 'Texted to the crew leader.' : 'Share it with the crew leader:'} /></div> : null}
      <ErrorNote>{err}</ErrorNote>
    </>
  );
}

export function AddChangeOrder({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ description: '', amount: '' });
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Add a change order</Button>;
  return (
    <div className="rounded-surface border border-line p-3">
      <Label htmlFor="cod">Extra work</Label>
      <Input id="cod" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <Label htmlFor="coa" className="mt-2">Price ($)</Label>
      <Input id="coa" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          onClick={async () => {
            const cents = toCents(f.amount);
            if (!f.description || cents === null) return setErr('Describe the work and give a price.');
            try {
              await api('/api/change-orders', { body: { jobId, description: f.description, amountCents: cents, clientId: uuid() } });
              setOpen(false);
              router.refresh();
            } catch (e) {
              setErr(msg(e));
            }
          }}
        >
          Save (not billed until signed)
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <ErrorNote>{err}</ErrorNote>
    </div>
  );
}

export function ProofButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ url: string | null; sha256: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant="outline"
        disabled={busy}
        data-testid="proof-packet"
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            setOut(await api(`/api/jobs/${jobId}/proof-packet`, { body: {} }));
            router.refresh();
          } catch (e) {
            setErr(msg(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Building the PDF…' : 'Build proof packet'}
      </Button>
      {out ? <p className="mt-2 text-sm">{out.url ? <a className="font-semibold text-link underline" href={out.url} target="_blank" rel="noreferrer" data-testid="proof-link">Download the PDF</a> : 'Built.'} <span className="font-mono text-xs" data-testid="proof-hash">{out.sha256}</span></p> : null}
      <ErrorNote>{err}</ErrorNote>
    </div>
  );
}

export function NewClaim({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: 'property_damage', description: '' });
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <Button size="sm" variant="ghost" className="mt-1" onClick={() => setOpen(true)}>Open a claim</Button>;
  return (
    <div className="mt-2">
      <Select aria-label="Kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="property_damage">Property damage</option><option value="injury">Injury</option><option value="vehicle">Vehicle</option><option value="other">Other</option></Select>
      <Textarea aria-label="What happened" className="mt-2" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What the customer says happened" />
      <Button
        size="sm"
        className="mt-2"
        onClick={async () => {
          try {
            await api('/api/claims', { body: { jobId, openedOn: new Date().toISOString().slice(0, 10), kind: f.kind, description: f.description } });
            setOpen(false);
            router.refresh();
          } catch (e) {
            setErr(msg(e));
          }
        }}
      >
        Save claim
      </Button>
      <ErrorNote>{err}</ErrorNote>
    </div>
  );
}
