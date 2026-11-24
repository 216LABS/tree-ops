export const metadata = { title: 'Pricing' };

/** Prices from docs/SPEC.md section 5. */
export default function Pricing() {
  const plans = [
    ['Free', '$0', ['1 branch, 2 crews, unlimited office users', 'Estimates with tree photos, crew link, briefings, proof packets', '1% of card payments through Tree Ops, at most $15 a payment', 'Checks and cash: no fee']],
    ['Pro', '$99 a month', ['Unlimited crews and branches', 'Plant health care records, storm mode', '0.5% of card payments, at most $10 a payment', 'Month to month, no contract']],
    ['Enterprise', '$25 per active crew a month', ['$1,500 a month minimum, billed yearly', 'Single sign-on, its own database, audit log export', 'No fee if you keep your own payment processor', 'A 90-day pilot in one district first']],
  ] as const;
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-4xl font-semibold">Pricing</h1>
      <p className="mt-2 text-muted">Software that pays for itself on the first wrong tree it prevents. Prices may change while we’re in early testing.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {plans.map(([name, price, items]) => (
          <div key={name} className="rounded-surface border border-line-faint bg-surface p-5 shadow-float">
            <h2 className="font-display text-2xl font-semibold">{name}</h2>
            <p className="font-display mt-1 text-xl">{price}</p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted">{items.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
        ))}
      </div>
    </main>
  );
}
