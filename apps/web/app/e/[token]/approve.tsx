'use client';

import { LINE_WORDS, t as tr, type StringKey } from '@treeops/core/i18n';
import { prettyPhone } from '@treeops/core/messages';
import { dollars } from '@treeops/core/money';
import { lineTotal, priceEstimate, type PriceOption } from '@treeops/core/pricing';
import { Button, Input, Label } from '@treeops/ui';
import { useState } from 'react';
import { ErrorNote } from '@/components/actions';
import { api, ApiError, uuid } from '@/components/client-api';
import { MarkedPhoto, type Mark } from '@/components/markup';
import { SignaturePad } from '@/components/signature-pad';

interface Tree { id: string; number: number; label: string; species: string | null; dbh: number | null; photos: { id: string; url: string | null; mark: Mark }[] }

export function Approve({ token, locale, company, estimate, options, trees, deposit, paid }: {
  token: string; locale: 'en' | 'es'; company: { name: string; phone: string | null; cards: boolean };
  estimate: { number: number; status: string; validUntil: string | null; notes: string | null; depositPct: number; address: string; customer: string; minJobCents: number; approvedTotal: number | null };
  options: PriceOption[]; trees: Tree[]; deposit: { cents: number; status: string } | null; paid: boolean;
}) {
  const [lang, setLang] = useState(locale);
  const L = (k: StringKey) => tr(lang, k);
  const [chosen, setChosen] = useState<Set<string>>(new Set(options.filter((o) => !o.required && o.selected).map((o) => o.id)));
  const [name, setName] = useState('');
  const [sig, setSig] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ deposit: { amountCents: number; status: string } | null } | null>(estimate.status === 'approved' ? { deposit: deposit ? { amountCents: deposit.cents, status: deposit.status } : null } : null);
  const priced = priceEstimate(options, { min_job_cents: estimate.minJobCents }, estimate.depositPct, chosen);
  const clientId = useState(uuid())[0];
  const dep = done?.deposit ?? null;

  const payDeposit = async () => {
    setErr(null);
    try {
      const out = await api<{ url: string }>(`/api/pay/deposit/${token}`, { body: {} });
      window.location.assign(out.url);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Payment didn’t start.');
    }
  };

  return (
    <div className="min-h-dvh bg-page">
      <header className="bg-slate-900 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex-1">
            <p className="font-display text-2xl font-semibold">{company.name}</p>
            <p className="text-sm text-slate-300">{estimate.customer} · {estimate.address}</p>
          </div>
          <button type="button" className="min-h-11 rounded-control bg-slate-700 px-3 text-sm" onClick={() => setLang(lang === 'en' ? 'es' : 'en')}>{L('language')}</button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        {estimate.status === 'expired' || estimate.status === 'declined' ? <p className="rounded-control bg-warn-tint p-3">{estimate.status === 'expired' ? 'This estimate has expired.' : 'This estimate was declined.'} {company.phone ? `Call ${prettyPhone(company.phone)} for a new one.` : ''}</p> : null}
        <section>
          <h1 className="font-display text-3xl font-semibold">{L('trees')}</h1>
          <p className="text-sm text-muted">Each tree’s number is on the photo. The crew checks the same number before cutting.</p>
          <div className="mt-3 space-y-4">
            {trees.map((t) => (
              <div key={t.id} data-testid={`customer-tree-${t.number}`}>
                <p className="font-semibold">{L('tree')} {t.number}{t.species ? `: ${t.species}` : ''}{t.dbh ? `, ${t.dbh} in` : ''}</p>
                {t.photos.map((p) => <MarkedPhoto key={p.id} src={p.url} marks={[p.mark]} alt={`${L('tree')} ${t.number}`} className="mt-1" />)}
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="font-display text-2xl font-semibold">{L('options')}</h2>
          <div className="mt-2 space-y-3">
            {options.map((o) => {
              const on = o.required || chosen.has(o.id);
              const total = priced.optionTotals[o.id] ?? 0;
              return (
                <label key={o.id} className={`block rounded-surface border bg-surface p-4 shadow-float ${on ? 'border-ink' : 'border-line'}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 h-6 w-6" checked={on} disabled={o.required || Boolean(done)} onChange={(e) => { const n = new Set(chosen); if (e.target.checked) n.add(o.id); else n.delete(o.id); setChosen(n); }} data-testid={`option-${o.name}`} />
                    <div className="flex-1">
                      <p className="font-semibold">{o.name} <span className="text-sm font-normal text-muted">{o.required ? L('required') : L('optional')}</span></p>
                      <ul className="mt-1 space-y-0.5 text-sm">{o.lines.map((l) => <li key={l.id} className="flex justify-between gap-3"><span>{l.description.toLowerCase().startsWith(LINE_WORDS.en[l.kind].toLowerCase()) && lang === 'en' ? l.description : `${LINE_WORDS[lang][l.kind]}: ${l.description}`}</span><span className="tabular whitespace-nowrap">{dollars(lineTotal(l))}</span></li>)}</ul>
                    </div>
                    <span className="font-display tabular text-lg font-semibold">{dollars(total)}</span>
                  </div>
                </label>
              );
            })}
          </div>
          {estimate.notes ? <p className="mt-3 whitespace-pre-wrap text-sm">{estimate.notes}</p> : null}
        </section>
        <section className="rounded-surface bg-surface p-4 shadow-float">
          <div className="flex items-baseline justify-between"><span className="text-lg">{L('total')}</span><span className="font-display tabular text-3xl font-semibold" data-testid="customer-total">{dollars(estimate.approvedTotal ?? priced.totalCents)}</span></div>
          {priced.minimumTopUpCents && !done ? <p className="text-xs text-muted">Includes {dollars(priced.minimumTopUpCents)} to reach the minimum job charge.</p> : null}
          {priced.depositCents && !done ? <p className="mt-1 text-sm">{L('deposit')}: {dollars(priced.depositCents)}</p> : null}
          {estimate.validUntil && !done ? <p className="mt-1 text-xs text-muted">{L('validUntil')} {estimate.validUntil}</p> : null}
        </section>

        {done ? (
          <section className="rounded-surface border border-ok-line bg-ok-tint p-4" data-testid="approved">
            <p className="font-display text-2xl font-semibold text-ok-ink">{L('approved')}</p>
            <p className="mt-1 text-sm">{company.name} will text you the date. {company.phone ? `Questions: ${prettyPhone(company.phone)}.` : ''}</p>
            {dep && dep.status !== 'paid' && !paid ? (
              company.cards ? <Button variant="accent" size="lg" className="mt-3 w-full" onClick={payDeposit} data-testid="pay-deposit">{L('payDeposit')} {dollars(dep.amountCents)}</Button> : <p className="mt-2 text-sm">Deposit of {dollars(dep.amountCents)}: the company will tell you how to pay.</p>
            ) : dep ? <p className="mt-2 font-semibold">Deposit received. Thank you.</p> : null}
          </section>
        ) : estimate.status === 'sent' ? (
          <section className="space-y-3">
            <div><Label htmlFor="nm">{L('yourName')}</Label><Input id="nm" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <SignaturePad label={L('signHere')} clearLabel={L('clear')} onChange={setSig} />
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="consent" /> {L('textConsent')}</label>
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              disabled={busy || name.trim().length < 2 || !sig}
              data-testid="approve"
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  const out = await api<{ deposit: { amountCents: number; status: string } | null }>(`/api/e/${token}/approve`, { body: { selectedOptionIds: [...chosen], signerName: name, signaturePng: sig, clientId, consentSms: consent } });
                  setDone({ deposit: out.deposit });
                } catch (e) {
                  setErr(e instanceof ApiError ? e.message : 'Didn’t go through. Try again.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {L('approve')} {dollars(priced.totalCents)}
            </Button>
            <p className="text-xs text-muted">By signing you agree to the work and price above. Your name, signature, time and internet address are kept as the record.</p>
          </section>
        ) : null}
        <ErrorNote>{err}</ErrorNote>
      </main>
    </div>
  );
}
