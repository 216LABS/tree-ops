'use client';

import { dollars } from '@treeops/core/money';
import { lineTotal } from '@treeops/core/pricing';
import { Badge, Card, Eyebrow } from '@treeops/ui';
import Link from 'next/link';
import { useState } from 'react';
import { ActionButton, ShareLink } from '@/components/actions';
import { MarkedPhoto } from '@/components/markup';
import { EST_STATUS } from '@/lib/format';
import type { DraftOption, DraftPhoto, DraftTree } from './builder';

/** A sent, approved, declined or expired estimate: read-only. Sending again makes a new link (the old one stops). */
export function EstimateView({ head, trees, photos, options, total, deposit, sig, job }: { head: { id: string; number: number; status: string; customer: string; address: string }; trees: DraftTree[]; photos: DraftPhoto[]; options: DraftOption[]; total: string; deposit: string | null; sig: { name: string; at: string } | null; job: { id: string; number: number } | null }) {
  const [link, setLink] = useState<{ url: string; smsHref: string | null } | null>(null);
  const [label, tone] = EST_STATUS[head.status] ?? ['', 'gray'];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold">Estimate {head.number}</h1>
        <Badge tone={tone}>{label}</Badge>
        <span className="font-display text-2xl">{total}</span>
        {deposit ? <span className="text-sm text-muted">Deposit {deposit}</span> : null}
        <p className="w-full text-sm text-muted">{head.customer} · {head.address}</p>
      </div>
      {sig ? <p className="mb-4 rounded-control border border-ok-line bg-ok-tint p-3 text-sm text-ok-ink">Signed by {sig.name} on {sig.at}.{job ? <> <Link className="underline" href={`/jobs/${job.id}`}>Open job {job.number}</Link></> : null}</p> : null}
      {head.status === 'sent' ? (
        <div className="mb-4">
          <ActionButton variant="outline" path={`/api/estimates/${head.id}/send`} confirm="This makes a new link; the one you sent before stops working. Send again?" onDone={(o: { publicUrl: string; smsHref: string | null }) => setLink({ url: o.publicUrl, smsHref: o.smsHref })}>Send again (new link)</ActionButton>
          {link ? <ShareLink url={link.url} smsHref={link.smsHref} /> : null}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trees.map((t) => {
          const p = photos.filter((x) => x.treeId === t.id && x.mark);
          return (
            <Card key={t.id}>
              <p className="font-semibold">Tree {t.number}: {t.speciesCommon ?? ''}{t.dbhIn ? `, ${t.dbhIn} in` : ''}</p>
              {p.map((x) => <MarkedPhoto key={x.clientId} className="mt-2" src={x.url} marks={[x.mark!]} alt={`Tree ${t.number}`} />)}
            </Card>
          );
        })}
      </div>
      <Eyebrow className="mb-2 mt-6">Work</Eyebrow>
      {options.map((o) => (
        <Card key={o.id} className="mb-3">
          <p className="font-semibold">{o.name} <span className="text-sm text-muted">{o.required ? '(included)' : o.selected ? '(chosen)' : '(optional, not chosen)'}</span></p>
          <ul className="mt-2 space-y-1 text-sm">{o.lines.map((l) => <li key={l.id} className="flex justify-between gap-3"><span>{l.description}</span><span className="whitespace-nowrap">{dollars(lineTotal({ qty: l.qty, unit_price_cents: l.unitPriceCents }))}</span></li>)}</ul>
        </Card>
      ))}
    </div>
  );
}
