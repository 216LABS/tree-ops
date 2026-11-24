# Tree Ops Build Spec (SPEC.md, with SOURCES notes)

The recommended product is a tree-work operations app built as a separate copy of Flake's proven parts. The wedge is one thing no competitor does well: carrying the sales arborist's marked trees, photos and safety facts to the crew on a phone that works offline, then proving what was cut, signed and briefed. [J]

## TL;DR
- Build "Tree Ops" as a separate repo, Supabase project and Vercel project. Copy Flake's providers, offline outbox, proof engine, payments and SMS with a provenance manifest. Flake is live and auto-deploys from main, so zero coupling protects snow customers and gives Davey isolated data. [J]
- The top pains with first-hand evidence are: the wrong tree cut because the estimate did not reach the crew, field apps that fail offline or lose signatures, and estimates that miss on hours and equipment. The must-haves are pinned trees with photo markup, an offline crew link with per-tree confirm, a signed briefing, and gating for pre-work checks such as 811 and permits. [V for evidence, J for scope]
- Davey (FY2025 revenue $1,947,969K, up 5.8% per its 10-K; about 12,300 employees; two segments) is a sales-arborist-led business that is also implementing a new ERP system. A pilot should be one Residential district with SSO, data export and no ERP integration at first. Davey's field system name was not found. [V/J]

## 0. Session limits (read first)
- I could not read the local files in tree-app/ or flake/. These Flake details are unchecked: real table names and the 47-table schema, provider interfaces, file paths, the proof hash format, the payment fee and cap, outbox design, Spanish strings, RLS helpers, cron names, and the SSO_SETUP and SECURITY_QUESTIONNAIRE contents. Every Flake file path below is [T]. [J]
- I ran 18 web searches, made 3 full fetches and used 1 research subagent, far short of the 60-source target. Not researched this session: 811 rules beyond Ohio, 14 of the 15 permit cities, PHC rules for 9 of 11 states, licensing, TCPA/10DLC, search demand, imagery terms, species lists, the hospital source, and Bartlett, SavATree and Monster Tree tooling. Nothing in those areas was invented. SOURCES.md is built from the citation pass, dated 2026-11-24. [J]

---

