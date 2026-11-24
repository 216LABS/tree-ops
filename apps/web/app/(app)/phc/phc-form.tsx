'use client';

import { FIELD_WORDS, phcRecord } from '@treeops/core/phc';
import { Button, Card, Input, Label, Select } from '@treeops/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorNote, ShareLink } from '@/components/actions';
import { api, ApiError, uuid } from '@/components/client-api';

export function PhcForm({ properties, products, applicators, programs, defaultProperty, today }: { properties: { id: string; address: string; state_code: string; customer: string }[]; products: { id: string; name: string; epa_reg_no: string; is_rup: boolean; default_unit: string }[]; applicators: { id: string; full_name: string; applicator_license_no: string }[]; programs: { id: string; property_id: string; year: number }[]; defaultProperty: string | null; today: string }) {
  const router = useRouter();
  const [f, setF] = useState({ propertyId: defaultProperty ?? properties[0]?.id ?? '', productId: products[0]?.id ?? '', applicatorWorkerId: applicators[0]?.id ?? '', siteDesc: '', targetPest: '', method: '', concentration: '', totalAmount: '', amountUnit: products[0]?.default_unit ?? 'fl_oz', areaTreated: '', appliedOn: today, startTime: '', endTime: '', windMph: '', tempF: '' });
  const [err, setErr] = useState<string | null>(null);
  const [clientId, setClientId] = useState(uuid());
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const prop = properties.find((p) => p.id === f.propertyId);
  const product = products.find((p) => p.id === f.productId);
  const applicator = applicators.find((a) => a.id === f.applicatorWorkerId);
  const check = prop && product && applicator ? phcRecord({ product_name: product.name, epa_reg_no: product.epa_reg_no, total_amount: Number(f.totalAmount) || null, amount_unit: f.amountUnit, site_desc: f.siteDesc, applied_on: f.appliedOn, applicator_name: applicator.full_name, applicator_license_no: applicator.applicator_license_no, concentration: f.concentration || null, recorded_on: today, is_rup: product.is_rup }, prop.state_code) : null;
  const needs = new Set(check?.profile.required ?? []);
  const star = (k: string) => (needs.has(k as never) ? ' *' : '');
  return (
    <Card>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            await api('/api/phc/applications', {
              body: {
                clientId, propertyId: f.propertyId, productId: f.productId, applicatorWorkerId: f.applicatorWorkerId, programId: programs.find((p) => p.property_id === f.propertyId)?.id ?? null,
                siteDesc: f.siteDesc, targetPest: f.targetPest || null, method: f.method || null, concentration: f.concentration || null, totalAmount: Number(f.totalAmount), amountUnit: f.amountUnit,
                areaTreated: f.areaTreated || null, appliedOn: f.appliedOn, startTime: f.startTime || null, endTime: f.endTime || null, windMph: f.windMph ? Number(f.windMph) : null, tempF: f.tempF ? Number(f.tempF) : null,
              },
            });
            setClientId(uuid());
            setF({ ...f, siteDesc: '', totalAmount: '', concentration: '', targetPest: '' });
            router.refresh();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'Didn’t save.');
          }
        }}
      >
        <div className="sm:col-span-2"><Label htmlFor="pp">Property</Label><Select id="pp" value={f.propertyId} onChange={set('propertyId')}>{properties.map((p) => <option key={p.id} value={p.id}>{p.customer}: {p.address}</option>)}</Select></div>
        <div className="sm:col-span-2"><Label htmlFor="pr">Product{star('product_name')}</Label><Select id="pr" value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value, amountUnit: products.find((p) => p.id === e.target.value)?.default_unit ?? f.amountUnit })}>{products.map((p) => <option key={p.id} value={p.id}>{p.name} (EPA {p.epa_reg_no}){p.is_rup ? ', restricted use' : ''}</option>)}</Select></div>
        <div><Label htmlFor="ap">Applicator{star('applicator_license_no')}</Label><Select id="ap" value={f.applicatorWorkerId} onChange={set('applicatorWorkerId')}>{applicators.map((a) => <option key={a.id} value={a.id}>{a.full_name} ({a.applicator_license_no})</option>)}</Select></div>
        <div><Label htmlFor="ad">Date applied{star('applied_on')}</Label><Input id="ad" type="date" value={f.appliedOn} onChange={set('appliedOn')} /></div>
        <div className="sm:col-span-2"><Label htmlFor="sd">Where on the property{star('site_desc')}</Label><Input id="sd" value={f.siteDesc} onChange={set('siteDesc')} placeholder="Front yard oaks, trees 1 and 2" /></div>
        <div><Label htmlFor="ta">Total amount{star('total_amount')}</Label><Input id="ta" inputMode="decimal" value={f.totalAmount} onChange={set('totalAmount')} /></div>
        <div><Label htmlFor="tu">Unit</Label><Input id="tu" value={f.amountUnit} onChange={set('amountUnit')} /></div>
        <div><Label htmlFor="cc">Concentration or mix{star('concentration')}</Label><Input id="cc" value={f.concentration} onChange={set('concentration')} placeholder="1 fl oz per gal" /></div>
        <div><Label htmlFor="tp">Target pest</Label><Input id="tp" value={f.targetPest} onChange={set('targetPest')} /></div>
        <div><Label htmlFor="me">Method</Label><Input id="me" value={f.method} onChange={set('method')} placeholder="Soil injection" /></div>
        <div><Label htmlFor="ar">Area treated</Label><Input id="ar" value={f.areaTreated} onChange={set('areaTreated')} /></div>
        <div><Label htmlFor="s1">Start</Label><Input id="s1" type="time" value={f.startTime} onChange={set('startTime')} /></div>
        <div><Label htmlFor="s2">End</Label><Input id="s2" type="time" value={f.endTime} onChange={set('endTime')} /></div>
        <div><Label htmlFor="wi">Wind (mph)</Label><Input id="wi" inputMode="decimal" value={f.windMph} onChange={set('windMph')} /></div>
        <div><Label htmlFor="te">Temp (°F)</Label><Input id="te" inputMode="decimal" value={f.tempF} onChange={set('tempF')} /></div>
        {check ? <p className="text-xs text-muted sm:col-span-2">* Required by {check.profile.label}{check.profile.verified ? '' : ' (federal fields until this state is checked)'}. {check.copyRequired ? 'The customer gets a copy within 30 days.' : ''}</p> : null}
        {check?.problems.length ? <p className="text-sm text-warn-ink sm:col-span-2" data-testid="phc-missing">Still needed: {check.missingFields.map((m) => FIELD_WORDS[m] ?? m).join(', ')}</p> : null}
        <div className="sm:col-span-2"><Button type="submit" variant="accent" size="lg" disabled={!check || check.problems.length > 0} data-testid="save-phc">Save record</Button></div>
        <div className="sm:col-span-2"><ErrorNote>{err}</ErrorNote></div>
      </form>
    </Card>
  );
}

export function SendCopy({ id }: { id: string }) {
  const [out, setOut] = useState<{ link: string; smsHref: string | null; text: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-1">
      <Button size="sm" variant="ghost" onClick={async () => { try { setOut(await api(`/api/phc/applications/${id}/send-copy`, { body: {} })); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Didn’t send.'); } }}>Send copy</Button>
      {out ? <ShareLink url={out.link} smsHref={out.smsHref} note={out.text === 'mock_sent' || out.text === 'sent' ? 'Texted.' : 'Send it yourself:'} /> : null}
      <ErrorNote>{err}</ErrorNote>
    </div>
  );
}
