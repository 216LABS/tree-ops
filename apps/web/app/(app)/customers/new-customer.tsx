'use client';

import { Button, Input, Label, Select, Textarea } from '@treeops/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/components/client-api';
import { ErrorNote } from '@/components/actions';

/** New customer with their first property, in one form (the one form people fill every time, so it opens as a form). */
export function NewCustomer({ stateCode }: { stateCode: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', kind: 'residential', phone: '', locale: 'en', address: '', city: '', state: stateCode, hoa: '', access: '', textOk: false, lat: '', lon: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  if (!open) return <Button variant="accent" onClick={() => setOpen(true)} data-testid="new-customer">New customer</Button>;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="New customer">
      <form
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-popup bg-surface p-5 shadow-popup sm:rounded-popup"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            const out = await api<{ id: string; propertyId: string | null }>('/api/customers', {
              body: { name: f.name, kind: f.kind, phone: f.phone || null, locale: f.locale, textOk: f.textOk, property: f.address ? { address: f.address, city: f.city || null, stateCode: f.state, hoaName: f.hoa || null, accessNotes: f.access || null, lat: f.lat ? Number(f.lat) : null, lon: f.lon ? Number(f.lon) : null } : null },
            });
            router.push(out.propertyId ? `/properties/${out.propertyId}` : `/customers/${out.id}`);
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'Didn’t save.');
            setBusy(false);
          }
        }}
      >
        <h2 className="font-display mb-3 text-2xl font-semibold">New customer</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label htmlFor="cn">Name</Label><Input id="cn" required value={f.name} onChange={set('name')} /></div>
          <div><Label htmlFor="ck">Kind</Label><Select id="ck" value={f.kind} onChange={set('kind')}><option value="residential">Homeowner</option><option value="commercial">Commercial</option><option value="hoa">HOA</option><option value="property_mgr">Property manager</option><option value="municipal">City or town</option></Select></div>
          <div><Label htmlFor="cp">Mobile</Label><Input id="cp" type="tel" value={f.phone} onChange={set('phone')} /></div>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" className="mt-1 h-5 w-5" checked={f.textOk} onChange={(e) => setF({ ...f, textOk: e.target.checked })} /> They said it’s OK to text them about this job.</label>
          <div><Label htmlFor="cl">Language</Label><Select id="cl" value={f.locale} onChange={set('locale')}><option value="en">English</option><option value="es">Español</option></Select></div>
          <div className="sm:col-span-2"><Label htmlFor="pa">Property address</Label><Input id="pa" value={f.address} onChange={set('address')} placeholder="123 Oak Ln" /></div>
          <div><Label htmlFor="pc">City</Label><Input id="pc" value={f.city} onChange={set('city')} /></div>
          <div><Label htmlFor="ps">State</Label><Input id="ps" maxLength={2} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value.toUpperCase() })} /></div>
          <div><Label htmlFor="plat">Latitude (optional)</Label><Input id="plat" inputMode="decimal" value={f.lat} onChange={set('lat')} /></div>
          <div><Label htmlFor="plon">Longitude (optional)</Label><Input id="plon" inputMode="decimal" value={f.lon} onChange={set('lon')} /></div>
          <div className="sm:col-span-2"><Label htmlFor="ph">HOA (if any)</Label><Input id="ph" value={f.hoa} onChange={set('hoa')} /></div>
          <div className="sm:col-span-2"><Label htmlFor="pn">Access notes for the crew</Label><Textarea id="pn" rows={2} value={f.access} onChange={set('access')} /></div>
        </div>
        <p className="mt-2 text-xs text-muted">No location? The sales arborist can pin it from the property on site.</p>
        <ErrorNote>{err}</ErrorNote>
        <div className="mt-4 flex gap-2">
          <Button type="submit" variant="accent" size="lg" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          <Button variant="ghost" size="lg" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
