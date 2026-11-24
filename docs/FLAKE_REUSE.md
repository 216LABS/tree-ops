# What Flake gives us

Flake today (Nov 24, 2026): a pnpm/Turborepo monorepo, Next.js app, Supabase with RLS on 47 tables across 19
migrations, a no-install driver app opened from a text link with an offline outbox, NOAA weather triggers, append-only
visit records with hashed photos, proof packet PDFs, Stripe Connect billing with a small fee, QuickBooks sync, subs,
branches, insurance certificates, claims, payroll and profit reports. See `flake/README.md` and `flake/docs/`.

About two thirds of it carries over. The parts that make Flake trustworthy (the link app, offline sync, append-only
proof, hashed photos, tenant isolation, mocks for every provider) are exactly what tree work needs. What changes is the
shape of the work: one long job sold by estimate, not a route of short visits triggered by snow.

## Carries over as is

| Flake piece | Where | Tree use |
| --- | --- | --- |
| Driver link app, offline outbox, idempotent server | `apps/web/app/d/[token]`, `/api/d/*` | Crew link per job day. Same "no install, works in a backyard with no signal." |
| Append-only visits, corrections as new rows, device + server time | `visit`, `visit_correction` | Job work log and briefing records that hold up after an incident. |
| Hashed photos, EXIF kept, original never changed | `visit_photo`, `photo.process` job | Before/after per tree, property walk photos, "this is tree 3" check. |
| Proof packet PDF with a manifest hash | `packages/core/src/proof.ts`, `/proof` | Job proof for damage disputes, insurers and adjusters. |
| Share links with open tracking | `share_link`, `app/share/[token]` | Send the proof or the estimate to a customer, HOA or adjuster. |
| Quote link with e-sign and card/ACH on file | `app/q/[token]`, Stripe SetupIntent | Estimate approval and deposit. |
| Stripe Connect direct charges with an application fee | `ADDENDUM_PAYMENTS.md`, `fees.ts` | Same model. Tree jobs are bigger, so revisit the $25 cap. |
| Texting with consent, STOP/HELP, shared pilot number | `ADDENDUM_SMS_COMPLIANCE.md`, `messages.ts` | On the way, rain delay, done, invoice. |
| Insurance certificates with expiry warnings | `compliance.ts`, `certificate` | Subs (crane operators, climbers) and the company's own policies. |
| Claims log | `claim` | Damage claims tied to a job. |
| Subs and sub pay statements | `sub_company`, `subpay.ts` | Subcontracted climbers, cranes, grinding. |
| Equipment log (fuel, hours, maintenance) and maintenance items | `equipment_log`, `maintenance.ts` | Chippers, grinders, bucket trucks, saws. |
| Fatigue (hours on shift from phone events) | `fatigue.ts` | Long storm days. |
| Payroll export, profit report | `payroll.ts`, `profit.ts`, `PAYROLL_EXPORTS.md` | Profit per job; estimate vs actual. |
| QuickBooks Online sync | `qbo.ts`, `providers/live/qbo.ts` | Same. |
| Branches, SSO notes, security questionnaire | `branch`, `SSO_SETUP.md`, `SECURITY_QUESTIONNAIRE.md` | District offices; what an enterprise buyer like Davey will ask. |
| Mock mode for every provider, `/dev/inbox`, `/dev/weather` | `packages/providers` | Same way of building and testing. |
| Design rules | `docs/DESIGN.md` | Same rules: one primary action, phone first, write how people talk. |
| Parcel, footprint, geocoder providers | `packages/providers/src/live/geo.ts` | Property lines on the estimate map. |

## Changes shape

| Flake | Tree version |
| --- | --- |
| `site` (a lot with polygons) and `site_pin` (stake, pile, ADA) | `property` plus `tree`: a pin with species, trunk size (DBH), height, condition, photos with markup, and a number that stays the same from estimate to crew. |
| `contract` with per-push, per-inch, seasonal pricing | `estimate` with lines per tree or task (remove, prune, grind, cable, PHC), each with crew hours, equipment and disposal. Options the customer can tick. |
| `route` and `route_stop` (same list every storm) | Schedule board by day: job needs crew size + equipment; drag to a day and crew. Routes stay for PHC. |
| `storm` and `storm_run` | `job_day` (one crew, one job, one day). Storm mode returns as an intake queue for emergency calls. |
| Weather trigger: snowfall at the lot | Weather check: wind gusts, lightning, rain and heat at the job on the scheduled day. Alerts the office to move jobs; it never cancels on its own. |
| `site_walk_item` (damage, pile, hazard) | Property walk before work: driveway, lawn path, fences, structures, wires. Required before equipment moves. |
| Billing drafts after a storm with flags | Invoice at job close from the signed estimate plus approved change orders. Flags: tree marked done with no after photo, line done that wasn't signed, estimate line not done. |
| Salt ledger | Disposal and materials per job: loads to the dump and fees, chips, logs; PHC products used. |
| `bid` pipeline (lead, site walk, quote sent, won, lost) | Same stages, and it becomes the front door: most tree revenue starts as an estimate. |

## New

- **Marked-tree estimate.** Draw on the photo (circle the tree, line the cut), number it, pin it. The customer signs the
  marked photos. The crew sees the same thing and confirms the tree with a photo before cutting.
- **Job briefing with sign-offs.** Prefilled hazards from the estimate, nearest hospital, 911 address, roles, rescue
  plan; each worker taps to sign; late arrivals too; re-brief when something changes.
- **Pre-work checks that gate scheduling.** Permit, 811 ticket and its clear date, HOA approval, power line clearance.
- **Equipment as a schedulable thing.** A crane or grinder can't be in two places.
- **Change orders on site.** Customer adds "while you're here" work on the crew link with a price and signs on the
  crew's phone or by text.
- **PHC application records.** Product, EPA number, rate, area, start/stop, applicator license, weather at the time;
  kept for the state's retention period and sent to the customer.
- **Storm intake and triage.** Caller photos, danger level, wire-down routed to the utility, deposit, adjuster packet.

## Not reused

- NBM/HRRR snowfall, MRMS, NOHRSC: snow specific. The NOAA GRIB2 reader stays useful for wind gust
  and thunder forecasts (NBM carries both).
- Per-inch pricing, refreeze alerts, salt ordering.
- Auto-measured lot area for pricing. Tree pricing isn't by area.

## How to start the code when it's time

Fork Flake's repo into a new one rather than sharing packages: the domain tables differ too much, and Flake is live
with pilot customers, so tree changes must never ride along on Flake deploys. Keep `providers`, `ui`, the link app and
outbox, the proof engine, payments and SMS; replace the snow tables and screens. Flake's rules still apply in the new
repo: no new npm dependencies without Sam's OK, migrations before code, text-only messaging.