## 1. Summary
- **Product:** Tree Ops. It handles estimates with pinned trees, crew scheduling with equipment, an offline crew link, job briefings, PHC records (PHC means Plant Health Care: fertilizing, insect and disease treatments), proof packets and billing. [J]
- **Buyers:** small tree companies with 1 to 25 crews, and enterprise tree care companies (Davey Residential/Commercial first). [J]
- **Promise:** "The tree you sold is the tree we cut, and you can prove it." [J]
- **Three differences:**
  1. Trees are pinned on the sales arborist's photos and map and confirmed one by one by the crew, with a photo before and after. [J]
  2. The crew link needs no install and works offline. It syncs exactly once (Flake's pattern). [J]
  3. Safety and compliance are part of the job flow. The job cannot start without a signed briefing. A job with an open 811 or permit check cannot be scheduled without a logged override. PHC records follow state rules. [J]

## 2. Research findings

### 2.1 Pain points, ranked
Ranking is by frequency in first-hand sources × cost per event × how much software can fix it. [J]

| # | Pain | First-hand evidence | Who feels it | What the tool must do |
|---|---|---|---|---|
| P1 | Wrong tree cut / estimate doesn't reach crew | ArboristSite "Unfortunate Arborvitae Accident": "The service cut down the 3 good ones instead of the 3 dead ones. I had provided photos of the ones to cut down... The work order they gave me stated the ones in the backyard. Someone from the service even came out and marked them with red tape. But the people who did the removal just ignored it all." (homeowner) [V].\[1\] ArboristSite "Worst mistake you've made?": "My guys were supposed to cut down a pear tree and a peach tree. I got to the job and there was a peach tree and a persimmon tree removed... Needless to say I refused payment on that job." [V]\[2\] | Owner, crew leader, customer | Pins on photos and the map, a per-tree confirm with a photo, and a hard stop on "remove" lines until the tree is confirmed |
| P2 | Field apps fail offline, freeze, lose work | ArboStar iOS (3.6 from 35 ratings): "Off-line this app is completely useless." "I've lost several large jobs this way." and "Several times clients have signed contracts on my phone only to have the app loose the signature." [V]\[3\]\[4\] Arborgold Crew, Google Play (2.5, 17 reviews): "so much time wasted sitting waiting for this app to load" [V].\[5\] SingleOps iOS (3.5, 26): "There is no auto save" [V]\[6\] | Sales arborist, crew | Local-first drafts, an outbox, idempotent sync (idempotent: sending twice has the same effect as once), and signatures stored locally before upload |
| P3 | Estimates miss hours and equipment; crane cost swings | ArboristSite crane thread: "$95 an hour for a 28 ton boom truck, $140 an hour for a 40 ton truck crane, $230 an hour for a 65 ton crane." Another poster: "$280 an hour for a 70 ton". [V]\[7\] TreeBuzz "How to bid?": "$2880.00 a day" for a crew with chip truck, chipper, bucket and mini loader. [V]\[8\] | Sales arborist, owner | Equipment-hour lines, crew-day pricing, and an estimate-vs-actual report per job |
| P4 | Crew + equipment + weather scheduling | 1910.269 note: thunderstorms nearby and high winds are "presumed to make line-clearance tree trimming too hazardous". [V]\[9\] No forum quote on rescheduling was found. | Office, crew leader | Equipment conflict check, hourly weather flags, and a reschedule text |
| P5 | Safety documentation (briefings) | 1910.269(c) requires a job briefing before each job (line clearance) [V].\[9\]\[10\] Tim Walsh, a voting ASC Z133 member who chaired two 2026 task groups, says the 2026 revision "shifts many practices from 'should' to 'shall'" (MW-ISA webinar, 21 Jul 2026) [V] | Crew leader, safety manager | Signed briefing per job day, sign-off per worker, nearest hospital, electrical level check |
| P6 | Pre-work checks: 811, permits, lines | Ohio: notify at least 48 hours and no more than 10 working days before digging (ORC 3781.28) [V].\[11\]\[12\] Atlanta: permit for trees 6 in DBH or more (12 in for pines) (Trees Atlanta) [V]\[13\] | Sales arborist, office | Pre-work check records with due dates and gating |
| P7 | Property damage and pre-existing damage claims | Not found as a first-hand quote this session | Owner | Hashed before/after photos and a proof packet |
| P8 | PHC records required by law | 7 CFR 110.3(e): copy to customer within 30 days of an RUP application (RUP means Restricted Use Pesticide) [V]\[14\] | PHC tech, office | A record builder from the visit, with a customer copy sent automatically |
| P9 | Storm surge, triage, collections | Davey FY2025 10-K: Utility growth was "partially offset by lower storm damage revenue," and R/C growth was "partially offset by a decrease in storm damage service" [V]. No small-shop quote found | Owner, office | Storm intake queue, triage order, deposit link |
| P10 | Hiring/turnover | Davey 10-K risk factor: "We may be unable to employ a sufficient workforce for our field operations." [V]\[15\] | Owner | Spanish UI, no install, 10-minute crew onboarding |

Not found this session: first-hand evidence on time theft, fuel, sub reliability, lead response, no-shows, reviews, chip disposal, neighbors, HOA approvals. These are not ranked. [J]

### 2.2 How the work runs [V where marked, else J]
- Lead → site visit by a sales arborist → estimate (per tree, crew-hour, or crew-day) → customer approval and deposit → pre-work checks (811 for stump grinding, permit, HOA, utility line) → schedule a crew plus equipment → morning briefing → work with per-tree completion → cleanup and disposal → invoice → payment. [J]
- At Davey, the Arborist Sales Representative will "Provide customers with estimates based on their needs," "Develop and update annual plant health care programs," and "Set up and supervise crew members assigned to customer jobs" (Davey job posting, Concord MA, Req 217285). [V]\[16\]\[17\]
- Real pricing inputs from forums: "$125/ hr for a truck and chipper, mini with attachments runs $150" (TreeBuzz "Hourly rates", 2012).\[18\] These are old, so treat them as structure, not current prices. [V]
- Per-tree risk: "Say you bid a grand per tree. Whose to say they don't have you do all the $2k trees then cut you loose?" (TreeBuzz "How to bid?").\[8\] The pricing engine therefore supports option groups and minimums. [V/J]
- Seasonality: Davey's sales and earnings "are generally highest in the second and third quarters" (10-K). [V]\[15\]
- Crane rule: OSHA 1926.1400(c)(13) excludes "Tree trimming and tree removal work" from Subpart CC (eCFR). [V]\[19\]\[20\] Crane jobs are still flagged for a lift plan as a company setting. [J]

### 2.3 Davey [V unless marked]
- Two segments: Residential and Commercial, and Utility (10-K FY2025).\[15\]\[21\] The 10-K says that as of December 31, 2025, Davey "employed approximately 12,300 people," 92% in the US and 8% in Canada, with 98% full time and 11% covered by a collective bargaining agreement. Founded 1880, based in Kent, OH.\[22\]\[23\] Employee-owned:\[22\] shares are not publicly traded; there is an employee stock purchase plan at a 15% discount.
- Revenue: $1,947,969K in 2025 versus $1,841,687K in 2024, up $106,282K or 5.8% (FY2025 10-K). R/C was up $57.2M (7.0%), "driven by strong performance in Commercial Landscape Services". Utility was up $54.2M (5.4%). The 10-K says PG&E, the largest customer, brought "approximately $167 million, or approximately 9% of total revenues."
- Risk factor: "our ability to successfully implement our new enterprise resource planning system".\[15\] A new ERP is in flight, so integration targets may shift. [V; implication J]
- Safety: Davey's "Close Call Communicator" safety reporting platform has run since 2017.\[15\] DaveyConnect is a company news app (iOS, 3.1 from 36 ratings).\[24\]\[25\]
- Field system for R/C crews, CRM, ERP vendor, GIS: **not found** (I searched jobs.davey.com postings and ZoomInfo).\[16\]\[26\]
- Enterprise needs [J]: SAML SSO, isolated database, CSV/API export, audit log, data retention controls, a security questionnaire, a branch hierarchy (region/district), and a 90-day pilot in one district.

### 2.4 Competitors

| Product | Public price | Crew app rating (store, count) | Tree pins/inventory | Offline crew | Briefing | PHC records | Equip. scheduling |
|---|---|---|---|---|---|---|---|
| ArboStar | From $149/mo billed yearly, 1 office + 1 crew login (vendor site) [V]\[27\]\[28\] | iOS 3.6 (35); ArboStar Plus 3.4 (24) [V]\[4\]\[29\] | Tree inventory (vendor) [V]\[28\] | Complaints say no [V]\[3\] | not found | not found | Equipment logs (Capterra profile) [V]\[30\] |
| Arborgold | Starter $129, Pro $299, Ent $499/mo (annual pay); $149/$343/$573 (monthly pay); 12-mo contract, 60-day notice (third-party review of pricing page) [V]\[31\]\[32\]\[33\] | Crew, Google Play 2.5 (17) [V]\[5\] | Mapping on Enterprise [V]\[31\]\[33\] | not found | not found | Chemical tracking on Pro [V]\[34\] | Equipment maintenance on Ent [V]\[31\] |
| SingleOps (Granum) | Essential $220/mo ($200 annual), Plus $385 ($350), Premier $550 ($500); crew users free [V]\[35\]\[36\] | iOS 3.5 (26) [V]\[6\] | Tree inventory [V]\[37\] | not found | not found | PHC programs [V]\[37\] | not found |
| Jobber | Core $49/mo with no commitment, $39 on a 1-year commitment, $29 prepaid annually; extra users $29/mo each (TrustPro, checked Aug 2026, third-party source) | Google Play 4.4 (7.01K) [V]\[38\] | No tree-specific | Reviews cite freezes [V]\[38\] | No | No | No |

Not checked this session: QuoteIQ, ArborDash, Service Autopilot, LMN, Aspire, Housecall Pro, TreeKeeper (owned by Davey), Arbor Note, PlantCare. **Gaps** [J]: no competitor shows pinned per-tree crew confirmation, a signed briefing tied to the job, pre-work gating, or a hashed proof packet.

### 2.5 Regulation and safety
- **OSHA 1910.269** (line clearance only, meaning work for or on behalf of the utility). Job briefing before each job (1910.269(c)).\[9\]\[10\] A second line-clearance trimmer must be within voice range when approaching closer than 10 ft to conductors over 750 V (1910.269(r)(1)(ii)).\[39\] 1910.269 "does not apply to tree trimming operations performed by unqualified employees" (OSHA eTool). [V]\[40\]
- **ANSI Z133-2026** (the US arboriculture safety standard). It was published 27 May 2026, and the digital copy is free in English and Spanish (ISA).\[41\] Four electrical levels: L1 unqualified; L2 up to 750 V; L3 up to 35 kV; L4 line clearance, all voltages. "Incidental line clearance" is removed. L3 work within 10 ft of lines over 35 kV needs a utility-coordinated abatement plan. RF (radio frequency) awareness training is added (TCI Magazine, Walsh, Aug 2026). [V]\[42\] Text on briefings, aerial rescue, chippers and the MAD tables: [T], read the free PDF.
- **Software rule from this** [J]: each worker has `electrical_level` 1 to 4, and each tree has `near_lines`. The electrical gate in section 11 enforces it. Utility line-clearance work is out of scope (N3).
- **811:** Ohio requires notice at least 48 hours and no more than 10 working days ahead. The excavator should hold its own ticket (ORC 3781.28; OHIO811 guidance quoted by utilities). [V]\[12\]\[43\]\[44\] Ticket life in Ohio: not verified. Other states: not found this session. The engine uses per-state config rows marked [T].
- **Permits:** Atlanta requires a permit for trees of 6 in DBH or more (12 in for pines); DBH means trunk diameter at 4.5 ft. Dead, dying or hazardous trees need a permit but no recompense (Trees Atlanta). [V]\[13\]\[45\]\[46\] The City of Atlanta Mayor's Office (16 Jun 2025) says the new ordinance "Increases recompense (tree removal fees) to $140 per diameter inch of tree trunk," effective January 1, 2026, with CPI-U indexing from 1 Jan 2027. This replaces the older $100/tree + $30/inch code text. [V] The other 14 cities were not researched this session.
- **PHC records:** Federal 7 CFR 110.3 requires the product name, EPA registration number, total amount, location, date and applicator name/certification number, recorded within 14 days. Commercial applicators give the customer a copy within 30 days. [V]\[14\] USDA AMS: private applicators keep RUP records 2 years. [V]\[47\] Ohio OAC 901:5-11-10: commercial applicators record "in English, on the date of application", including concentration/dilution and total volume. Employers retain records 3 years. A copy goes to the person contracting within 30 days. [V]\[48\]\[49\]\[50\] Ohio 901:5-11-09: lawn applications require a written notice with product, chemical type, label instructions, company phone and date/time, and pre-notice to abutting neighbors who ask in writing. [V]\[51\]\[52\] Florida: 10 data elements for RUP records and a customer copy within 30 days (UF/IFAS). [V]\[53\] Indiana 355 IAC 4-4-1: customer copy within 30 days. [V]\[54\] PA, NY, NJ, MA, MD, IL, CA, TX, WA: not found this session [T].
- **Workers' comp:** NCCI class 0106 covers tree pruning, spraying, repairing and trimming (insurer pages). [V]\[55\]\[56\]\[57\]\[58\] No rates are quoted.
- **Licensing, TCPA/10DLC:** not found this session [T]. Design default [J]: consent is captured before any text, STOP/HELP are honored, and quiet hours run 8am to 9pm local.

### 2.6 Search demand
Not found. No Keyword Planner, Trends or autocomplete data was collected this session. The SEO tools in M16 are chosen by judgment [J], and the volumes must be pulled before building marketing pages [T].

## 3. Personas [J]
| Persona | Context | Quits when |
|---|---|---|
| Owner (small shop) | Phone in truck, desktop at night | Setup over an hour; contracts |
| Sales arborist (Davey ASR) | iPad or phone in yards, weak signal | App loses an estimate or signature |
| Office/dispatcher | Desktop all day | Double-booked crane |
| Crew leader | Android, gloves, glare, dead zones, EN/ES | Install or login required; freezes |
| Crew member/climber | Shared phone, gloves, often ES | Typing required |
| PHC tech | Phone, spray rig, licensed | Re-typing EPA numbers |
| Customer | Phone, text link | Account creation |
| Adjuster/HOA viewer | Desktop link | Login walls |
| Enterprise admin | Desktop | No SSO; no export |

## 4. Scope
**Must have**
- M1 Estimate builder with tree pins on photo and map (P1, P3)
- M2 Customer approval page with e-signature and options (P1, P2)
- M3 Deposits via Stripe Connect (P9)
- M4 Pre-work checks with gating and override log (P6)
- M5 Schedule board for crews + equipment with conflict check (P3, P4)
- M6 Offline crew link, no install, EN/ES (P2, P10)
- M7 Job briefing with per-worker sign-off, electrical level check, hospital (P5)
- M8 Per-tree confirm with before/after photos (P1)
- M9 Change orders signed by customer (P1, P3)
- M10 Close and bill: invoice from estimate + signed change orders (P3)
- M11 Proof packet PDF with hash (P7)
- M12 PHC programs and application records with customer copy (P8)
- M13 Weather flags per job day (P4)
- M14 Texts with consent (P2, P9)
- M15 Tenants, branches, roles, RLS, audit log (Davey)
- M16 Onboarding in 15 minutes plus one free SEO tool (Tree job briefing form PDF) (P5, growth)

**Differentiators:** D1 estimate-vs-actual per job (P3). D2 storm intake and triage queue (P9). D3 SAML SSO (Davey). D4 equipment maintenance hours (P3).
**Later:** L1 QuickBooks Online sync. L2 parcel lines via Regrid (paid). L3 calendar sync. L4 sub pay. L5 permit rules library per city. L6 811 ticket API. L7 financing.
**Not doing:** N1 native app store app (crews won't install, P2). N2 payroll processing (export only). N3 utility line clearance programs (separate market, 1910.269 scope). N4 tree inventory for cities (TreeKeeper exists).

## 5. Pricing [J]
- **Free:** 1 branch, 2 crews, unlimited users. Card payments carry a platform fee of 1% per payment, capped at $15. This follows Flake's free-plus-fee model; Flake's actual fee and cap are unchecked [T].
- **Pro $99/mo:** unlimited crews, PHC, proof packets, storm, QuickBooks (when L1 ships). Month to month. Reason: it undercuts Arborgold Starter ($129 annual) and SingleOps Essential ($200 annual)\[31\]\[35\] with no contract, against contracts that customers dislike.
- **Enterprise:** $25 per active crew per month, $1,500/mo minimum, annual. It includes SSO, an isolated database, audit export and a 99.9% target. Payment fee: 0.5%, capped at $10, or off if the tenant uses its own processor. Reason: Davey bills on crews, not desk users. The minimum covers security review cost.
- Fee engine: `fee = min(round(amount * rate), cap)`, never charged on refunds, and recorded per payment.

## 6. Architecture

### 6.1 Shared-code decision: Option 1, fully separate, copy with provenance
- **Why:** Flake is live with pilot customers and deploys from main. With a shared package, every tree change is a snow release risk. Option 1 makes that impossible. A solo developer with agents moves faster with one product per repo. Davey's security review is simpler with a separate Supabase project and Vercel project ("your data is in its own database"). Once the domain tables differ (trees, estimates, PHC vs sites, storms, plow visits), the truly shared code is only providers, the outbox, hashing/PDF helpers, the payment fee and SMS. That is copyable in a day. [J]
- **Rejected:** Option 2, shared packages: a monorepo couples deploys, and published packages add versioning work for one person. Option 3, one platform: it mixes snow and tree data in one database and fails "isolate Davey's data." [J]
- **Sync plan:** `COPIED_FROM_FLAKE.md` lists each copied file, its Flake path and commit SHA. `pnpm flake:diff` prints drift against a local Flake checkout. Security fixes are ported within 7 days; everything else is optional. Re-decide extraction after the Davey pilot (D-2). [J]

**Files to copy (Flake paths are [T]):** `packages/providers/src/{sms,payments,weather,pdf,geocode,storage}/*` with mocks; `packages/core/src/{proofHash,paymentFee,billingFlags,idempotency}.ts`; the offline outbox from `apps/web/app/(crew)/*` and its service worker; the RLS helper SQL from `packages/db/supabase/migrations/*`; ui primitives from `packages/ui`.

### 6.2 Stack
Same as Flake: TypeScript strict, Next.js App Router, pnpm + Turborepo, Tailwind + shadcn, Supabase (Postgres, Auth, Storage, RLS), Drizzle, Vercel + Vercel Cron, Stripe Connect, Twilio, react-pdf, MapLibre, NWS weather. Reason: proven, and one developer knows it. [J] RLS means row level security: Postgres checks each row against the user's tenant.

### 6.3 Repo layout
```
tree-ops/
  apps/web/app/(marketing) (app) (crew)/c/[token] (customer)/e/[token] (viewer)/v/[token] api/
  packages/core/src/      pure engines (section 11)
  packages/providers/src/ interfaces + real + mock
  packages/db/            drizzle schema, supabase/migrations, seed
  packages/ui/
  COPIED_FROM_FLAKE.md
```
**Environments:** local (Supabase CLI, `MOCK_MODE=1`), preview (Vercel preview + Supabase branch), prod. Enterprise tenants who require it get a dedicated Supabase project with the same code, one deploy per enterprise. [J]
**Mock mode:** when a provider key is missing, the mock loads. Mocks are deterministic. Weather is seeded by lat/lon/date, SMS writes to `messages` with status `mock_sent`, and Stripe returns `pi_mock_<hash>`.

## 7. Data model
Conventions: every table has `id uuid primary key default gen_random_uuid()`, `tenant_id uuid not null references tenants(id)` (except `tenants`), `created_at timestamptz not null default now()`, and an index on `tenant_id`. Money is `integer` cents. **Append-only** tables (marked AO) have a trigger `forbid_update_delete()` that raises an exception on UPDATE/DELETE. Corrections go in `corrections`.

```sql
create table tenants(id uuid primary key default gen_random_uuid(), name text not null, plan text not null check(plan in('free','pro','enterprise')), stripe_account_id text, default_locale text not null default 'en' check(default_locale in('en','es')), state_code char(2) not null, created_at timestamptz not null default now());
create table branches(name text not null, parent_id uuid references branches(id), timezone text not null, address text, lat numeric(9,6), lon numeric(9,6));
create table memberships(user_id uuid not null references auth.users(id), branch_id uuid references branches(id), role text not null check(role in('owner','office','sales_arborist','crew_leader','crew_member','sub','enterprise_admin')), unique(tenant_id,user_id,branch_id));
create table workers(user_id uuid references auth.users(id), full_name text not null, phone text, locale text default 'en', electrical_level smallint not null default 1 check(electrical_level between 1 and 4), isa_cert_no text, applicator_license_no text, applicator_license_state char(2), active boolean default true);
create table customers(branch_id uuid references branches(id), kind text not null check(kind in('residential','commercial','hoa','property_mgr','municipal')), name text not null, phone text, email text, locale text default 'en', billing_terms_days int default 0);
create table properties(customer_id uuid not null references customers(id), address text not null, lat numeric(9,6), lon numeric(9,6), state_code char(2) not null, city text, hoa_name text, access_notes text, gate_code_enc text);
create table trees(property_id uuid not null references properties(id), label text not null, species_common text, species_latin text, dbh_in numeric(5,1) check(dbh_in>0), height_ft int, lat numeric(9,6), lon numeric(9,6), condition text check(condition in('good','fair','poor','dead','hazard')), protected_flag boolean default false, near_lines text check(near_lines in('none','service_le_750v','dist_le_35kv','gt_35kv')));
create table tree_photos(tree_id uuid references trees(id), estimate_id uuid, storage_path text not null, sha256 char(64) not null, taken_at timestamptz, lat numeric(9,6), lon numeric(9,6)); -- AO
create table photo_markups(photo_id uuid not null references tree_photos(id), tree_id uuid not null references trees(id), shape jsonb not null, color text not null, number smallint not null); -- AO, new row per edit
create table estimates(property_id uuid not null references properties(id), sales_user_id uuid not null, status text not null check(status in('draft','sent','approved','declined','expired')), version int not null default 1, valid_until date, notes text, total_cents int not null default 0, deposit_pct smallint default 0 check(deposit_pct between 0 and 100), public_token_hash char(64) unique);
create table estimate_options(estimate_id uuid not null references estimates(id) on delete cascade, name text not null, required boolean default false, selected boolean default false, sort smallint);
create table estimate_lines(option_id uuid not null references estimate_options(id) on delete cascade, tree_id uuid references trees(id), kind text not null check(kind in('remove','prune','stump_grind','cable_brace','phc','clearing','crane','equipment','disposal','permit_fee','other')), description text not null, qty numeric(8,2) not null check(qty>0), unit text not null check(unit in('each','hour','day','inch_dbh','load','lump')), unit_price_cents int not null check(unit_price_cents>=0), est_crew_hours numeric(6,2), equipment_type text);
create table signatures(subject_type text not null check(subject_type in('estimate','change_order','briefing','phc_notice')), subject_id uuid not null, signer_name text not null, signer_role text, image_path text not null, sha256 char(64) not null, signed_at timestamptz not null, ip inet, user_agent text, client_id uuid not null unique); -- AO
create table deposits(estimate_id uuid not null references estimates(id), amount_cents int not null check(amount_cents>0), status text not null check(status in('pending','paid','refunded','failed')), stripe_pi text unique);
create table prework_checks(job_id uuid not null, kind text not null check(kind in('811','permit','hoa','utility_line','neighbor','other')), status text not null check(status in('needed','requested','cleared','not_required','overridden')), ref_no text, requested_at timestamptz, valid_from timestamptz, valid_until timestamptz, file_path text, override_reason text, override_by uuid);
create table jobs(estimate_id uuid not null references estimates(id), property_id uuid not null references properties(id), branch_id uuid references branches(id), status text not null check(status in('unscheduled','scheduled','in_progress','done','billed','cancelled')), required_electrical_level smallint default 1, needs_crane boolean default false, storm_event_id uuid);
alter table prework_checks add foreign key(job_id) references jobs(id);
create table crews(branch_id uuid references branches(id), name text not null, leader_worker_id uuid references workers(id), active boolean default true);
create table crew_members(crew_id uuid not null references crews(id), worker_id uuid not null references workers(id), unique(crew_id,worker_id));
create table equipment(branch_id uuid references branches(id), name text not null, type text not null check(type in('chipper','grinder','bucket','crane','mini_loader','log_truck','mats','chip_truck','spray_rig','other')), hour_meter numeric(8,1), active boolean default true);
create table job_days(job_id uuid not null references jobs(id), crew_id uuid references crews(id), day date not null, start_time time, est_hours numeric(5,2), status text not null check(status in('planned','briefed','working','closed','weather_hold')), unique(job_id,day,crew_id));
create table equipment_bookings(equipment_id uuid not null references equipment(id), job_day_id uuid not null references job_days(id) on delete cascade, during tstzrange not null, exclude using gist(equipment_id with =, during with &&));
create table crew_links(job_day_id uuid not null references job_days(id), token_hash char(64) not null unique, expires_at timestamptz not null, revoked boolean default false);
create table briefings(job_day_id uuid not null references job_days(id), leader_worker_id uuid not null references workers(id), hazards jsonb not null, line_proximity text not null, abatement_plan_path text, hospital_name text, hospital_address text, weather_snapshot_id uuid, completed_at timestamptz not null, client_id uuid not null unique); -- AO
create table briefing_signoffs(briefing_id uuid not null references briefings(id), worker_id uuid not null references workers(id), signed_at timestamptz not null, client_id uuid not null unique, unique(briefing_id,worker_id)); -- AO
create table work_log(job_day_id uuid not null references job_days(id), worker_id uuid, kind text not null check(kind in('arrive','start','pause','resume','leave','note','equipment_hours')), at timestamptz not null, value numeric, note text, client_id uuid not null unique); -- AO
create table tree_confirmations(job_day_id uuid not null references job_days(id), tree_id uuid not null references trees(id), line_id uuid not null references estimate_lines(id), result text not null check(result in('done','partial','skipped')), before_photo_id uuid, after_photo_id uuid, confirmed_by uuid not null, at timestamptz not null, client_id uuid not null unique); -- AO
create table change_orders(job_id uuid not null references jobs(id), description text not null, amount_cents int not null, status text not null check(status in('proposed','signed','declined')), signature_id uuid references signatures(id), client_id uuid not null unique, check(status<>'signed' or signature_id is not null));
create table photos(job_day_id uuid references job_days(id), tree_id uuid references trees(id), kind text not null check(kind in('before','after','damage_pre','damage_post','disposal','other')), storage_path text not null, sha256 char(64) not null, taken_at timestamptz not null, lat numeric(9,6), lon numeric(9,6), client_id uuid not null unique); -- AO
create table corrections(target_table text not null, target_id uuid not null, field text not null, new_value jsonb not null, reason text not null, by_user uuid not null); -- AO
create table invoices(job_id uuid not null references jobs(id), number text not null, status text not null check(status in('draft','sent','paid','void')), subtotal_cents int not null, deposit_applied_cents int not null default 0, total_cents int not null, flags jsonb not null default '[]', due_date date, unique(tenant_id,number));
create table invoice_lines(invoice_id uuid not null references invoices(id) on delete cascade, source text not null check(source in('estimate_line','change_order','adjustment')), source_id uuid, description text not null, amount_cents int not null);
create table payments(invoice_id uuid references invoices(id), deposit_id uuid references deposits(id), amount_cents int not null, fee_cents int not null default 0, method text not null check(method in('card','ach','check','cash','insurer')), stripe_pi text unique, received_at timestamptz not null); -- AO
create table disposal_tickets(job_day_id uuid not null references job_days(id), kind text check(kind in('chips','logs','brush','stumps')), site text, loads numeric(5,1), cost_cents int);
create table products(name text not null, epa_reg_no text not null, is_rup boolean not null default false, signal_word text, rei_hours int, unique(tenant_id,epa_reg_no));
create table phc_programs(property_id uuid not null references properties(id), year int not null, status text check(status in('proposed','active','done')), estimate_id uuid references estimates(id));
create table phc_applications(program_id uuid references phc_programs(id), property_id uuid not null references properties(id), applicator_worker_id uuid not null references workers(id), applicator_license_no text not null, product_id uuid not null references products(id), epa_reg_no text not null, target_pest text, site_desc text not null, method text, concentration text, total_amount numeric(10,3) not null, amount_unit text not null, area_treated text, applied_on date not null, start_time time, end_time time, wind_mph numeric(4,1), temp_f numeric(4,1), customer_copy_sent_at timestamptz, client_id uuid not null unique); -- AO
create table storm_events(name text not null, started_on date not null, branch_id uuid references branches(id));
create table storm_intake(storm_event_id uuid not null references storm_events(id), caller_name text, phone text, address text not null, lat numeric(9,6), lon numeric(9,6), on_structure boolean, blocking_access boolean, lines_involved boolean, injury boolean, insurer text, triage_score int, status text check(status in('new','assessed','estimated','scheduled','done','declined')));
create table claims(job_id uuid references jobs(id), opened_on date not null, kind text check(kind in('property_damage','injury','vehicle','other')), description text not null, status text check(status in('open','closed')), viewer_token_hash char(64) unique);
create table certificates(holder text not null, kind text check(kind in('gl','wc','auto','umbrella')), expires_on date not null, file_path text not null);
create table consents(phone text not null, channel text not null default 'sms', status text not null check(status in('opted_in','opted_out')), source text not null, at timestamptz not null); -- AO
create table messages(customer_id uuid references customers(id), to_phone text not null, template text not null, locale text not null, body text not null, status text not null check(status in('queued','sent','mock_sent','failed','blocked_no_consent')), provider_id text);
create table weather_snapshots(lat numeric(9,6) not null, lon numeric(9,6) not null, for_date date not null, source text not null, fetched_at timestamptz not null, hourly jsonb not null, flags jsonb not null); -- AO
create table jobs_queue(kind text not null, payload jsonb not null, run_after timestamptz not null default now(), attempts int not null default 0, last_error text, status text not null default 'queued' check(status in('queued','running','done','dead')), idem_key text unique);
create table audit_log(actor_id uuid, action text not null, target_table text, target_id uuid, before jsonb, after jsonb, ip inet); -- AO
create table prework_rules(state_code char(2), city text, kind text not null, trigger jsonb not null, lead_days int, valid_days int, source_note text not null, verified boolean not null default false);
```
Indexes: `job_days(day, crew_id)`, `trees(property_id)`, `prework_checks(job_id,status)`, `phc_applications(applied_on)`, `jobs_queue(status,run_after)`.

**RLS** (enable on all tables). Helpers: `app.my_tenants()` returns tenant_ids from memberships for `auth.uid()`; `app.has_role(t uuid, roles text[])`. SELECT: `tenant_id in (select app.my_tenants())`; crew_member and sub also need the row linked to a job_day of their crew. INSERT/UPDATE: per section 8 via `app.has_role`. AO tables: INSERT only, plus the trigger. Crew, customer and viewer pages verify the token hash, then use the service role scoped to that one job_day, estimate or claim.

**Storage buckets** (private, signed URLs for 10 minutes): `photos/{tenant}/{property}/{yyyy}/{photo_id}.jpg`, `signatures/{tenant}/{signature_id}.png`, `docs/{tenant}/{kind}/{id}.pdf`, `packets/{tenant}/{job_id}/{sha256}.pdf`.

## 8. Roles and permissions
| Action | Owner | Office | Sales arb. | Crew leader | Crew member | Sub | Customer | Viewer | Ent. admin |
|---|---|---|---|---|---|---|---|---|---|
| Customers/properties | RW | RW | RW | R (job) | R (job) | R (job) | own | - | R |
| Estimates | RW | RW | RW own branch | R lines | R lines | R lines | approve own | - | R |
| Pre-work checks + override | RW | RW | RW (no override) | R | - | - | - | - | R |
| Schedule/equipment | RW | RW | R | R own | R own | R own | date only | - | R |
| Briefing | R | R | R | W | sign | sign | - | - | R |
| Tree confirm/photos | R | R | R | W | W | W | after photos | R | R |
| Change orders | RW | RW | RW | propose | - | - | sign | - | R |
| Invoices/payments | RW | RW | R | - | - | - | pay own | - | R |
| PHC records | RW | RW | RW | W if licensed | - | - | copy own | - | R |
| Users/SSO/export/audit | RW | - | - | - | - | - | - | - | RW |

## 9. API
All routes are under `/api`, with JSON in and out, inputs validated by zod, and errors returned as `{error:{code,message}}` with codes `unauthorized`, `forbidden`, `not_found`, `conflict`, `validation`, `gated`. Every write accepts the header `Idempotency-Key` (uuid). The server stores the key with the response for 7 days and replays it on repeat.
- `POST /estimates` (sales+) `{propertyId, notes?}` → `{id}`
- `PUT /estimates/:id` `{options:[{id?,name,required,lines:[{id?,treeId?,kind,description,qty,unit,unitPriceCents,estCrewHours?,equipmentType?}]}], depositPct, validUntil}` → `{totalCents}`; `conflict` if not draft
- `POST /trees` `{propertyId,label,speciesCommon?,dbhIn?,lat?,lon?,condition?,nearLines}` → `{id}`
- `POST /photos/upload-url` `{kind,propertyId,sha256}` → `{path,signedUrl}`; `POST /photos` `{path,sha256,treeId?,jobDayId?,kind,takenAt,lat?,lon?,clientId}` → `{id}`; the server re-hashes, `validation` on mismatch
- `POST /photo-markups` `{photoId,treeId,shape,color,number}` → `{id}`
- `POST /estimates/:id/send` → `{publicUrl}` (creates token, queues SMS)
- `GET /e/:token` (public) → estimate view; `POST /e/:token/approve` `{selectedOptionIds, signerName, signaturePng, clientId}` → `{jobId, depositUrl?}`
- `POST /deposits/:id/checkout` → `{stripeUrl}`; `POST /webhooks/stripe` (signature verified, idempotent on event id)
- `POST /jobs/:id/prework` `{kind,status,refNo?,validFrom?,validUntil?,filePath?}`; `POST /prework/:id/override` (owner/office) `{reason}` (min 10 chars)
- `POST /job-days` `{jobId,crewId,day,startTime,estHours,equipmentIds[]}` → `{id}`; `gated` if open checks lack an override; `conflict` with `{equipmentId,clash}` on overlap
- `POST /job-days/:id/link` → `{url}` (token 32 bytes, expires end of day + 2 days)
- Crew (token auth): `GET /c/:token` → job bundle (trees, lines, pins, photos, hazards, weather, hospital); `POST /c/:token/sync` `{ops:[{clientId,type,payload}]}` → `{applied:[clientId],dupes:[clientId],rejected:[{clientId,code}]}` with types `briefing`, `signoff`, `work_log`, `tree_confirm`, `photo`, `change_order_propose`, `disposal`
- `POST /change-orders/:id/send`; `POST /co/:token/sign` `{signerName,signaturePng,clientId}`
- `POST /jobs/:id/close` → `{invoiceId, flags}`; `POST /invoices/:id/send`; `POST /invoices/:id/pay-link`
- `POST /jobs/:id/proof-packet` → `{path, sha256}`; `GET /v/:token` viewer
- `POST /phc/applications` `{...phc_applications fields, clientId}` → `{id}`; `POST /phc/applications/:id/send-copy`
- `POST /storm/:eventId/intake`; `GET /storm/:eventId/queue` → ordered list
- `POST /messages/inbound` (Twilio webhook: STOP/HELP/START)
- `GET /export/:table.csv` (owner, enterprise_admin); `GET /audit` (enterprise_admin)
- `POST /auth/sso/start` `{domain}` (enterprise)

## 10. Background jobs
Vercel Cron runs a `jobs_queue` worker every minute. Jobs, with triggers: weather.refresh (05:00 local per branch, 5 retries with backoff; on failure use last snapshot marked "stale"); weather.flag (after refresh); prework.expiry (daily 06:00, emails owner); sms.send (on queue, 4 retries, then status failed); phc.copy_due (daily, flags day 25 with no copy); estimate.expire, links.revoke, certs.expiry (daily or hourly); packet.build (on request, retry button). Others retry 3 times. Dead jobs go to `status='dead'` and show in Settings > System.

## 11. Engines (`packages/core`, pure, no I/O)
- **priceEstimate(options, settings)** → `{optionTotals, totalCents, depositCents}`. Line = round(qty × unit_price). Required options are always included. The minimum job charge comes from settings. Deposit = round(total × pct / 100).
- **estimateVsActual(lines, workLog, equipmentHours)** → `{estHours, actualHours, variancePct, byEquipment}`.
- **equipmentConflict(bookings, newBooking)** → clashes where the same equipment's ranges overlap (half-open intervals). The DB exclusion constraint is the backstop.
- **weatherFlags(hourly, thresholds, jobKind)** → flags `wind_gust`, `thunder`, `precip`, `heat`. Default thresholds are tenant-editable and **not regulatory**: gust ≥ 25 mph for crane/bucket, thunder probability ≥ 30%, precip ≥ 0.25 in/3h, apparent temp ≥ 95°F [J; confirm with customers].
- **preworkGate(job, checks, rules)** → `{ok, blocking:[check]}`. 811 is required if any line kind is `stump_grind` or `clearing`. A permit is needed if a rule matches city + DBH. A utility_line check is needed if any tree's near_lines ≠ none. A check counts as cleared if `status in (cleared, not_required)`, or `overridden` with a reason.
- **electricalGate(job, crewWorkers)** → ok if max(level) ≥ required. A tree with near_lines=gt_35kv and level 3 needs `abatement_plan_path`.
- **invoiceFromJob(estimate, selectedOptions, changeOrders, deposits)** → lines from selected options plus **only `signed`** change orders, minus paid deposits.
- **billingFlags(invoice, confirmations, workLog)** → `tree_not_confirmed`, `skipped_tree_billed`, `hours_over_150pct`, `no_after_photo`, `unsigned_co_excluded`.
- **proofManifest(job)** → canonical JSON (keys sorted, UTC ISO times, photos sorted by takenAt then id) → `sha256`. The same input gives the same hash.
- **phcRecord(application, product, stateCode)** → record object plus `missingFields` per state profile. The federal profile covers 7 CFR 110.3 fields. The OH profile adds concentration and total volume and requires the record on the application date.\[48\] Other states are `[T]`.
- **stormTriage(intakes)** → sort by injury, lines_involved, on_structure, blocking_access, then created_at.
- **paymentFee(amount, plan)** → section 5.

## 12. Screens (phone = P, desk = D)
1. **Estimate builder (P/D, sales arborist, on site).** The property map comes first, then trees as numbered pins. Actions: add tree (tap map), take photo, draw circle/arrow on photo with a number, set species/DBH/near lines, add lines, options, deposit %, send. Offline: everything saves to IndexedDB, and the sync badge shows a pending count. AC: 1) works in airplane mode end to end until send; 2) each pin number matches the photo markup number; 3) a lost connection never loses a draft; 4) send is blocked if a "remove" line has no tree or photo.
2. **Customer approval (P).** Shows trees with numbered photos first, then options with checkboxes, total, deposit, signature pad, approve. AC: no account needed; signature saved with hash; ES shown if locale es; approval creates the job and deposit link.
3. **Schedule board (D).** Rows are crews and equipment; columns are days; drag a job to a cell. Weather icons per day. AC: an overlap shows a red clash and blocks save; a job with open checks shows a lock and asks for an override reason; weather holds move with one click and queue a reschedule text.
4. **Crew link (P, offline).** Shows today's job, address and navigate button, then the briefing button, trees list, notes. Big buttons (min 56px), high contrast, EN/ES toggle. AC: opens from SMS with no login; works offline after first load; the outbox shows unsent count; re-sync never duplicates.
5. **Briefing (P).** Hazards checklist (drop zone, lines, traffic, weather, rescue plan), electrical level check, nearest hospital, each worker taps sign. AC: tree work buttons are disabled until complete; the electrical gate blocks if the level is short.
6. **Per-tree confirm (P).** Tree card with the sales photo and markup, before photo, done/partial/skip, after photo. AC: "done" requires an after photo; skip requires a reason.
7. **Change order (P/D).** AC: unsigned change orders never appear on an invoice.
8. **Close and bill (D).** AC: flags must be acknowledged before sending.
9. **Proof packet (D).** AC: rebuilding unchanged data gives the same hash.
10. **Storm intake (P/D).** AC: intake in under 60 s; queue order follows the engine.
11. **PHC visit (P).** EPA number auto-filled from product. AC: cannot save with missing state fields; the customer copy is queued.
12. **Settings (D).** Branches, crews, workers, equipment, thresholds, prework rules, templates, SSO.
13. **Onboarding (D).** Company → branch → crew → equipment → customer CSV → Stripe (skippable). AC: a test user finishes in 15 minutes or less.
14. **Marketing + free tool.** Home, pricing, and a printable Tree Job Briefing form (EN/ES PDF), no signup.
Empty states show one sentence and one button. Errors show plain text plus a retry.

