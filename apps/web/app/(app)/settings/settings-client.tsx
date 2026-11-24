'use client';

import { prettyPhone } from '@treeops/core/messages';
import type { TenantSettings } from '@treeops/core/settings';
import { Badge, Button, Input, Label, Select } from '@treeops/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionButton, ErrorNote } from '@/components/actions';
import { api, ApiError } from '@/components/client-api';
import { ListEditor, type Field } from '@/components/list-editor';

const EQUIP: [string, string][] = ['chipper', 'grinder', 'bucket', 'crane', 'mini_loader', 'log_truck', 'mats', 'chip_truck', 'spray_rig', 'other'].map((t) => [t, t.replace('_', ' ')]);

export function ListBlock({ table, rows, kind, workerOpts = [], branchOpts = [] }: { table: string; rows: Record<string, any>[]; kind: string; workerOpts?: [string, string][]; branchOpts?: [string, string][] }) {
  const specs: Record<string, { fields: Field[]; show: (r: Record<string, any>) => React.ReactNode; add: string }> = {
    workers: {
      fields: [
        { key: 'full_name', label: 'Name', required: true }, { key: 'phone', label: 'Mobile', type: 'tel' }, { key: 'locale', label: 'Language', type: 'select', options: [['en', 'English'], ['es', 'Español']] },
        { key: 'electrical_level', label: 'Electrical level (Z133)', type: 'select', numeric: true, options: [['1', '1: not qualified near lines'], ['2', '2: up to 750 V'], ['3', '3: up to 35 kV'], ['4', '4: line clearance']] },
        { key: 'kind', label: 'Employee or sub', type: 'select', options: [['employee', 'Employee'], ['sub', 'Subcontractor']] }, { key: 'applicator_license_no', label: 'Pesticide applicator license' },
        { key: 'applicator_license_state', label: 'License state' }, { key: 'isa_cert_no', label: 'ISA certification' }, { key: 'branch_id', label: 'Branch', type: 'select', options: branchOpts }, { key: 'active', label: 'Active', type: 'checkbox' },
      ],
      show: (r) => <><strong>{r.full_name}</strong> <span className="text-sm text-muted">{prettyPhone(r.phone)} · level {r.electrical_level}{r.locale === 'es' ? ' · Español' : ''}{r.applicator_license_no ? ` · applicator ${r.applicator_license_no}` : ''}</span>{r.active ? null : <Badge tone="gray" className="ml-1">inactive</Badge>}</>,
      add: 'Add a person',
    },
    crews: { fields: [{ key: 'name', label: 'Crew name', required: true }, { key: 'leader_worker_id', label: 'Crew leader', type: 'select', options: workerOpts }, { key: 'branch_id', label: 'Branch', type: 'select', options: branchOpts }, { key: 'active', label: 'Active', type: 'checkbox' }], show: (r) => <strong>{r.name}</strong>, add: 'Add a crew' },
    equipment: {
      fields: [{ key: 'name', label: 'Name', required: true }, { key: 'type', label: 'Type', type: 'select', options: EQUIP }, { key: 'hour_meter', label: 'Hour meter', type: 'number' }, { key: 'service_every_hours', label: 'Service every (hours)', type: 'number' }, { key: 'last_service_hours', label: 'Last serviced at (hours)', type: 'number' }, { key: 'branch_id', label: 'Branch', type: 'select', options: branchOpts }, { key: 'active', label: 'Active', type: 'checkbox' }],
      show: (r) => <><strong>{r.name}</strong> <span className="text-sm text-muted">{String(r.type).replace('_', ' ')}{r.hour_meter != null ? ` · ${r.hour_meter} h` : ''}</span></>,
      add: 'Add equipment',
    },
    hospitals: { fields: [{ key: 'name', label: 'Hospital', required: true }, { key: 'address', label: 'Address', required: true, wide: true }, { key: 'phone', label: 'Phone', type: 'tel' }, { key: 'branch_id', label: 'Branch', type: 'select', options: branchOpts }], show: (r) => <><strong>{r.name}</strong> <span className="text-sm text-muted">{r.address}</span></>, add: 'Add a hospital' },
    products: {
      fields: [{ key: 'name', label: 'Product', required: true }, { key: 'epa_reg_no', label: 'EPA registration number', required: true }, { key: 'is_rup', label: 'Restricted use (RUP)', type: 'checkbox' }, { key: 'signal_word', label: 'Signal word', type: 'select', options: [['caution', 'Caution'], ['warning', 'Warning'], ['danger', 'Danger']] }, { key: 'rei_hours', label: 'Re-entry interval (hours)', type: 'number' }, { key: 'default_unit', label: 'Usual unit' }, { key: 'active', label: 'Active', type: 'checkbox' }],
      show: (r) => <><strong>{r.name}</strong> <span className="text-sm text-muted">EPA {r.epa_reg_no}{r.is_rup ? ' · restricted use' : ''}</span></>,
      add: 'Add a product',
    },
    certificates: {
      fields: [{ key: 'holder', label: 'Whose (company or sub)', required: true }, { key: 'kind', label: 'Coverage', type: 'select', options: [['gl', 'General liability'], ['wc', 'Workers’ comp'], ['auto', 'Auto'], ['umbrella', 'Umbrella']] }, { key: 'insurer', label: 'Insurer' }, { key: 'policy_no', label: 'Policy number' }, { key: 'expires_on', label: 'Ends', type: 'date', required: true }],
      show: (r) => <><strong>{r.holder}</strong> <span className="text-sm text-muted">{String(r.kind).toUpperCase()} · ends {r.expires_on}</span> {r.state !== 'ok' ? <Badge tone={r.state === 'expired' ? 'red' : 'amber'}>{r.state === 'expired' ? 'Expired' : 'Ends soon'}</Badge> : null}</>,
      add: 'Add a certificate',
    },
    rules: {
      fields: [{ key: 'kind', label: 'Check', type: 'select', options: [['permit', 'Tree permit'], ['811', '811 locate'], ['hoa', 'HOA'], ['utility_line', 'Power lines'], ['neighbor', 'Neighbor'], ['other', 'Other']] }, { key: 'state_code', label: 'State (2 letters)' }, { key: 'city', label: 'City' }, { key: 'source_note', label: 'What the rule says, and where it’s from', required: true, wide: true }, { key: 'verified', label: 'I checked this against the source', type: 'checkbox' }],
      show: (r) => <><strong>{r.kind}</strong> {r.city ? `${r.city}, ` : ''}{r.state_code ?? 'everywhere'}: <span className="text-sm">{r.source_note}</span></>,
      add: 'Add a rule',
    },
    branches: { fields: [{ key: 'name', label: 'Branch', required: true }, { key: 'timezone', label: 'Time zone' }, { key: 'address', label: 'Yard address', wide: true }], show: (r) => <><strong>{r.name}</strong> <span className="text-sm text-muted">{r.address}</span></>, add: 'Add a branch' },
  };
  const spec = specs[kind]!;
  // A new rule triggers on tree removals by default; edit the rule to change what it looks for.
  const extra = kind === 'rules' ? { trigger: { line_kinds: ['remove'] } } : undefined;
  return <ListEditor table={table} rows={rows} fields={spec.fields} show={spec.show} addLabel={spec.add} extra={extra} />;
}

