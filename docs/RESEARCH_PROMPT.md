# Prompt: research and write the build spec for the tree app

Paste everything below the line into the research agent.

---

You are researching and writing the complete build spec for a new software product: operations software for tree
removal and tree care companies. When you finish, a coding agent must be able to build the whole product end to end
from your document alone, without asking questions. Treat this like the spec a staff engineer and a product lead would
write together after a month of customer research.

## 1. Background

The owner (Sam, 216LABS) built **Flake**, operations software for small snow plow companies (1 to 25 trucks). A friend
who works at **Davey Tree** says Davey is looking for something like Flake for tree work. Sam wants a product that
works for Davey (an enterprise buyer) and for the many small tree companies.

Flake in short: weather-triggered storm dispatch; a no-install driver app opened from a text link (offline outbox,
idempotent sync, big glove-friendly buttons, English/Spanish); append-only visit records with hashed photos;
proof packet PDFs for slip-and-fall claims; billing drafts with flags, Stripe Connect with a small fee on payments
(software is free, Pro plan $79/mo); QuickBooks Online sync; subs and sub pay; insurance certificates; claims log;
equipment log; payroll export; profit per site; branches; text-only customer messages with consent. Stack: TypeScript
strict, Next.js App Router, pnpm + Turborepo, Tailwind + shadcn, Supabase (Postgres, Auth, Storage, row level
security for multi-tenant), Drizzle, Vercel + Vercel Cron, Stripe Connect, Twilio, react-pdf, MapLibre, free NOAA
weather data. Every third party sits behind an interface with a deterministic mock so the app runs with no keys.

### Files to read first, if you have file access

Workspace: `c:/Users/samfi/OneDrive/Desktop/216LABSSTUFF/`

- `tree-app/README.md`, `tree-app/RESEARCH.md`, `tree-app/FLAKE_REUSE.md`, `tree-app/PLAN.md`: the first pass of
  research and a draft plan. Build on them; don't redo them. Check their claims and correct anything wrong.
- `flake/README.md`, `flake/docs/PLAN.md`, `flake/docs/BUILD_SPEC.md`: the format and depth your output should match
  or beat. BUILD_SPEC has the SQL schema, RLS rules, API routes, jobs, engines and screen-by-screen acceptance criteria.
- `flake/docs/DECISIONS.md`, `flake/docs/DESIGN.md`, `flake/docs/UX_BLUEPRINT.md`, `flake/docs/WISHLIST.md`,
  `flake/docs/ADDENDUM_*.md`, `flake/docs/SCALE.md`, `flake/docs/SSO_SETUP.md`, `flake/docs/SECURITY_QUESTIONNAIRE.md`.
- `flake/packages/db/supabase/migrations/*.sql` (the real schema, 47 tables), `flake/packages/core/src/*.ts` (pure
  engines), `flake/packages/providers/src/` (provider interfaces and mocks), `flake/apps/web/app/` (routes and screens).

Read only. Don't change anything in `flake/`.

If you don't have file access, work from this prompt and say in your document which Flake details you couldn't check.

### What the first pass found (verify and go deeper)

1. Wrong tree cut, or the estimate doesn't reach the crew (seller isn't the doer; tape moves; timber trespass damages).
2. Estimates miss on hours, so schedules break (crane costs swing bids).
3. Scheduling crews plus equipment plus weather (wind, lightning, rain, heat); rescheduling loses customers.
4. Safety: OSHA and ANSI Z133 require a pre-job briefing; Z133's 2026 revision reportedly stresses documentation.
5. Property damage claims (ruts, cracked driveways) and pre-existing damage.
6. Pre-work checks: tree removal permits (protected trees by trunk size), 811 locate before stump grinding, power lines.
7. Field apps freeze; crews won't install another app; weak signal in backyards.
8. Storm work: surge, triage, insurers paying, collecting from homeowners.
9. Price: ArboStar ~$149/mo, Arborgold $129/mo, SingleOps ~$200/user/mo, Jobber $39 to $199/mo.
10. Plant health care (PHC) pesticide application records required by state law.

