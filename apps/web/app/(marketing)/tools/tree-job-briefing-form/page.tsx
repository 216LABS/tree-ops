import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free tree job briefing form (PDF, English and Spanish)',
  description: 'A printable pre-job briefing form for tree crews: hazards, power lines, aerial rescue plan, nearest hospital, and a sign-off line for every crew member. Free, no sign-up.',
};

const jsonLd = { '@context': 'https://schema.org', '@type': 'HowTo', name: 'Run a tree job briefing', step: ['Check the hazards on the form', 'Note power lines near the work', 'Agree the aerial rescue plan', 'Write the nearest hospital and the 911 address', 'Everyone on site signs; brief late arrivals and sign them in'].map((text) => ({ '@type': 'HowToStep', text })) };

/** Free SEO tool (M16): the printable briefing form, no account. */
export default function BriefingFormTool() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="font-display text-4xl font-semibold">Free tree job briefing form</h1>
      <p className="mt-3 text-lg text-muted">Print it, brief the crew, have everyone sign. Hazards, power lines, aerial rescue plan, nearest hospital, and a line for each worker, including anyone who shows up late.</p>
      <form action="/api/tools/briefing-form" method="get" target="_blank" className="mt-6 flex flex-wrap items-end gap-3 rounded-surface border border-line-faint bg-surface p-4 shadow-float">
        <label className="flex-1 text-sm font-semibold">Your company name (optional)<input name="company" maxLength={80} className="mt-1 block w-full rounded-control border border-line-strong px-3 py-2 text-base font-normal" /></label>
        <button name="lang" value="en" className="min-h-11 rounded-control bg-beacon px-4 font-semibold text-slate-950">Download (English)</button>
        <button name="lang" value="es" className="min-h-11 rounded-control border border-line px-4 font-semibold">Descargar (Español)</button>
      </form>
      <p className="mt-4 text-sm text-muted">A template, not legal advice. ANSI Z133 and OSHA set the rules for tree work; check the current edition.</p>
      <section className="mt-10 rounded-surface bg-slate-900 p-6 text-white">
        <h2 className="font-display text-2xl font-semibold">Skip the clipboard</h2>
        <p className="mt-2 text-slate-300">In Tree Ops the briefing is on the crew’s phone, prefilled from the estimate, and each worker taps to sign. Tree work stays locked until it’s done.</p>
        <a href="/login" className="mt-4 inline-block rounded-control bg-beacon px-4 py-2 font-semibold text-slate-950">Start free</a>
      </section>
    </main>
  );
}