## 13. Customer messages (sent only if consent = opted_in; quiet hours 8am to 9pm local)
- Estimate sent. EN: "{Company}: your tree estimate is ready. View and approve: {link}. Reply STOP to opt out." ES: "{Company}: su presupuesto de árboles está listo. Véalo y apruébelo: {link}. Responda STOP para no recibir mensajes."
- Scheduled. EN: "{Company}: your tree work is set for {date}. Reply STOP to opt out." ES: "{Company}: su trabajo de árboles está programado para el {date}. Responda STOP para no recibir mensajes."
- Weather reschedule. EN: "{Company}: weather moved your job to {date}. Questions? Call {phone}." ES: "{Company}: por el clima su trabajo pasó al {date}. ¿Preguntas? Llame al {phone}."
- Invoice. EN: "{Company}: your invoice for ${total} is ready: {link}" ES: "{Company}: su factura de ${total} está lista: {link}"
Consent is captured on the approval page checkbox or by verbal consent logged by office, with a source. TCPA and 10DLC specifics: [T].

## 14. Integrations (all behind interfaces with deterministic mocks)
- **Weather:** NWS `GET https://api.weather.gov/points/{lat},{lon}` → `forecastGridData` → `GET /gridpoints/{wfo}/{x},{y}`. Layers include `windGust`, `probabilityOfThunder`, `potentialOf20mphWindGusts` to `60`, values as ISO 8601 intervals (NWS gridpoint FAQ). [V]\[59\]\[60\]\[61\] Heat index layer name, rate limits, User-Agent rule and public-domain terms: [T]. Cache points for 24 h and grids for 30 min [J].\[61\]
- **Stripe Connect** (Express accounts, application_fee_amount = paymentFee) [T terms].
- **Twilio** SMS [T]. **Maps:** MapLibre with a provider-supplied style; imagery source and terms [T]. **Parcels:** Regrid self-serve API includes 2,000 parcel records and 200,000 tiles/month; trial tokens are limited to 7 counties (Regrid support; pricing per third-party) [V].\[62\]\[63\]\[64\] Later (L2). **Geocoder, QuickBooks Online, calendar, PDF (react-pdf), SSO via Supabase SAML:** [T].
- **Hospital lookup:** source not found this session. Interim: the crew leader picks from the branch's saved hospitals [J].
- **Species list:** source not found; seed with 60 common species typed by the team, as a tenant-editable table [J].

