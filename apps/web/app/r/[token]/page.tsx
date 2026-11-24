import { prettyPhone } from '@treeops/core/messages';
import { notFound } from 'next/navigation';
import { applicationByToken } from '@/lib/phc';

export const metadata = { title: 'Treatment record', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** The customer's copy of a pesticide application record (docs/SPEC.md screen 11). */
export default async function RecordCopy({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await applicationByToken(token);
  if (!a) notFound();
  const row = (k: string, v: unknown) => (v === null || v === undefined || v === '' ? null : <div className="grid grid-cols-[10rem_1fr] gap-2 border-b border-line-faint py-1.5"><dt className="text-muted">{k}</dt><dd>{String(v)}</dd></div>);
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <p className="font-display text-2xl font-semibold">{a.company}</p>
      <h1 className="mt-1 text-lg">Treatment record for {a.customer_name}</h1>
      <dl className="mt-4 rounded-surface bg-surface p-4 text-sm shadow-float">
        {row('Address', a.address)}
        {row('Where', a.site_desc)}
        {row('Date', a.applied_on)}
        {row('Time', a.start_time ? `${String(a.start_time).slice(0, 5)}${a.end_time ? ` to ${String(a.end_time).slice(0, 5)}` : ''}` : null)}
        {row('Product', a.product_name)}
        {row('EPA registration number', a.epa_reg_no)}
        {row('Restricted use', a.is_rup ? 'Yes' : 'No')}
        {row('Amount', `${Number(a.total_amount)} ${a.amount_unit}`)}
        {row('Concentration', a.concentration)}
        {row('Target', a.target_pest)}
        {row('Method', a.method)}
        {row('Area', a.area_treated)}
        {row('Applicator', a.applicator)}
        {row('License', a.applicator_license_no)}
        {row('Wind', a.wind_mph !== null ? `${Number(a.wind_mph)} mph` : null)}
        {row('Temperature', a.temp_f !== null ? `${Number(a.temp_f)} °F` : null)}
      </dl>
      {a.company_phone ? <p className="mt-4 text-sm">Questions: {prettyPhone(a.company_phone)}</p> : null}
    </main>
  );
}