Davey: $1.95B revenue in 2025, two segments (Residential/Commercial, Utility), employee-owned, Kent, Ohio. Sales is
done by ISA-certified Arborist Sales Representatives who estimate, build PHC programs and set up crews. Davey owns
TreeKeeper (tree inventory software). No public source names the system its R/C crews work from.

## 2. Rules

1. **Cite everything factual** with a link. Mark every statement as **[V]** verified from a source you opened,
   **[J]** your judgment or design choice, or **[T]** must be checked against live docs during the build. Quote
   customers word for word or not at all.
2. **Never invent** customers, quotes, reviews, statistics, prices, regulations or weather values. If you can't find
   it, write "not found" and what you searched. Vendor blogs are allowed but label them "vendor source" and don't use
   their numbers as fact.
3. Prefer primary sources: OSHA, ANSI/ISA, TCIA, state statutes and agencies, city codes, BLS, SEC filings, vendor
   pricing pages, app store reviews, Capterra/G2 reviews, ArboristSite, TreeBuzz, Reddit (r/arborists, r/Arborist,
   r/treeremoval, r/landscaping, r/smallbusiness), YouTube comments from arborist channels, TCI Magazine, Arbor Age.
   If a site blocks fetching, try search-result excerpts, archive.org, or another mirror, and say which you used.
4. Write plainly. Short sentences. No buzzwords. No em dashes. Define any trade or technical term the first time
   (DBH, PHC, Z133, RUP, RLS, idempotent).
5. Make decisions. Where there's a choice, pick one, give the reason in one or two lines, and list the rejected options
   in DECISIONS. Only leave something open if it truly depends on an answer from Davey or a customer; list those
   together at the end.
6. Don't contact anyone, sign up for trials that need a card, or post anything. Read only.

## 3. Research to do

Go deep on each. Aim for at least 60 distinct sources overall.

### A. The work itself
- The full job lifecycle for removal, pruning, stump grinding, cabling/bracing, PHC, land clearing, and storm work.
  Who does each step, what they record, what's handed off, and where it breaks.
- How crews are built (sizes, roles: crew leader, climber, groundworker, operator) and what equipment each job type
  needs (chipper, grinder, bucket truck, crane, mini loader, log truck, mats).
- How estimates are priced in practice: per tree, hourly, crew-day rate, equipment day rates, crane by the hour,
  disposal, access difficulty, risk. Find real worked examples from forums. What line items appear on real estimates.
- Deposits, payment terms, financing, how commercial/HOA/property management clients pay, how insurers pay.
- Seasonality and what the slow season looks like.

### B. Pain points
- Expand all 10 above with more first-hand evidence. Find new ones the first pass missed (hiring and turnover, crew
  accountability and time theft, fuel, equipment downtime, subcontractor reliability, lead response time, no-shows,
  review management, chips and wood disposal, neighbor complaints, HOA approvals).
- For each: who feels it, how often, what it costs, how they handle it today, what a tool must do to fix it.
- Rank them and explain the ranking.

### C. Regulation and safety (US)
- OSHA rules that apply to tree work (1910.269 line clearance, 1910.266 where relevant, general duty, PPE, chain saw,
  aerial lifts, cranes 1926 Subpart CC and when it applies to tree work). What must be recorded and kept, and for how
  long.
- ANSI Z133: current edition, what the 2026 revision changes (find the actual changes), what it says about job
  briefings, electrical hazard distances, aerial rescue, chipper and crane operations.
- Line clearance: who may work within what distance of energized lines, and what the software must stop or warn.
- 811: rules for the top 10 states by tree service count. Ticket lead times, how long a ticket stays valid.
- Tree removal permits and protected tree ordinances: survey at least 15 cities including Cleveland, Kent, Columbus,
  Cincinnati, Pittsburgh, Atlanta, Charlotte, Tampa, Austin, Portland, Seattle, Los Angeles, Chicago, Minneapolis,
  Boston. What triggers a permit, timelines, replanting or fee rules.
- Pesticide application records for PHC: federal RUP rules plus at least 10 states (include OH, PA, NY, NJ, MA, MD, IL,
  CA, FL, TX, WA). Required fields, retention, when the customer gets a copy, notification and posting rules.