## 15. Security and compliance [J]
- Tenant isolation: RLS on every table, plus a dedicated Supabase project for enterprise on request. Audit log on every write via trigger, exportable.
- Retention defaults: PHC records 3 years (OH employer rule; federal private 2 years);\[47\]\[49\] briefings and photos 5 years; payments 7 years. Tenants may extend but not shorten below the state minimum. [V for PHC, J for others]
- Backups: Supabase daily backups plus a weekly export to tenant-owned storage for enterprise [T plan tier].
- Questionnaire answers: SSO SAML yes; MFA for desk users; encryption at rest and in transit [T]; US region; subprocessors Supabase, Vercel, Stripe, Twilio; incident notice 72 h; pen test before enterprise GA.

## 16. Testing
- Unit: every engine in section 11, with fixtures.
- RLS (pgTAP): tenant A can never read tenant B in any table; crew_member sees only their job_days; AO tables reject UPDATE/DELETE.
- Integration: offline crew flow (queue 20 ops, sync twice, assert 20 rows); equipment double-book returns `conflict` and the DB constraint holds; an unsigned change order never reaches the invoice; a job with an open pre-work check returns `gated` unless overridden, and the override writes audit_log; the proof packet hash is stable across two builds; a Stripe webhook replay creates one payment.
- E2E (Playwright, mock mode): estimate → approve → schedule → link → briefing → confirm → close → pay.
Mapping: M1–M16 each list their test IDs in `tests/README.md`.

