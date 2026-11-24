'use client';

import { Button, Card, Input, Label, Select, Textarea } from '@treeops/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorNote } from '@/components/actions';
import { api, ApiError } from '@/components/client-api';

const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Didn’t save.');

export function NewStorm({ today }: { today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}>Open a storm</Button>;
  return (
    <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); const o = await api<{ id: string }>('/api/storm', { body: { name: name || 'Storm', startedOn: today } }); router.push(`/storm?event=${o.id}`); router.refresh(); }}>
      <Input aria-label="Storm name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Wind storm, May 4" />
      <Button type="submit">Open</Button>
    </form>
  );
}

export function IntakeForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const blank = { callerName: '', phone: '', address: '', insurer: '', notes: '', onStructure: false, blockingAccess: false, linesInvolved: false, injury: false };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<string | null>(null);
  const flag = (k: 'onStructure' | 'blockingAccess' | 'linesInvolved' | 'injury', label: string) => (
    <label className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-control border px-3 text-sm font-semibold ${f[k] ? 'border-ink bg-tint-2' : 'border-line'}`}><input type="checkbox" className="h-5 w-5" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />{label}</label>
  );
  return (
    <Card>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            await api(`/api/storm/${eventId}/intake`, { body: { ...f, callerName: f.callerName || null, phone: f.phone || null, insurer: f.insurer || null, notes: f.notes || null } });
            setF(blank);
            router.refresh();
          } catch (e) {
            setErr(msg(e));
          }
        }}
      >
        <div><Label htmlFor="ia">Address</Label><Input id="ia" required value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">{flag('injury', 'Someone hurt')}{flag('linesInvolved', 'Wires involved')}{flag('onStructure', 'On a house or car')}{flag('blockingAccess', 'Blocking a road or drive')}</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><Label htmlFor="in">Caller</Label><Input id="in" value={f.callerName} onChange={(e) => setF({ ...f, callerName: e.target.value })} /></div>
          <div><Label htmlFor="ip">Phone</Label><Input id="ip" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label htmlFor="ii">Insurance company (if they said)</Label><Input id="ii" value={f.insurer} onChange={(e) => setF({ ...f, insurer: e.target.value })} /></div>
        </div>
        <div><Label htmlFor="ino">What they see</Label><Textarea id="ino" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        {f.linesInvolved ? <p className="rounded-control bg-danger-tint p-2 text-sm text-danger-ink">Tell them: stay well clear of the wires and call the utility. This call goes to the utility lane, not a crew.</p> : null}
        <Button type="submit" variant="accent" size="lg" className="w-full" data-testid="save-call">Add to the queue</Button>
        <ErrorNote>{err}</ErrorNote>
      </form>
    </Card>
  );
}

export function StatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  return (
    <Select aria-label="Status" className="w-auto" value={status} onChange={async (e) => { await api(`/api/storm-intake/${id}`, { method: 'PATCH', body: { status: e.target.value } }); router.refresh(); }}>
      <option value="new">New</option><option value="assessed">Assessed</option><option value="estimated">Estimated</option><option value="scheduled">Scheduled</option><option value="utility">Utility’s job</option><option value="done">Done</option><option value="declined">Declined</option>
    </Select>
  );
}

export function ConvertCall({ id, done }: { id: string; done: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <Button size="sm" variant={done ? 'ghost' : 'outline'} onClick={async () => { try { const o = await api<{ estimateId: string | null; propertyId: string }>(`/api/storm-intake/${id}`, { method: 'PATCH', body: { convert: true } }); router.push(o.estimateId ? `/estimates/${o.estimateId}` : `/properties/${o.propertyId}`); } catch (e) { setErr(msg(e)); } }}>{done ? 'Open estimate' : 'Start an estimate'}</Button>
      <ErrorNote>{err}</ErrorNote>
    </>
  );
}
