'use client';

import { dollars, toCents } from '@treeops/core/money';
import { Button, Input, Label, Select } from '@treeops/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionButton, ErrorNote, ShareLink } from '@/components/actions';
import { api, ApiError } from '@/components/client-api';

export function SendInvoice({ id, status, blocked }: { id: string; status: string; blocked: boolean }) {
  const [link, setLink] = useState<{ publicUrl: string; smsHref: string | null; text: string } | null>(null);
  return (
    <div>
      <ActionButton variant="accent" size="lg" path={`/api/invoices/${id}/send`} disabled={blocked} testId="send-invoice" onDone={setLink}>{status === 'sent' ? 'Send again (new link)' : 'Send invoice'}</ActionButton>
      {blocked ? <p className="mt-1 text-sm text-warn-ink">Mark the flags as reviewed first.</p> : null}
      {link ? <ShareLink url={link.publicUrl} smsHref={link.smsHref} note={link.text === 'mock_sent' || link.text === 'sent' ? 'Texted to the customer.' : 'Send the link yourself:'} /> : null}
    </div>
  );
}

export function ManualPayment({ id, owed }: { id: string; owed: number }) {
  const router = useRouter();
  const [f, setF] = useState({ amount: (owed / 100).toFixed(2), method: 'check', reference: '' });
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line-faint pt-3">
      <div><Label htmlFor="pa">Amount</Label><Input id="pa" inputMode="decimal" className="w-32" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
      <div><Label htmlFor="pm">How</Label><Select id="pm" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="check">Check</option><option value="cash">Cash</option><option value="insurer">Insurance company</option></Select></div>
      <div><Label htmlFor="pr">Check or claim #</Label><Input id="pr" className="w-36" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div>
      <Button
        variant="outline"
        onClick={async () => {
          const cents = toCents(f.amount);
          if (!cents) return setErr('Enter the amount.');
          try {
            await api(`/api/invoices/${id}/payment`, { body: { amountCents: cents, method: f.method, reference: f.reference || null } });
            router.refresh();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'Didn’t save.');
          }
        }}
      >
        Record {dollars(toCents(f.amount) ?? 0)}
      </Button>
      <ErrorNote>{err}</ErrorNote>
    </div>
  );
}
