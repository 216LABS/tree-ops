# Decisions made while building (Nov 24, 2026)

The spec's own decisions (D-1 to D-9) all stand. These are the choices made during the build, mostly where the spec
was silent or where it differed from what Flake already proved. Each has the reason and what was rejected.

| ID | Decision | Reason | Rejected |
|---|---|---|---|
| B-1 | Plain SQL with postgres.js; the schema lives only in migrations | 47 tables written twice (SQL and Drizzle) is drift waiting to happen; RLS, exclusion constraints and triggers are SQL anyway | Drizzle schema mirror (spec 6.2) |
| B-2 | One `photos` table for estimate and job photos (kind says which) | One upload path, one hash rule, one append-only trigger | Separate `tree_photos` and `photos` (spec 7) |
| B-3 | Ids for trees, options and lines are made on the phone; saving is an upsert | The estimate builder works in airplane mode and repeats are harmless | Server-made ids with a mapping step |
| B-4 | Crew outbox sends photos before actions; an action whose photo hasn't arrived answers `retry` | A confirmation never fails just because its photo was slower | Actions first (Flake's order), which fails the foreign key |
| B-5 | Texts only, never email, including sign-in | Sam's rule for Flake (Nov 16); owners set first passwords, enterprises use SSO | Magic-link email sign-in |
| B-6 | A customer's first text needs consent: the office logs a spoken OK, or the customer ticks the box on the estimate; until then the office gets a "text it from my phone" link | TCPA caution; same as Flake | Texting the estimate link to anyone with a phone number |
| B-7 | Links on append-only records (PHC copies, claim viewers) are derived from the record id with HMAC; only the hash is stored | The link can be shown again without storing it or editing the record | Storing tokens, or a side table |
| B-8 | Electrical gate counts the workers who signed the briefing, not the whole crew list | Who is on site is what matters; matches "max level on site" | Crew roster |
| B-9 | Weather thresholds default to the spec's starting values and are labeled as the company's, never as a standard | Spec D-5; no regulatory values exist for these | Hard-coded limits |
| B-10 | NWS gridpoint layers are read as published (units from `uom`), hour by hour; a missing layer stays null and shows "unavailable" | Never invent weather (Flake's rule) | Interpolating gaps |
| B-11 | Pro plan payment fee 0.5% capped at $10 (spec gave free and enterprise only) | Same shape as Flake's Pro | No fee on Pro |
| B-12 | The office drags jobs on the board at desk size; on a phone, scheduling is a form on the job page | HTML5 drag doesn't exist on touch; the dispatcher's board is a desk tool | A touch drag library (no new dependencies) |
| B-13 | Pre-work rules ship with only the rows someone verified (Ohio 811, Atlanta permit) plus clearly labeled unverified shared defaults | Spec 2.5 researched only these | Guessing other cities |
| B-14 | Separate repo, database and deploy; Flake code copied with provenance (`COPIED_FROM_FLAKE.md`) | Spec D-1 | Shared packages |
| B-15 | Same npm packages and versions as Flake, installed offline from the local store | Package installs were blocked for Flake; this adds no new supply-chain surface | New packages (dnd, signature, image libraries) |

## Not done yet (honest list)

- **Live providers are written but unexercised.** Stripe Connect checkout, the Twilio sender and the NWS gridpoint reader
  have code paths but have not run against the real services ([T] in the spec). Mock mode covers every flow.
- **SSO** calls Supabase SAML by email domain; no identity provider is connected. Needs Davey's IdP (Okta or Azure AD).
- **Dedicated database per enterprise** is a deployment choice (same code, own Supabase and Vercel project), not built
  tooling.
- **Parcel lines, QuickBooks sync, calendar sync, sub pay, financing** are Later items (spec L1 to L7).
- **State rules:** PHC profiles are verified for federal, Ohio, Florida and Indiana only; 811 for Ohio; permits for
  Atlanta. Everything else falls back to labeled defaults.
- **Satellite imagery terms** (Esri World Imagery) need checking before a paid launch; mock mode uses gray tiles.
- **Text-message registration** (toll-free verification or 10DLC) for a shared sender is not set up.
- **Legal pages** are drafts and say so.
- **Lint** isn't configured (typecheck is strict and runs in verify).
- **Hospital lookup** is the company's saved list per branch; no public source was found (spec 14).