- Licensing: states that license arborists or tree workers (e.g., NJ, MD, CT, LA), and contractor licensing.
- Workers' comp class codes for tree work and what insurers want documented.
- Texting rules (TCPA, 10DLC vs toll-free, consent) as they apply to job reminders and invoices.

### D. Davey Tree specifically
- Structure: segments, divisions (Residential, Commercial Landscape Services, Utility, Davey Resource Group), number of
  offices, headcount, recent acquisitions, employee ownership. Use the 10-K and annual report.
- What software and devices they use (job postings are the best source: search jobs.davey.com and LinkedIn for system
  names, ERP, CRM, GIS, mobile tools, "Salesforce", "Oracle", "SAP", "Workday", "ESRI", "iPad").
- How an Arborist Sales Representative works day to day; how jobs get to crews; how safety is documented (Davey
  publishes safety material).
- What an enterprise sale to Davey would need: security review items, SSO, data residency, integrations, pilot
  structure. List what Flake already has toward this.
- Also look at Bartlett Tree Experts, SavATree, and large franchises (e.g., Monster Tree Service) for what tools big
  tree companies use.

### E. Competitors
For each of ArboStar, Arborgold, SingleOps, Jobber, Service Autopilot, LMN, Aspire, QuoteIQ, Housecall Pro,
TreeKeeper, Arbor Note, PlantCare/other PHC tools, and any tree-specific tool you find: current public price, who it's
for, feature list (estimates with tree mapping? crew app offline? job briefings? PHC records? equipment scheduling?
deposits?), mobile app ratings and the most common complaints (quote them), integrations. Build a feature comparison
table. Say where the gaps are.

### F. Search demand
Free keyword data if you can get it (Google Keyword Planner ranges, Google Trends, autocomplete, "People also ask")
for terms like tree removal estimate template, tree service contract, tree service invoice template, tree removal cost
calculator, job briefing form, tree service software. Mark the data source and whether it's a range or exact.

### G. Weather and data
- Which free NOAA data gives wind gusts, thunderstorm probability, precipitation and heat index per point per hour
  (NWS gridpoints API, NBM). Exact endpoints, update times, limits, terms of use. Commercial use must be allowed.
- Free parcel and property line data nationally (county GIS, Regrid free tier terms, state portals). What's actually
  usable for commercial software.
- Satellite or aerial imagery for drawing tree pins (terms of use matter: what can be shown in a commercial app for
  free).
- Tree species lists (common names, Latin names) and whether a free, licensable list exists.
- Nearest hospital lookup for the job briefing (free source, terms).

## 4. Shared code with Flake: give a recommendation

Sam hasn't decided whether the tree app should share code or infrastructure with Flake. Compare these options and
recommend one, with reasons:

1. **Fully separate:** copy what's useful into a new repo, new Supabase project, new Vercel project. Zero coupling.
2. **Shared packages, separate apps:** one monorepo (or published internal packages) with common `providers`, `ui`,
   offline outbox, proof engine, payments, SMS; separate apps, databases and deploys.
3. **One platform, two products:** same codebase and database, with the product as a tenant setting.

Weigh: Flake is live with pilot customers and deploys automatically from main, so a tree change must never break a
snow customer; a solo developer working with AI agents; speed to a Davey pilot; enterprise security review (Davey may
want its data isolated); cost on free tiers; how much code is truly shared once the domain tables differ. List
exactly which Flake modules would be shared or copied under the recommended option, and the plan to keep them in sync
(or not).

## 5. The document to write

Save it as `c:/Users/samfi/OneDrive/Desktop/216LABSSTUFF/tree-app/SPEC.md` (if you can't write files, output it in
full). If it runs long, split into `SPEC.md` plus `SPEC_*.md` addenda linked from SPEC.md, the way Flake has
`ADDENDUM_*.md`. Also write `tree-app/SOURCES.md` listing every source with its URL, date checked, and what it was
used for.

Required sections:

1. **Summary.** The product, who buys it, the promise in one sentence, and the three things that make it different.
2. **Research findings.** Pain points ranked with evidence; how the work runs; Davey; competitors with the comparison
   table; regulations; search demand.
