'use client';

import { useState } from 'react';
import { ActionButton, ShareLink } from '@/components/actions';

export function ViewerLink({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  return (
    <>
      <ActionButton size="sm" variant="outline" path={`/api/claims/${id}/link`} onDone={(o: { url: string }) => setUrl(o.url)}>Link for the adjuster</ActionButton>
      {url ? <div className="w-full"><ShareLink url={url} note="Read-only. Anyone with this link sees the job record and proof packets." /></div> : null}
    </>
  );
}
