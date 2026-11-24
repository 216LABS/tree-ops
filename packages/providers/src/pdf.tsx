import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { ReactNode } from 'react';

/** The proof packet's data (docs/SPEC.md screen 9). Built by apps/web/lib/proof.ts; hashed as canonical JSON. */
export interface ProofManifest {
  version: 1;
  company: { name: string };
  job: { id: string; number: number; status: string; created_at: string; closed_at: string | null };
  customer: { name: string };
  property: { address: string; city: string | null; state_code: string; lat: number | null; lon: number | null };
  estimate: { number: number; approved_at: string | null; total_cents: number; options: { name: string; included: boolean; lines: { id: string; kind: string; description: string; qty: number; unit: string; unit_price_cents: number; tree_number: number | null }[] }[] };
  signatures: { subject_type: string; signer_name: string; signed_at: string; sha256: string }[];
  trees: { id: string; number: number; label: string; species: string | null; dbh_in: number | null; near_lines: string }[];
  checks: { kind: string; status: string; ref_no: string | null; valid_until: string | null; override_reason: string | null }[];
  job_days: { id: string; day: string; crew: string | null; status: string; weather_flags: { kind: string; message: string }[] }[];
  briefings: { day: string; completed_at: string; leader: string; hazards: string[]; line_proximity: string; hospital: string | null; emergency_address: string | null; rescue_plan: string | null; is_rebrief: boolean; signoffs: { worker: string; signed_at: string; late_arrival: boolean }[] }[];
  work_log: { day: string; worker: string | null; kind: string; at: string; value: number | null; note: string | null }[];
  confirmations: { day: string; tree_number: number | null; line: string; result: string; reason: string | null; at: string; by: string | null; before_photo_sha256: string | null; after_photo_sha256: string | null; lat: number | null; lon: number | null }[];
  photos: { id: string; kind: string; sha256: string; taken_at: string; tree_number: number | null; lat: number | null; lon: number | null }[];
  change_orders: { description: string; amount_cents: number; status: string; signer: string | null; signed_at: string | null }[];
  messages: { template: string; to: string; status: string; at: string }[];
  corrections: { target_table: string; field: string; new_value: unknown; reason: string; at: string }[];
  weather: { for_date: string; source: string; fetched_at: string; sha256: string | null; flags: { kind: string; message: string }[] }[];
}

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica', color: '#111827' },
  h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 6, paddingBottom: 3, borderBottom: '1pt solid #d1d5db' },
  small: { fontSize: 7.5, color: '#4b5563' },
  row: { flexDirection: 'row', borderBottom: '0.5pt solid #e5e7eb', paddingVertical: 3 },
  cell: { flex: 1, paddingRight: 4 },
  mono: { fontFamily: 'Courier', fontSize: 7 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 160, marginBottom: 8 },
  footer: { position: 'absolute', bottom: 18, left: 36, right: 36, fontSize: 7, color: '#6b7280', flexDirection: 'row', justifyContent: 'space-between' },
});

const money = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
const when = (iso: string | null | undefined, tz: string) => (iso ? new Date(iso).toLocaleString('en-US', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }) : '');

function Table({ head, rows }: { head: string[]; rows: (string | number | null | undefined)[][] }) {
  return (
    <View>
      <View style={[s.row, { borderBottom: '1pt solid #9ca3af' }]}>
        {head.map((h) => (
          <Text key={h} style={[s.cell, { fontFamily: 'Helvetica-Bold' }]}>{h}</Text>
        ))}
      </View>
      {rows.length ? rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          {r.map((c, j) => (
            <Text key={j} style={s.cell}>{c === null || c === undefined || c === '' ? '-' : String(c)}</Text>
          ))}
        </View>
      )) : <Text style={s.small}>None recorded.</Text>}
    </View>
  );
}