3. **Personas.** Each with context (device, gloves, signal, language), what they came to do, and what makes them quit.
4. **Scope.** Must have / Differentiators / Later / Not doing, each item numbered (M1, D1, L1, N1) with a one-line
   reason tied to a pain point.
5. **Pricing and business model.** Small-shop plan and enterprise plan, with numbers and reasons. Payment fee and cap.
6. **Architecture.** The shared-code recommendation from section 4. Stack (default to Flake's stack unless you have a
   strong reason, and say why). Repo layout. Environments. Mock mode. Where Flake code is reused, by file path.
7. **Data model.** Full SQL `create table` statements for every table with types, checks, foreign keys and indexes;
   which tables are append-only; row level security policies for each table and role; storage buckets and paths.
   Include tenants, branches, users and roles, customers, properties, trees, tree photos with markup, estimates and
   lines and options, signatures, deposits, pre-work checks (permit, 811, HOA, line clearance), jobs, job days,
   schedule, crews, equipment and bookings, crew links, briefings and sign-offs, work log, per-tree confirmations,
   change orders, photos, corrections, invoices, payments, disposal, PHC programs and application records, products
   with EPA numbers, storm intake, claims, certificates, messages and consent, weather snapshots, jobs queue, audit log.
8. **Roles and permissions.** Owner, office, sales arborist, crew leader, crew member, sub, customer, adjuster/HOA
   viewer, enterprise admin. A matrix of who can see and do what.
9. **API.** Every route with method, path, auth, zod input and output shape, errors, idempotency.
10. **Background jobs and cron.** Each job, its trigger, retries, and what happens on failure.
11. **Engines.** Pure functions with inputs, outputs and rules: estimate pricing, estimate vs actual, equipment
    conflict check, weather thresholds, pre-work gating, invoice from estimate plus change orders, billing flags, proof
    manifest and hash, PHC record builder, storm triage order, payment fee.
12. **Screens.** Every screen, phone and desk, in the format of Flake's BUILD_SPEC section 6: who opens it and when,
    what goes first, layout, every action, empty states, errors, and numbered acceptance criteria. Must include the
    sales arborist's estimate builder with photo markup and pins, the customer's estimate approval page, the schedule
    board, the crew link (offline), the job briefing with sign-offs, the per-tree confirm flow, change orders, close
    and bill, proof packet, storm intake, PHC visit, settings, onboarding (target: new company set up in 15 minutes),
    marketing pages and free SEO tools.
13. **Customer messages.** Every text, its trigger, the exact wording in English and Spanish, and consent rules.
14. **Integrations.** Each provider: interface, real implementation, mock, limits, terms of use, costs. Stripe,
    Twilio, weather, maps and imagery, parcels, geocoder, QuickBooks Online, calendar sync, SSO (SAML/OIDC for
    enterprise), PDF.
15. **Security and compliance.** Tenant isolation, audit log, data retention by record type (tie to the state rules
    you found), backups, what an enterprise security questionnaire will ask and the answers.
16. **Testing.** Unit, row level security, integration and end-to-end tests to write, including: offline crew flow
    syncs exactly once; equipment can't double-book; an unsigned change order never reaches an invoice; a job with an
    open pre-work check can't be scheduled without a logged override; proof packet hash is stable; tenant A can never
    read tenant B.
17. **Seed data.** A realistic demo tenant (fictional, clearly labeled demo) with properties, trees, estimates, jobs,
    crews and equipment, so the app demos with no keys.
18. **Build order.** Milestones in order, each with what "done" means. The first milestone should be a demo-able
    slice for a Davey pilot conversation.
19. **Decisions.** Every choice made, the reason, the options rejected.
20. **Open questions.** Only those that need Davey or a customer to answer, grouped, each saying what it blocks.

## 6. Quality bar before you finish

- A coding agent could create the database, API and every screen from your document with no guessing.
- Every factual claim has a link and a [V]/[J]/[T] mark. Nothing is invented.
- Every Must have item maps to at least one pain point, one screen, one table and one test.
- The shared-code recommendation is a clear choice, not a survey.
- Read your document once as the coding agent and fix anything vague, contradictory, or missing.

When done, reply with: where the files are, the five most important findings, your shared-code recommendation in two
lines, and the open questions for Davey.
