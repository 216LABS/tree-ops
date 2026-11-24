'use client';

import { Button, Card, Eyebrow, Input, Label, Select, Textarea } from '@treeops/ui';
import { useState } from 'react';
import { api, ApiError } from '@/components/client-api';
import { ErrorNote } from '@/components/actions';

const EQUIP = ['chipper', 'grinder', 'bucket', 'crane', 'mini_loader', 'log_truck', 'chip_truck', 'spray_rig', 'mats', 'other'] as const;
const TZ = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'];

/** Company, branch, crew, equipment, hospital, customers (CSV), then payments (skippable). Screen 13. */
export function OnboardingForm() {
  const [f, setF] = useState({ company: '', phone: '', stateCode: 'OH', timezone: 'America/New_York', branch: 'Main', branchAddress: '', crewName: 'Crew 1', leader: '', leaderPhone: '', members: '', hospitalName: '', hospitalAddress: '', csv: '' });
  const [equipment, setEquipment] = useState<{ name: string; type: (typeof EQUIP)[number] }[]>([{ name: 'Chipper 1', type: 'chipper' }]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <form
      className="mt-6 space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await api('/api/onboarding', {
            body: {
              company: f.company, phone: f.phone || null, stateCode: f.stateCode, timezone: f.timezone, branch: f.branch, branchAddress: f.branchAddress || null,
              crew: f.leader ? { name: f.crewName, leader: f.leader, leaderPhone: f.leaderPhone || null, members: f.members.split(',').map((s) => s.trim()).filter(Boolean) } : null,
              equipment: equipment.filter((x) => x.name.trim()),
              hospital: f.hospitalName && f.hospitalAddress ? { name: f.hospitalName, address: f.hospitalAddress } : null,
              customersCsv: f.csv || null,
            },
          });
          window.location.assign('/settings?tab=company&welcome=1');
        } catch (e) {
          setErr(e instanceof ApiError ? e.message : 'Setup didn’t save.');
          setBusy(false);
        }
      }}
    >
      <Card>
        <Eyebrow>1. Company</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label htmlFor="company">Company name</Label><Input id="company" required value={f.company} onChange={set('company')} /></div>
          <div><Label htmlFor="phone">Office phone</Label><Input id="phone" type="tel" value={f.phone} onChange={set('phone')} placeholder="(330) 555-0100" /></div>
          <div><Label htmlFor="state">State</Label><Input id="state" maxLength={2} required value={f.stateCode} onChange={(e) => setF({ ...f, stateCode: e.target.value.toUpperCase() })} /></div>
          <div className="sm:col-span-2"><Label htmlFor="tz">Time zone</Label><Select id="tz" value={f.timezone} onChange={set('timezone')}>{TZ.map((z) => <option key={z}>{z}</option>)}</Select></div>
        </div>
      </Card>
      <Card>
        <Eyebrow>2. Branch</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="branch">Branch name</Label><Input id="branch" required value={f.branch} onChange={set('branch')} /></div>
          <div><Label htmlFor="baddr">Yard address</Label><Input id="baddr" value={f.branchAddress} onChange={set('branchAddress')} /></div>
        </div>
      </Card>
      <Card>
        <Eyebrow>3. First crew</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="crew">Crew name</Label><Input id="crew" value={f.crewName} onChange={set('crewName')} /></div>
          <div><Label htmlFor="leader">Crew leader</Label><Input id="leader" value={f.leader} onChange={set('leader')} /></div>
          <div><Label htmlFor="lphone">Leader’s mobile</Label><Input id="lphone" type="tel" value={f.leaderPhone} onChange={set('leaderPhone')} /></div>
          <div><Label htmlFor="members">Others on the crew (commas)</Label><Input id="members" value={f.members} onChange={set('members')} /></div>
        </div>
      </Card>
      <Card>
        <Eyebrow>4. Equipment</Eyebrow>
        <p className="mt-1 text-sm text-muted">Anything that can only be in one place at a time: cranes, buckets, chippers, grinders.</p>
        <div className="mt-3 space-y-2">
          {equipment.map((x, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label="Equipment name" value={x.name} onChange={(e) => setEquipment(equipment.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
              <Select aria-label="Type" className="w-40" value={x.type} onChange={(e) => setEquipment(equipment.map((y, j) => (j === i ? { ...y, type: e.target.value as (typeof EQUIP)[number] } : y)))}>
                {EQUIP.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </Select>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setEquipment([...equipment, { name: '', type: 'bucket' }])}>Add equipment</Button>
        </div>
      </Card>
      <Card>
        <Eyebrow>5. Nearest hospital</Eyebrow>
        <p className="mt-1 text-sm text-muted">Shown on every job briefing. Add more per branch later.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="hn">Hospital</Label><Input id="hn" value={f.hospitalName} onChange={set('hospitalName')} /></div>
          <div><Label htmlFor="ha">Address</Label><Input id="ha" value={f.hospitalAddress} onChange={set('hospitalAddress')} /></div>
        </div>
      </Card>
      <Card>
        <Eyebrow>6. Customers (optional)</Eyebrow>
        <p className="mt-1 text-sm text-muted">Paste rows of name, phone, address, city, state. Rows missing a name, address or state are skipped and counted.</p>
        <Textarea aria-label="Customers CSV" className="mt-2 font-mono text-xs" rows={5} value={f.csv} onChange={set('csv')} placeholder={'Pat Holloway,(330) 555-0123,12 Elm St,Kent,OH'} />
      </Card>
      <p className="text-sm text-muted">Card payments: connect Stripe in Settings after this. You can skip it and record checks by hand.</p>
      <ErrorNote>{err}</ErrorNote>
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={busy}>{busy ? 'Setting up…' : 'Finish setup'}</Button>
    </form>
  );
}
