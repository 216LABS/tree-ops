# Tree Ops (working name) by 216LABS

Operations software for tree removal and tree care companies, built from Flake's proven parts. The sales arborist
marks each tree once (pin, photo, number); the customer signs those exact photos; the crew works from the same
pictures on a no-install, offline text link, signs a job briefing, and confirms each tree with before and after
photos; the office bills from the signed estimate and can prove all of it in one PDF.

The spec is `docs/SPEC.md`. What changed from it and why is in `docs/DECISIONS.md`.

## Run it

Needs Node 20+, pnpm 10 and Docker. No API keys.

```sh
pnpm i
pnpm db:start     # local Supabase on ports 564xx (runs beside Flake's 553xx); writes apps/web/.env.local
pnpm seed:demo    # "Maple Ridge Tree Co. (DEMO)": fictional, safe to re-run
pnpm dev          # http://localhost:3000
```

Open `/login` and choose **Use the demo company** (or sign in as the sales arborist or the office). `/dev` has links
into the demo as the crew and as a customer, and every text the mocks "sent".

The Supabase CLI is taken from a Flake checkout next to this repo (no new package install). Set `SUPABASE_CLI` to use
another copy.

## Check it

`pnpm verify` runs typecheck, unit tests (engines, providers), row level security tests against real Postgres,
integration tests, then a production build and the Playwright end-to-end suite in mock mode. The end-to-end run
reseeds the demo company first.

What the tests prove (docs/SPEC.md section 16):

- Tenant A can never read or write tenant B, in every table; crew members see only their crew's days; append-only
  records refuse UPDATE and DELETE even on the server connection.
- The crew works a whole job offline, reloads the page, and every record reaches the server exactly once (Chromium
  and WebKit).
- Open pre-work checks block scheduling until an owner or office overrides with a reason, which is audited; a sales
  arborist can't override.
- A crane can't be booked twice (the engine refuses, and the database exclusion constraint backs it up).
- An unsigned change order never reaches an invoice; a replayed payment webhook pays once.
- The proof packet's hash is the same when rebuilt with nothing new, and changes when a correction is added.
- Estimate to approval (signature, deposit) to schedule to crew link to briefing to tree confirmation to invoice to
  payment, end to end. Plus a walk through every office screen using each feature, failing on any server or console
  error.

## Layout

```text
apps/web            Next.js: marketing, office app, crew link (/c), customer pages (/e /co /i /r), viewer (/v), API, cron
packages/core       Pure engines: pricing, estimate vs actual, equipment conflicts, weather flags, pre-work gate,
                    electrical gate, invoice and billing flags, proof manifest, PHC records, storm triage, fees, texts
packages/db         SQL migrations (schema, RLS, reference data), the postgres.js access layer, RLS tests
packages/providers  Texting, payments, weather: live + deterministic mock. PDFs (proof packet, briefing form)
packages/ui         The UI kit (from Flake)
docs/               Spec, research, decisions, what was copied from Flake
```

## Modes

`PROVIDERS_MODE=mock` (the default) runs everything with no keys: texts land in `/dev`, payments go through a mock
checkout page, weather is synthetic and labeled mock. `PROVIDERS_MODE=live` uses Twilio, Stripe Connect and the NOAA
NWS forecast. Outside `APP_ENV=production`, real texts and live Stripe keys are blocked even when present.

Environment variable names are in `.env.example`. Never commit values.

## Not done yet

See the end of `docs/DECISIONS.md`.
