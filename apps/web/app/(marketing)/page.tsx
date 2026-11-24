import Link from 'next/link';

export const metadata = { title: 'Tree Ops: the tree you sold is the tree you cut' };

/** Honest home page: what it does, in early testing, no testimonials (the rule from Flake). */
export default function Home() {
  const steps = [
    ['Mark each tree once', 'The sales arborist pins every tree on the map and circles it on a photo with its number. The customer signs those exact photos.'],
    ['The crew works from the same pictures', 'A text link, no app to install, works with no signal. A signed safety briefing unlocks the tree work. Each tree gets a “this is the one” photo before the cut and an after photo when it’s done.'],
    ['Bill and prove it', 'The invoice comes from the signed estimate plus signed change orders, less the deposit. One PDF holds the signatures, briefing, every photo with its fingerprint, and the weather.'],
  ];
  return (
    <main>
      <section className="bg-slate-900 px-4 pb-16 pt-10 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 inline-block rounded-sm bg-amber-300 px-2 py-0.5 text-xs font-bold text-slate-900">IN EARLY TESTING</p>
          <h1 className="font-display max-w-3xl text-4xl font-bold leading-tight md:text-6xl">The tree you sold is the tree you cut. And you can prove it.</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">Operations software for tree removal and tree care companies: numbered tree photos on every estimate, an offline crew link, signed job briefings, pre-work checks for 811 and permits, and proof packets.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-control bg-beacon px-5 py-3 font-semibold text-slate-950">Start free</Link>
            <Link href="/tools/tree-job-briefing-form" className="rounded-control border border-slate-500 px-5 py-3 font-semibold">Get the free briefing form</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-12 md:grid-cols-3">
        {steps.map(([title, body], i) => (
          <div key={title}>
            <p className="font-display text-5xl font-bold text-beacon-dark">{i + 1}</p>
            <h2 className="font-display mt-1 text-2xl font-semibold">{title}</h2>
            <p className="mt-2 text-muted">{body}</p>
          </div>
        ))}
      </section>
      <section className="mx-auto max-w-5xl px-4">
        <h2 className="font-display text-2xl font-semibold">Also in the box</h2>
        <ul className="mt-3 grid gap-2 text-muted sm:grid-cols-2">
          <li>Schedule board where a crane can’t be booked twice</li>
          <li>Wind, thunder, rain and heat flags per job, against your own limits</li>
          <li>811, permit, HOA and power line checks that hold a job until done</li>
          <li>Change orders the customer signs on the crew’s phone</li>
          <li>Plant health care records with EPA numbers and the customer copy</li>
          <li>Storm intake that sorts calls by danger</li>
          <li>Estimate vs actual hours by job and by sales arborist</li>
          <li>English and Spanish on every crew screen</li>
        </ul>
      </section>
    </main>
  );
}