## 17. Seed data (labeled "DEMO, fictional")
Tenant "Maple Ridge Tree Co. (DEMO)", OH. Branches Kent and Akron. 3 crews, 9 workers (levels 1 to 3, 2 Spanish), 8 equipment (crane, 2 bucket, 2 chipper, grinder, mini loader, chip truck). 20 customers, 25 properties, 60 trees. Estimates in every status. 10 jobs, one with an open 811 check, one with a crane booking clash, one storm event with 8 intakes, 6 PHC applications with 3 products (made-up names and EPA numbers formatted "DEMO-####").

## 18. Build order
1. **Davey demo slice:** estimate builder with pins and photos, customer approval, crew link offline with per-tree confirm, proof packet, all in mock mode with seed data. Done = the demo runs on a phone in airplane mode.
2. Schedule board, equipment conflict, pre-work gating, briefing. Done = all section 16 integration tests pass.
3. Billing, deposits, Stripe, change orders.
4. PHC and SMS with consent.
5. Storm, onboarding, marketing, free tool.
6. Enterprise: SSO, dedicated project, export, audit UI, questionnaire.

## 19. Decisions
| ID | Decision | Reason | Rejected |
|---|---|---|---|
| D-1 | Separate repo/DB/deploy | Protect Flake; Davey isolation | Shared packages; one platform |
| D-2 | Re-decide extraction after pilot | Avoid early abstraction | Extract now |
| D-3 | Web crew link | Crews won't install | Native apps |
| D-4 | Z133-2026 electrical levels | Current standard | 2017 three-tier |
| D-5 | Tenant weather thresholds | No regulatory values | Hard-coded |
| D-6 | Pro $99 month to month | Undercut, no contract | $149 annual |
| D-7 | Enterprise per crew | How Davey sizes work | Per seat |
| D-8 | Parcels later | Regrid paid beyond trial\[62\] | Parcels now |
| D-9 | Unsigned CO blocked in DB and engine | P1/P3 | Office judgment |