export function CrewMembers({ crew, workers }: { crew: { id: string; name: string; members: { id: string; worker_id: string; name: string }[] }; workers: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pick, setPick] = useState('');
  const avail = workers.filter((w) => !crew.members.some((m) => m.worker_id === w.id));
  return (
    <div className="rounded-control border border-line-faint bg-surface p-3">
      <p className="font-semibold">{crew.name}</p>
      <ul className="mt-1 flex flex-wrap gap-2 text-sm">{crew.members.map((m) => <li key={m.id} className="flex items-center gap-1 rounded-row bg-tint-2 px-2 py-1">{m.name}<button type="button" aria-label={`Remove ${m.name}`} className="px-1" onClick={async () => { await api(`/api/settings/crew_members?id=${m.id}`, { method: 'DELETE' }); router.refresh(); }}>×</button></li>)}</ul>
      {avail.length ? <div className="mt-2 flex gap-2"><Select aria-label="Add to crew" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Add someone…</option>{avail.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select><Button size="sm" disabled={!pick} onClick={async () => { await api('/api/settings/crew_members', { body: { crew_id: crew.id, worker_id: pick } }); setPick(''); router.refresh(); }}>Add</Button></div> : null}
    </div>
  );
}

export function CompanyForm({ tenant, settings, canEdit }: { tenant: { name: string; phone: string | null; state: string; tz: string; sso: string | null }; settings: TenantSettings; canEdit: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ name: tenant.name, phone: tenant.phone ?? '', state: tenant.state, tz: tenant.tz, sso: tenant.sso ?? '', lift: String(settings.weather.gust_mph_lift), climb: String(settings.weather.gust_mph_climb), thunder: String(settings.weather.thunder_pct), rain: String(settings.weather.precip_in_3h), heat: String(settings.weather.heat_f), min: String(settings.min_job_cents / 100), dep: String(settings.default_deposit_pct), valid: String(settings.estimate_valid_days), ws: String(settings.work_start_hour), we: String(settings.work_end_hour) });
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const n = (v: string) => Number(v);
  return (
    <form
      className="mt-3 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        setOk(false);
        try {
          await api('/api/company', { method: 'PATCH', body: { name: f.name, phone: f.phone || null, stateCode: f.state, timezone: f.tz, ssoDomain: f.sso || null, settings: { weather: { gust_mph_lift: n(f.lift), gust_mph_climb: n(f.climb), thunder_pct: n(f.thunder), precip_in_3h: n(f.rain), heat_f: n(f.heat) }, min_job_cents: Math.round(n(f.min) * 100), default_deposit_pct: n(f.dep), estimate_valid_days: n(f.valid), work_start_hour: n(f.ws), work_end_hour: n(f.we) } } });
          setOk(true);
          router.refresh();
        } catch (e) {
          setErr(e instanceof ApiError ? e.message : 'Didn’t save.');
        }
      }}
    >
      <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label htmlFor="co">Company name</Label><Input id="co" value={f.name} onChange={set('name')} /></div>
        <div><Label htmlFor="cph">Office phone (shown on texts)</Label><Input id="cph" type="tel" value={f.phone} onChange={set('phone')} /></div>
        <div><Label htmlFor="cst">State</Label><Input id="cst" maxLength={2} value={f.state} onChange={set('state')} /></div>
        <div className="sm:col-span-2"><Label htmlFor="ctz">Time zone</Label><Input id="ctz" value={f.tz} onChange={set('tz')} /></div>
        <p className="text-sm font-semibold sm:col-span-2">Weather limits (yours to set; not a safety standard)</p>
        <div><Label htmlFor="wl">Gusts for crane or bucket (mph)</Label><Input id="wl" inputMode="decimal" value={f.lift} onChange={set('lift')} /></div>
        <div><Label htmlFor="wc">Gusts for other work (mph)</Label><Input id="wc" inputMode="decimal" value={f.climb} onChange={set('climb')} /></div>
        <div><Label htmlFor="wt">Chance of thunder (%)</Label><Input id="wt" inputMode="decimal" value={f.thunder} onChange={set('thunder')} /></div>
        <div><Label htmlFor="wr">Rain over 3 hours (in)</Label><Input id="wr" inputMode="decimal" value={f.rain} onChange={set('rain')} /></div>
        <div><Label htmlFor="wh">Feels-like heat (°F)</Label><Input id="wh" inputMode="decimal" value={f.heat} onChange={set('heat')} /></div>
        <div className="grid grid-cols-2 gap-2"><div><Label htmlFor="ws">Work from (hour)</Label><Input id="ws" inputMode="numeric" value={f.ws} onChange={set('ws')} /></div><div><Label htmlFor="we">To (hour)</Label><Input id="we" inputMode="numeric" value={f.we} onChange={set('we')} /></div></div>
        <p className="text-sm font-semibold sm:col-span-2">Estimates</p>
        <div><Label htmlFor="mj">Minimum job ($)</Label><Input id="mj" inputMode="decimal" value={f.min} onChange={set('min')} /></div>
        <div><Label htmlFor="dd">Usual deposit (%)</Label><Input id="dd" inputMode="numeric" value={f.dep} onChange={set('dep')} /></div>
        <div><Label htmlFor="vd">Estimates good for (days)</Label><Input id="vd" inputMode="numeric" value={f.valid} onChange={set('valid')} /></div>
        <div><Label htmlFor="sso">Single sign-on email domain</Label><Input id="sso" value={f.sso} onChange={set('sso')} placeholder="yourcompany.com" /></div>
      </fieldset>
      {canEdit ? <Button type="submit" variant="accent">Save</Button> : <p className="text-sm text-muted">Only the owner can change these.</p>}
      {ok ? <span className="ml-3 text-sm text-ok-ink">Saved.</span> : null}
      <ErrorNote>{err}</ErrorNote>
    </form>
  );
}

