'use client';

import { dollars } from '@treeops/core/money';
import { Button, Input, Label } from '@treeops/ui';
import { useState } from 'react';
import { ErrorNote } from '@/components/actions';
import { api, ApiError, uuid } from '@/components/client-api';
import { SignaturePad } from '@/components/signature-pad';

/** The customer signs (or declines) work the crew added on site. Unsigned work never reaches the bill. */
export function SignChangeOrder({ token, co }: { token: string; co: { company: string; customer: string; address: string; job: number; description: string; amountCents: number; status: string } }) {
  const [status, setStatus] = useState(co.status);
  const [name, setName] = useState('');
  const [sig, setSig] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const clientId = useState(uuid())[0];
  const send = async (decline: boolean) => {
    setErr(null);
    try {
      const out = await api<{ status: string }>(`/api/co/${token}/sign`, { body: decline ? { decline: true, clientId } : { signerName: name, signaturePng: sig, clientId } });
      setStatus(out.status);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Didn’t go through.');
    }
  };
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-8">
      <p className="font-display text-2xl font-semibold">{co.company}</p>
      <p className="text-sm text-muted">{co.customer} · {co.address} · job {co.job}</p>
      <div className="rounded-surface bg-surface p-4 shadow-float">
        <p className="text-lg">{co.description}</p>
        <p className="font-display mt-1 text-3xl font-semibold">{dollars(co.amountCents)}</p>
      </div>
      {status === 'proposed' ? (
        <>
          <div><Label htmlFor="n">Your full name</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <SignaturePad onChange={setSig} />
          <Button variant="accent" size="lg" className="w-full" disabled={name.trim().length < 2 || !sig} onClick={() => send(false)}>Approve {dollars(co.amountCents)}</Button>
          <Button variant="ghost" className="w-full" onClick={() => send(true)}>No thanks</Button>
        </>
      ) : <p className="rounded-control bg-ok-tint p-3 font-semibold text-ok-ink">{status === 'signed' ? 'Approved. Thank you.' : 'Declined. The crew won’t do this work.'}</p>}
      <ErrorNote>{err}</ErrorNote>
    </main>
  );
}
