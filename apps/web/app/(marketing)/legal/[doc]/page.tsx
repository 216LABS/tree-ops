import { notFound } from 'next/navigation';

const DOCS: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: 'Terms of service (draft)',
    body: [
      'This is a working draft for early testing and has not been reviewed by a lawyer yet.',
      'Tree Ops is software for tree care companies to run estimates, schedules, crews, records and billing. Your company owns its data and can export it at any time.',
      'Records made in the field (photos, briefings, confirmations, payments) are append-only: they are never edited, and corrections are added as new records.',
      'Weather flags compare public forecasts with limits your company sets. They are not safety advice, and the decision to work is always yours.',
      'Pre-work rules that come with Tree Ops are starting points. Check your own state and city rules; only rules marked verified were checked against a source.',
    ],
  },
  privacy: {
    title: 'Privacy (draft)',
    body: [
      'This is a working draft for early testing and has not been reviewed by a lawyer yet.',
      'We store what your company enters: customers, properties, trees, photos, signatures, crew records and payments. We use it only to run the service for your company.',
      'Mobile numbers and text consent are never shared with third parties for marketing.',
      'Service providers that process data for us: Supabase (database and files), Vercel (hosting), Stripe (payments), Twilio (texts).',
    ],
  },
  'sms-terms': {
    title: 'Text message terms',
    body: [
      'Your tree service sends texts about your job only: estimates, scheduling, weather changes, change orders, invoices and treatment records. No marketing.',
      'You get texts only after you agree, on the estimate page or by telling the company.',
      'Reply STOP to stop at any time, START to resume, HELP for help. Message and data rates may apply. Message frequency varies with your job.',
      'We do not share mobile numbers or consent with third parties for marketing.',
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const d = DOCS[(await params).doc];
  if (!d) notFound();
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl font-semibold">{d.title}</h1>
      <div className="mt-4 space-y-3">{d.body.map((p) => <p key={p}>{p}</p>)}</div>
    </main>
  );
}