function Footer({ hash }: { hash: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>Manifest SHA-256 {hash}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

export async function renderProofPacket(input: { manifest: ProofManifest; hash: string; generatedAt: Date; timeZone: string; images: Map<string, { data: Uint8Array; format: 'jpg' | 'png' }> }): Promise<Uint8Array> {
  const { manifest: m, hash, timeZone: tz } = input;
  const photoPages: ReactNode[] = [];
  const withImages = m.photos.filter((p) => input.images.has(p.id));
  for (let i = 0; i < withImages.length; i += 9) {
    photoPages.push(
      <Page key={`p${i}`} size="LETTER" style={s.page}>
        <Text style={s.h2}>Photos {i === 0 ? '' : '(continued)'}</Text>
        <View style={s.photoGrid}>
          {withImages.slice(i, i + 9).map((p) => (
            <View key={p.id} style={s.photo} wrap={false}>
              <Image src={{ data: Buffer.from(input.images.get(p.id)!.data), format: input.images.get(p.id)!.format }} style={{ width: 160, height: 120, objectFit: 'cover' }} />
              <Text>{p.kind}{p.tree_number ? ` · Tree ${p.tree_number}` : ''}</Text>
              <Text style={s.small}>{when(p.taken_at, tz)}{p.lat !== null ? ` · ${p.lat}, ${p.lon}` : ''}</Text>
              <Text style={s.mono}>{p.sha256}</Text>
            </View>
          ))}
        </View>
        <Footer hash={hash} />
      </Page>,
    );
  }
  const doc = (
    <Document title={`Proof packet job ${m.job.number}`} author={m.company.name}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>Proof packet</Text>
        <Text>{m.company.name}</Text>
        <Text>Job {m.job.number} · {m.customer.name}</Text>
        <Text>{m.property.address}{m.property.city ? `, ${m.property.city}` : ''} {m.property.state_code}</Text>
        <Text style={s.small}>Generated {when(input.generatedAt.toISOString(), tz)} ({tz}). Every record below is append-only; changes appear as corrections.</Text>
        <Text style={[s.small, { marginTop: 4 }]}>Manifest SHA-256 (the same data always gives this hash):</Text>
        <Text style={s.mono}>{hash}</Text>

        <Text style={s.h2}>Signed scope (estimate {m.estimate.number})</Text>
        <Text style={s.small}>Approved {when(m.estimate.approved_at, tz) || 'not yet'} · Total {money(m.estimate.total_cents)}</Text>
        {m.estimate.options.map((o) => (
          <View key={o.name} style={{ marginTop: 4 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{o.name} {o.included ? '(included)' : '(not chosen)'}</Text>
            <Table head={['Tree', 'Work', 'Qty', 'Price']} rows={o.lines.map((l) => [l.tree_number ? `#${l.tree_number}` : '', l.description, `${l.qty} ${l.unit}`, money(Math.round(l.qty * l.unit_price_cents))])} />
          </View>
        ))}
        <Text style={s.h2}>Signatures</Text>
        <Table head={['What', 'Signed by', 'When', 'Image SHA-256']} rows={m.signatures.map((x) => [x.subject_type, x.signer_name, when(x.signed_at, tz), x.sha256.slice(0, 16) + '…'])} />
        <Text style={s.h2}>Trees</Text>
        <Table head={['#', 'Label', 'Species', 'DBH (in)', 'Power lines']} rows={m.trees.map((t) => [t.number, t.label, t.species, t.dbh_in, t.near_lines])} />
        <Text style={s.h2}>Pre-work checks</Text>
        <Table head={['Check', 'Status', 'Reference', 'Good until', 'Override reason']} rows={m.checks.map((c) => [c.kind, c.status, c.ref_no, c.valid_until ? c.valid_until.slice(0, 10) : '', c.override_reason])} />
        <Footer hash={hash} />
      </Page>
      <Page size="LETTER" style={s.page}>
        <Text style={s.h2}>Job days and weather</Text>
        <Table head={['Day', 'Crew', 'Status', 'Weather flags']} rows={m.job_days.map((d) => [d.day, d.crew, d.status, d.weather_flags.map((f) => f.message).join(' ') || 'None'])} />
        <Table head={['Forecast for', 'Source', 'Fetched', 'SHA-256']} rows={m.weather.map((w) => [w.for_date, w.source, when(w.fetched_at, tz), w.sha256 ? w.sha256.slice(0, 16) + '…' : ''])} />
        <Text style={s.h2}>Job briefings</Text>
        {m.briefings.length ? m.briefings.map((b, i) => (
          <View key={i} style={{ marginBottom: 6 }} wrap={false}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{b.day} · {b.is_rebrief ? 'Re-brief' : 'Briefing'} by {b.leader} · {when(b.completed_at, tz)}</Text>
            <Text>Hazards checked: {b.hazards.join(', ') || 'none listed'}. Power lines: {b.line_proximity}.</Text>
            <Text>Hospital: {b.hospital ?? '-'} · 911 address: {b.emergency_address ?? '-'}</Text>
            {b.rescue_plan ? <Text>Rescue plan: {b.rescue_plan}</Text> : null}
            <Table head={['Signed by', 'When', 'Late arrival']} rows={b.signoffs.map((x) => [x.worker, when(x.signed_at, tz), x.late_arrival ? 'Yes' : 'No'])} />
          </View>
        )) : <Text style={s.small}>No briefing recorded.</Text>}
        <Text style={s.h2}>Tree confirmations</Text>
        <Table head={['Day', 'Tree', 'Work', 'Result', 'When', 'By', 'After photo']} rows={m.confirmations.map((c) => [c.day, c.tree_number ? `#${c.tree_number}` : '', c.line, c.result + (c.reason ? ` (${c.reason})` : ''), when(c.at, tz), c.by, c.after_photo_sha256 ? c.after_photo_sha256.slice(0, 12) + '…' : ''])} />
        <Text style={s.h2}>Crew time</Text>
        <Table head={['Day', 'Who', 'What', 'When', 'Value']} rows={m.work_log.map((w) => [w.day, w.worker, w.kind, when(w.at, tz), w.value ?? w.note])} />
        <Text style={s.h2}>Change orders</Text>
        <Table head={['Work', 'Amount', 'Status', 'Signed by', 'When']} rows={m.change_orders.map((c) => [c.description, money(c.amount_cents), c.status, c.signer, when(c.signed_at, tz)])} />
        <Text style={s.h2}>Messages to the customer</Text>
        <Table head={['Message', 'To', 'Status', 'When']} rows={m.messages.map((x) => [x.template, x.to, x.status, when(x.at, tz)])} />
        <Text style={s.h2}>Corrections</Text>
        <Table head={['Record', 'Field', 'New value', 'Reason', 'When']} rows={m.corrections.map((c) => [c.target_table, c.field, JSON.stringify(c.new_value), c.reason, when(c.at, tz)])} />
        <Text style={s.h2}>About this packet</Text>
        <Text style={s.small}>
          Times are recorded by the phone that took the action and again when the server received it. Photos are stored as taken and identified by their
          SHA-256. Weather is the forecast the company saw for the job day, from the source named, with the hash of what was fetched. This packet is a record
          of what was entered; it is not legal advice.
        </Text>
        <Footer hash={hash} />
      </Page>
      {photoPages}
    </Document>
  );
  return new Uint8Array(await renderToBuffer(doc));
}

/** The free printable job briefing form (M16), English or Spanish. No account needed. */
export async function renderBriefingForm(input: { locale: 'en' | 'es'; company?: string }): Promise<Uint8Array> {
  const en = input.locale === 'en';
  const L = en
    ? { title: 'Tree job briefing', sub: 'Fill in before work starts. Brief anyone who arrives later, and brief again if something changes.', job: 'Job address', date: 'Date', leader: 'Crew leader', hazards: 'Hazards checked', lines: 'Power lines near the work', rescue: 'Aerial rescue plan', hospital: 'Nearest hospital', e911: 'Address for 911', roles: 'Who does what', sign: 'Crew sign-off', name: 'Name', signature: 'Signature', time: 'Time', late: 'Late arrival?', items: ['Drop zone marked and clear', 'Traffic and pedestrians controlled', 'Structures, fences, cars nearby', 'Weather: wind, lightning, heat', 'Tree defects, dead wood, decay', 'Equipment checked (saws, chipper, rigging)', 'PPE on: helmet, eyes, ears, chaps'], lineItems: ['None nearby', 'Service drop (750 V or less)', 'Distribution line (up to 35 kV)', 'Line over 35 kV: utility plan attached'], note: 'This form is a template, not legal advice. ANSI Z133 and OSHA set the rules; check the current standard.' }
    : { title: 'Charla de seguridad del trabajo', sub: 'Llénela antes de empezar. Dé la charla a quien llegue tarde, y repítala si algo cambia.', job: 'Dirección del trabajo', date: 'Fecha', leader: 'Jefe de cuadrilla', hazards: 'Peligros revisados', lines: 'Líneas eléctricas cerca del trabajo', rescue: 'Plan de rescate aéreo', hospital: 'Hospital más cercano', e911: 'Dirección para el 911', roles: 'Quién hace qué', sign: 'Firmas de la cuadrilla', name: 'Nombre', signature: 'Firma', time: 'Hora', late: '¿Llegó tarde?', items: ['Zona de caída marcada y libre', 'Tráfico y peatones controlados', 'Estructuras, cercas, autos cerca', 'Clima: viento, rayos, calor', 'Defectos del árbol, ramas muertas, pudrición', 'Equipo revisado (sierras, astilladora, aparejos)', 'Equipo de protección: casco, ojos, oídos, chaparreras'], lineItems: ['Ninguna cerca', 'Acometida (750 V o menos)', 'Línea de distribución (hasta 35 kV)', 'Línea de más de 35 kV: plan de la compañía eléctrica adjunto'], note: 'Este formulario es una plantilla, no asesoría legal. ANSI Z133 y OSHA fijan las reglas; revise la norma vigente.' };
  const box = (label: string) => (
    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
      <View style={{ width: 11, height: 11, border: '1pt solid #111827', marginRight: 6 }} />
      <Text style={{ fontSize: 10 }}>{label}</Text>
    </View>
  );
  const line = (label: string) => (
    <View key={label} style={{ marginBottom: 10 }}>
      <Text style={s.small}>{label}</Text>
      <View style={{ borderBottom: '1pt solid #6b7280', height: 16 }} />
    </View>
  );
  const doc = (
    <Document title={L.title}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>{L.title}</Text>
        {input.company ? <Text>{input.company}</Text> : null}
        <Text style={[s.small, { marginBottom: 10 }]}>{L.sub}</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 2 }}>{line(L.job)}</View>
          <View style={{ flex: 1 }}>{line(L.date)}</View>
        </View>
        {line(L.leader)}
        <Text style={s.h2}>{L.hazards}</Text>
        {L.items.map(box)}
        <Text style={s.h2}>{L.lines}</Text>
        {L.lineItems.map(box)}
        <Text style={s.h2}>{L.rescue}</Text>
        {line('')}
        {line('')}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>{line(L.hospital)}</View>
          <View style={{ flex: 1 }}>{line(L.e911)}</View>
        </View>
        {line(L.roles)}
        <Text style={s.h2}>{L.sign}</Text>
        <Table head={[L.name, L.signature, L.time, L.late]} rows={Array.from({ length: 7 }, () => [' ', ' ', ' ', ' '])} />
        <Text style={[s.small, { marginTop: 12 }]}>{L.note}</Text>
        <View style={s.footer} fixed>
          <Text>{en ? 'Free form from Tree Ops by 216LABS' : 'Formulario gratis de Tree Ops por 216LABS'}</Text>
        </View>
      </Page>
    </Document>
  );
  return new Uint8Array(await renderToBuffer(doc));
}
