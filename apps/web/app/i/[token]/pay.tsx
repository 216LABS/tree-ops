'use client';

import { Button } from '@treeops/ui';
import { useState } from 'react';
import { ErrorNote } from '@/components/actions';
import { api, ApiError } from '@/components/client-api';

export function PayButton({ token, label }: { token: string; label: string }) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <Button variant="accent" size="lg" className="w-full" data-testid="pay-invoice" onClick={async () => { try { window.location.assign((await api<{ url: string }>(`/api/pay/invoice/${token}`, { body: {} })).url); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Payment didn’t start.'); } }}>{label}</Button>
      <ErrorNote>{err}</ErrorNote>
    </>
  );
}
