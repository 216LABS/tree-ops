'use client';

import { Button, Input, Label } from '@treeops/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionButton, ErrorNote } from '@/components/actions';
import { api, ApiError } from '@/components/client-api';

export function ConsentButtons({ phone, current }: { phone: string; current: string | null }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {current !== 'opted_in' ? <ActionButton size="sm" variant="outline" path="/api/consents" body={{ phone, status: 'opted_in' }} confirm="Did they say it's OK to text them? This is logged with your name.">They said OK to texts</ActionButton> : null}
      {current !== 'opted_out' ? <ActionButton size="sm" variant="ghost" path="/api/consents" body={{ phone, status: 'opted_out' }}>They asked us to stop</ActionButton> : null}
    </div>
  );
}

export function AddProperty({ customerId, stateCode }: { customerId: string; stateCode: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ address: '', city: '', state: stateCode });
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Add property</Button>;
  return (
    <form
      className="mb-3 w-full rounded-surface border border-line bg-surface p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const out = await api<{ id: string }>('/api/properties', { body: { customerId, address: f.address, city: f.city || null, stateCode: f.state } });
          router.push(`/properties/${out.id}`);
        } catch (e) {
          setErr(e instanceof ApiError ? e.message : 'Didn’t save.');
        }
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_4rem]">
        <div><Label htmlFor="na">Address</Label><Input id="na" required value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div><Label htmlFor="nc">City</Label><Input id="nc" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
        <div><Label htmlFor="ns">State</Label><Input id="ns" maxLength={2} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value.toUpperCase() })} /></div>
      </div>
      <ErrorNote>{err}</ErrorNote>
      <div className="mt-2 flex gap-2"><Button type="submit" size="sm">Save</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
    </form>
  );
}