export function StripeConnect({ started }: { started: boolean }) {
  return <div className="mt-3"><ActionButton variant="outline" path="/api/stripe/connect" onDone={(o: { url: string }) => window.location.assign(o.url)}>{started ? 'Continue Stripe setup' : 'Connect Stripe'}</ActionButton></div>;
}

export function Members({ memberIds, branchOpts }: { memberIds: { id: string; email: string }[]; branchOpts: [string, string][] }) {
  const router = useRouter();
  const [f, setF] = useState({ email: '', role: 'sales_arborist', password: '', branchId: '' });
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <form
        className="grid gap-2 rounded-surface border border-line bg-surface p-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            await api('/api/members', { body: { email: f.email, role: f.role, password: f.password, branchId: f.branchId || null } });
            setF({ email: '', role: 'sales_arborist', password: '', branchId: '' });
            router.refresh();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'Didn’t add.');
          }
        }}
      >
        <div><Label htmlFor="me">Email</Label><Input id="me" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><Label htmlFor="mr">Role</Label><Select id="mr" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="sales_arborist">Sales arborist</option><option value="office">Office</option><option value="owner">Owner</option><option value="enterprise_admin">Enterprise admin (read and export)</option></Select></div>
        <div><Label htmlFor="mp">First password (10+ characters)</Label><Input id="mp" type="text" minLength={10} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <div><Label htmlFor="mb">Branch</Label><Select id="mb" value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>{branchOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
        <div className="sm:col-span-2"><Button type="submit">Add sign-in</Button></div>
        <div className="sm:col-span-2"><ErrorNote>{err}</ErrorNote></div>
      </form>
      {memberIds.length ? <div className="flex flex-wrap gap-2">{memberIds.map((m) => <ActionButton key={m.id} size="sm" variant="ghost" method="DELETE" path={`/api/members?id=${m.id}`} confirm={`Remove ${m.email}'s sign-in?`}>Remove {m.email}</ActionButton>)}</div> : null}
    </div>
  );
}