## 20. Open questions for Davey
- **Systems:** What do R/C crews and ASRs use today, and which ERP is being implemented? Blocks integrations.
- **Security:** Is SAML IdP Okta or Azure AD? Is a dedicated database required? Blocks milestone 6.
- **Pilot:** Which district, how many crews, and what success metric? Blocks milestone 1 scope.
- **Safety:** Must briefings match Davey's own form, or link to Close Call Communicator? Blocks screen 5.
- **PHC:** Which states are in the pilot? Blocks state profiles.
- **Data:** Do TreeKeeper inventories need import? Blocks L-items.

## Sources

1. [Unfortunate Arborvitae Accident](https://arboristsite.com/threads/unfortunate-arborvitae-accident.374475/)
2. [Worst mistake you've made?](https://www.arboristsite.com/threads/worst-mistake-youve-made.299971/)
3. [ArboStar - Ratings & Reviews - App Store](https://apps.apple.com/us/app/arbostar/id1494526916?see-all=reviews&platform=iphone)
4. [ArboStar - App Store - Apple](https://apps.apple.com/us/app/arbostar/id1494526916)
5. [Arborgold Crew - Apps on Google Play](https://play.google.com/store/apps/details?id=com.arborgold.crew)
6. [SingleOps - App Store - Apple](https://apps.apple.com/us/app/singleops/id1483784211)
7. [What do you guys pay for crane rental?](https://arboristsite.com/threads/what-do-you-guys-pay-for-crane-rental.176423/)
8. [How to bid?](https://www.treebuzz.com/forum/threads/how-to-bid.29167/)
9. [Code of Federal Regulations Title 29. Labor 29 CFR § 1910.269](https://codes.findlaw.com/cfr/title-29-labor/cfr-sect-29-1910-269/)
10. [Title 29 —Labor Subtitle B —Regulations Relating to Labor](https://americancraneschool.com/wp-content/uploads/2025/03/29-CFR-1910.269-up-to-date-as-of-3-03-2025.pdf)
11. [Ohio 811: Call Before You Dig](https://www.ohioconcrete.com/ohio-811)
12. [Do I Need A Permit To Clear Land In Ohio?](https://fortresslevelconstruction.com/do-i-need-permit-to-clear-land-ohio/)
13. [How to Save a Tree](https://www.treesatlanta.org/resources/how-to-save-a-tree/)
14. [www.law.cornell.edu](https://www.law.cornell.edu/cfr/text/7/110.3)
15. [DAVEY TREE EXPERT CO | 10-K | 10-K | Period: 2025-12-31 | Filed: 2026-03-09](https://www.sec.gov/Archives/edgar/data/277638/000162828026015920/davey-20251231.htm)
16. [Sales Arborist Job Details](https://jobs.davey.com/job/Sales-Arborist/214850-en_US/)
17. [Arborist Sales Representative Job Details](https://jobs.davey.com/job/Arborist-Sales-Representative/217285-en_US)
18. [Hourly rates](https://www.treebuzz.com/forum/threads/hourly-rates.23903/)
19. [eCFR :: 29 CFR Part 1926 Subpart CC -- Cranes and Derricks in Construction](https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1926/subpart-CC)
20. [Crane Operator Regulation Exclusions](https://americancraneschool.com/resources/crane-laws/crane-operator-regulation-exclusions/)
21. [Davey Tree Expert 10K 2025 Annual report](https://capedge.com/filing/277638/0001628280-26-015920/10-K/file/1)
22. [Davey Tree Expert Company](https://en.wikipedia.org/wiki/Davey_Tree_Expert_Company)
23. [UNITED STATES SECURITIES AND EXCHANGE COMMISSION Washington, D.C. 20549](https://www.davey.com/media/fahm40ep/2024-december-31-with-exhibits.pdf)
24. [DaveyConnect App - App Store](https://apps.apple.com/us/app/daveyconnect/id1506093017)
25. [DaveyConnect on the App Store](https://apps.apple.com/in/app/daveyconnect/id1506093017)
26. [DAVEY - Overview, News & Similar companies](https://www.zoominfo.com/c/the-davey-tree-expert-co/51432151)
27. [Tree Service Management Software for Arborists](https://arbostar.com/arborist-software/arborist-task-management)
28. [All Arborist Software Features in One Platform](https://arbostar.com/arborist-software)
29. [ArboStar Plus - App Store - Apple](https://apps.apple.com/us/app/arbostar-plus/id6447995102)
30. [\# ArboStar Software Pricing, Alternatives & More 2026 | Capterra](https://www.capterra.com/p/198069/ArboStar)
31. [Arborgold Review 2026: Pricing, Limits and Alternatives](https://fervorstudio.ca/news/arborgold-review-pricing-alternatives/)
32. [Arborgold Review: Tree, Lawn, and Landscape Software](https://www.contractorsoftwarehub.com/arborgold-review/)
33. [Jobber vs Arborgold (2026): Which Software Wins for Lawn and Tree Crews? — Lawn Care Ledger](https://www.lawncareledger.com/articles/jobber-vs-arborgold-2026)
34. [Arborgold Software Pricing, Alternatives & More 2026](https://www.capterra.com/p/12741/Arborgold/)
35. [SingleOps Review: Tree Care Pricing, Tiers, and Fit](https://www.contractorsoftwarehub.com/singleops-review/)
36. [Top 8 Best Software For Tree Services](https://myquoteiq.com/top-8-softwares-for-tree-services-in-2026/)
37. [SingleOps by Granum Review 2026: Pricing, Pros and Cons](https://fervorstudio.ca/news/singleops-review-pricing-alternatives/)
38. [Jobber: Field Service Software - Apps on Google Play](https://play.google.com/store/apps/details?id=com.getjobber.jobber&hl=en)
39. [1910.269 - Electric power generation, transmission, and distribution.](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.269_2)
40. [eTool : Electric Power Generation, Transmission, and Distribution - Overhead Line Work - Line-Clearance Tree Trimming Operations](https://www.osha.gov/etools/electric-power/overhead-line-work/line-clearance-tree-trimming-operations)
41. [Z133-2026 Safety and Health Requirements standard is now available](https://www.isa-arbor.com/Newsroom/z133-2026-safety-and-health-requirements-standard-is-now-available)
42. [ANSI Z133-2026: The Progression of Electrical Qualifications](https://tcimag.tcia.org/training/ansi-z133-2026-the-progression-of-electrical-qualifications/)
43. [Ohio Utilities Protection Service](https://www.greenecountyohio.gov/1045/Ohio-Utilities-Protection-Service)
44. [Before You Dig - OUPS and OGPUPS](https://www.gmenergy.com/you-dig-oups-and-ogpups)
45. [Atlanta Tree Ordinance 2025: \$140 per Inch, Stormwater Rules](https://www.vanplex.ca/atlanta-multiplex/tree-ordinance-and-stormwater/)
46. [Atlanta Tree Removal Permits in 2026: What Sellers Need to Know](https://theagency-atlanta.com/blog/removing-a-tree-before-you-list-or-renovate-an-atlanta-home-in-2026)
47. [Understanding Federal Pesticide Recordkeeping](https://www.ams.usda.gov/rules-regulations/pesticide-records/understanding)
48. [Rule 901:5-11-10 - Ohio Administrative Code](https://codes.ohio.gov/ohio-administrative-code/rule-901:5-11-10)
49. [Chapter 901:5-11 - Ohio Administrative Code](https://codes.ohio.gov/ohio-administrative-code/chapter-901:5-11)
50. [901:5-11-01 Definitions. As used in this chapter of the Administrative Code:](https://agri.ohio.gov/wps/wcm/connect/gov/6d0b0ba2-9bab-493c-b303-9b9e5cb3a1df/901$5-11+Combined+Final.pdf?CACHEID=ROOTWORKSPACE.Z18_K9I401S01H7F40QBNJU3SO1F56-6d0b0ba2-9bab-493c-b303-9b9e5cb3a1df-pdArqhn&CONVERT_TO=url&MOD=AJPERES)
51. [Ohio Administrative Code](https://regulations.justia.com/states/ohio/title-901-5/chapter-901-5-11/section-901-5-11-09/)
52. [(A) No commercial applicator or trained serviceperson working under the direct](https://codes.ohio.gov/assets/laws/administrative-code/authenticated/901/5/11/901$5-11-09_20171020.pdf)
53. [PI-20/PI012: Pesticide Recordkeeping - Ask IFAS](https://edis.ifas.ufl.edu/publication/PI012)
54. [commercial app use records](https://oisc.purdue.edu/pesticide/commercial_app_use_records.html)
55. [Work Comp Class Code 0106](https://www.workcompassociates.com/class-codes/0106)
56. [Workers’ Compensation for Tree Service Contractors (Class Code 0106)](https://treeguardinsurance.com/coverage/workers-comp/)
57. [Workers Compensation Class Code 0106 - Tree Pruning, Spraying, Repairing - All Operations & Drivers](https://generalliabilityinsure.com/workers-comp-class-codes/0106-tree-pruning-spraying-repairing-all-operations-drivers.html)
58. [Workers' Comp for Tree Service: Costs, Codes & Requirements](https://www.1800insurance.com/guides/workers-comp-for-tree-service)
59. [api.weather.gov: Gridpoint Frequently Asked Questions](https://weather-gov.github.io/api/gridpoints)
60. [Documentation](https://forecast-v3.weather.gov/documentation)
61. [Reading the National Weather Service gridpoint forecast for a school morning - DEV Community](https://dev.to/simplemorse/reading-the-national-weather-service-gridpoint-forecast-for-a-school-morning-26if)
62. [MCP Server - Getting Started with Regrid Support](https://support.regrid.com/docs/mcp-server)
63. [Regrid Pricing 2026: Pro App \$10/Mo, API \$25k/Yr](https://scoutdata.com/guides/regrid-pricing)
64. [Regrid Pricing and API Cost with Pro at \$10 a Month](https://landpricer.com/blog/regrid-pricing)
