-- Tree Ops schema (docs/SPEC.md section 7, with the changes listed in docs/DECISIONS.md).
-- Conventions: uuid ids, tenant_id on every tenant table, created_at, money in integer cents.
-- Append-only tables (AO) carry the forbid_update_delete trigger: corrections are new rows.

create extension if not exists btree_gist with schema extensions;
create schema if not exists app;

create or replace function app.forbid_update_delete() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only: add a correction instead', tg_table_name using errcode = '42501';
end $$;

-- Tenants and people -------------------------------------------------------------------------------------------------

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  plan text not null default 'free' check (plan in ('free','pro','enterprise')),
  state_code char(2) not null default 'OH',
  timezone text not null default 'America/New_York',
  default_locale text not null default 'en' check (default_locale in ('en','es')),
  phone text,
  stripe_account_id text,
  stripe_charges_enabled boolean not null default false,
  sms_sender text,
  -- Weather thresholds, minimum job charge, default deposit. Shapes in packages/core/src/settings.ts.
  settings jsonb not null default '{}'::jsonb,
  sso_domain text unique,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  parent_id uuid references branches(id),
  name text not null check (char_length(name) between 1 and 120),
  timezone text not null default 'America/New_York',
  address text,
  lat numeric(9,6),
  lon numeric(9,6),
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid references branches(id),
  role text not null check (role in ('owner','office','sales_arborist','crew_leader','crew_member','sub','enterprise_admin')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table workers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid references branches(id),
  user_id uuid references auth.users(id),
  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text,
  locale text not null default 'en' check (locale in ('en','es')),
  kind text not null default 'employee' check (kind in ('employee','sub')),
  electrical_level smallint not null default 1 check (electrical_level between 1 and 4),
  isa_cert_no text,
  applicator_license_no text,
  applicator_license_state char(2),
  hourly_cost_cents int check (hourly_cost_cents is null or hourly_cost_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table crews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid references branches(id),
  name text not null check (char_length(name) between 1 and 80),
  leader_worker_id uuid references workers(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table crew_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  crew_id uuid not null references crews(id) on delete cascade,
  worker_id uuid not null references workers(id),
  created_at timestamptz not null default now(),
  unique (crew_id, worker_id)
);

create table equipment (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid references branches(id),
  name text not null check (char_length(name) between 1 and 80),
  type text not null check (type in ('chipper','grinder','bucket','crane','mini_loader','log_truck','mats','chip_truck','spray_rig','other')),
  hour_meter numeric(8,1),
  service_every_hours numeric(8,1),
  last_service_hours numeric(8,1),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table hospitals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid references branches(id),
  name text not null,
  address text not null,
  phone text,
  created_at timestamptz not null default now()
);

-- Customers, properties, trees -------------------------------------------------------------------------------------

create table customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid references branches(id),
  kind text not null default 'residential' check (kind in ('residential','commercial','hoa','property_mgr','municipal')),
  name text not null check (char_length(name) between 1 and 200),
  phone text,
  email text,
  locale text not null default 'en' check (locale in ('en','es')),
  billing_terms_days int not null default 0 check (billing_terms_days between 0 and 120),
  notes text,
  created_at timestamptz not null default now()
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id),
  address text not null check (char_length(address) between 3 and 300),
  city text,
  state_code char(2) not null,
  lat numeric(9,6),
  lon numeric(9,6),
  hoa_name text,
  access_notes text,
  gate_code text,
  hazards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table species (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade, -- null: shared starter list
  common_name text not null,
  latin_name text,
  is_pine boolean not null default false,
  created_at timestamptz not null default now()
);

create table trees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id),
  number smallint not null check (number between 1 and 999),
  label text not null,
  species_common text,
  species_latin text,
  dbh_in numeric(5,1) check (dbh_in is null or dbh_in > 0),
  height_ft int check (height_ft is null or height_ft between 1 and 400),
  lat numeric(9,6),
  lon numeric(9,6),
  condition text check (condition in ('good','fair','poor','dead','hazard')),
  protected_flag boolean not null default false,
  near_lines text not null default 'none' check (near_lines in ('none','service_le_750v','dist_le_35kv','gt_35kv')),
  notes text,
  created_at timestamptz not null default now(),
  unique (property_id, number)
);

-- Estimates --------------------------------------------------------------------------------------------------------

create table estimates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id),
  sales_user_id uuid not null references auth.users(id),
  number int not null,
  status text not null default 'draft' check (status in ('draft','sent','approved','declined','expired')),
  version int not null default 1,
  valid_until date,
  notes text,
  total_cents int not null default 0 check (total_cents >= 0),
  deposit_pct smallint not null default 0 check (deposit_pct between 0 and 100),
  public_token_hash char(64) unique,
  sent_at timestamptz,
  approved_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, number)
);

create table estimate_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  estimate_id uuid not null references estimates(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  required boolean not null default false,
  selected boolean not null default false,
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);

create table estimate_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  option_id uuid not null references estimate_options(id) on delete cascade,
  tree_id uuid references trees(id),
  kind text not null check (kind in ('remove','prune','stump_grind','cable_brace','phc','clearing','crane','equipment','disposal','permit_fee','other')),
  description text not null check (char_length(description) between 1 and 500),
  qty numeric(8,2) not null check (qty > 0),
  unit text not null check (unit in ('each','hour','day','inch_dbh','load','lump')),
  unit_price_cents int not null check (unit_price_cents >= 0),
  est_crew_hours numeric(6,2) check (est_crew_hours is null or est_crew_hours >= 0),
  equipment_type text,
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Photos from the estimate and the job. AO: a photo is evidence and is never changed.
create table photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid references properties(id),
  estimate_id uuid references estimates(id),
  job_day_id uuid,
  tree_id uuid references trees(id),
  kind text not null check (kind in ('estimate','before','after','damage_pre','damage_post','disposal','claim','other')),
  storage_path text not null,
  sha256 char(64) not null,
  width int,
  height int,
  taken_at timestamptz not null,
  lat numeric(9,6),
  lon numeric(9,6),
  exif jsonb,
  client_id uuid not null unique,
  created_at timestamptz not null default now()
);

-- Circles, arrows and the tree number drawn on a photo. AO: a new row per edit; the newest per (photo, tree) wins.
create table photo_markups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  photo_id uuid not null references photos(id),
  tree_id uuid not null references trees(id),
  shape jsonb not null,
  color text not null default '#f97316',
  number smallint not null,
  created_at timestamptz not null default now()
);

create table signatures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subject_type text not null check (subject_type in ('estimate','change_order','briefing','phc_notice')),
  subject_id uuid not null,
  signer_name text not null check (char_length(signer_name) between 1 and 120),
  signer_role text,
  image_path text not null,
  sha256 char(64) not null,
  signed_at timestamptz not null,
  ip inet,
  user_agent text,
  client_id uuid not null unique,
  created_at timestamptz not null default now()
);

create table deposits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  estimate_id uuid not null unique references estimates(id),
  amount_cents int not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending','paid','refunded','failed')),
  checkout_id text unique,
  created_at timestamptz not null default now()
);

-- Jobs and scheduling ----------------------------------------------------------------------------------------------

create table jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  estimate_id uuid not null unique references estimates(id),
  property_id uuid not null references properties(id),
  branch_id uuid references branches(id),
  number int not null,
  status text not null default 'unscheduled' check (status in ('unscheduled','scheduled','in_progress','done','billed','cancelled')),
  required_electrical_level smallint not null default 1 check (required_electrical_level between 1 and 4),
  needs_crane boolean not null default false,
  storm_intake_id uuid,
  notes text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);

create table prework_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  kind text not null check (kind in ('811','permit','hoa','utility_line','neighbor','other')),
  status text not null default 'needed' check (status in ('needed','requested','cleared','not_required','overridden')),
  reason text,
  ref_no text,
  requested_at timestamptz,
  valid_from timestamptz,
  valid_until timestamptz,
  file_path text,
  override_reason text,
  override_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, kind),
  check (status <> 'overridden' or (override_reason is not null and char_length(override_reason) >= 10))
);

create table job_days (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  crew_id uuid references crews(id),
  day date not null,
  start_time time not null default '07:30',
  est_hours numeric(5,2) not null default 8 check (est_hours > 0 and est_hours <= 24),
  status text not null default 'planned' check (status in ('planned','briefed','working','closed','weather_hold')),
  weather_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (job_id, day, crew_id)
);
alter table photos add constraint photos_job_day_fk foreign key (job_day_id) references job_days(id);

create table equipment_bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  equipment_id uuid not null references equipment(id),
  job_day_id uuid not null references job_days(id) on delete cascade,
  during tstzrange not null,
  created_at timestamptz not null default now(),
  exclude using gist (equipment_id with =, during with &&)
);

create table crew_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_day_id uuid not null references job_days(id) on delete cascade,
  token_hash char(64) not null unique,
  token_enc text,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);

-- Field records (AO) -----------------------------------------------------------------------------------------------

create table briefings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_day_id uuid not null references job_days(id),
  leader_worker_id uuid not null references workers(id),
  hazards jsonb not null,
  line_proximity text not null check (line_proximity in ('none','service_le_750v','dist_le_35kv','gt_35kv')),
  abatement_plan_path text,
  hospital_name text,
  hospital_address text,
  emergency_address text,
  rescue_plan text,
  weather_snapshot_id uuid,
  is_rebrief boolean not null default false,
  completed_at timestamptz not null,
  received_at timestamptz not null default now(),
  client_id uuid not null unique,
  created_at timestamptz not null default now()
);

create table briefing_signoffs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  briefing_id uuid not null references briefings(id),
  worker_id uuid not null references workers(id),
  late_arrival boolean not null default false,
  signed_at timestamptz not null,
  received_at timestamptz not null default now(),
  client_id uuid not null unique,
  created_at timestamptz not null default now(),
  unique (briefing_id, worker_id)
);

create table work_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_day_id uuid not null references job_days(id),
  worker_id uuid references workers(id),
  equipment_id uuid references equipment(id),
  kind text not null check (kind in ('arrive','start','pause','resume','leave','note','equipment_hours')),
  at timestamptz not null,
  value numeric,
  note text,
  received_at timestamptz not null default now(),
  client_id uuid not null unique,
  created_at timestamptz not null default now()
);

create table tree_confirmations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_day_id uuid not null references job_days(id),
  tree_id uuid references trees(id),
  line_id uuid not null references estimate_lines(id),
  result text not null check (result in ('done','partial','skipped')),
  reason text,
  before_photo_id uuid references photos(id),
  after_photo_id uuid references photos(id),
  confirmed_by uuid references workers(id),
  lat numeric(9,6),
  lon numeric(9,6),
  at timestamptz not null,
  received_at timestamptz not null default now(),
  client_id uuid not null unique,
  created_at timestamptz not null default now(),
  check (result <> 'done' or after_photo_id is not null),
  check (result <> 'skipped' or (reason is not null and char_length(reason) >= 3))
);

create table change_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references jobs(id),
  description text not null check (char_length(description) between 1 and 500),
  amount_cents int not null check (amount_cents >= 0),
  status text not null default 'proposed' check (status in ('proposed','signed','declined')),
  signature_id uuid references signatures(id),
  public_token_hash char(64) unique,
  proposed_by_worker uuid references workers(id),
  client_id uuid not null unique,
  created_at timestamptz not null default now(),
  check (status <> 'signed' or signature_id is not null)
);

create table corrections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  target_table text not null,
  target_id uuid not null,
  field text not null,
  new_value jsonb not null,
  reason text not null check (char_length(reason) >= 3),
  by_user uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table disposal_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_day_id uuid not null references job_days(id),
  kind text not null check (kind in ('chips','logs','brush','stumps')),
  site text,
  loads numeric(5,1) check (loads is null or loads >= 0),
  cost_cents int check (cost_cents is null or cost_cents >= 0),
  client_id uuid not null unique,
  created_at timestamptz not null default now()
);

-- Money ------------------------------------------------------------------------------------------------------------

create table invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null unique references jobs(id),
  number text not null,
  status text not null default 'draft' check (status in ('draft','sent','paid','void')),
  subtotal_cents int not null check (subtotal_cents >= 0),
  deposit_applied_cents int not null default 0 check (deposit_applied_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  flags jsonb not null default '[]'::jsonb,
  flags_ack_at timestamptz,
  flags_ack_by uuid references auth.users(id),
  due_date date,
  public_token_hash char(64) unique,
  checkout_id text unique,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);

create table invoice_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  source text not null check (source in ('estimate_line','change_order','adjustment')),
  source_id uuid,
  description text not null,
  amount_cents int not null,
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  invoice_id uuid references invoices(id),
  deposit_id uuid references deposits(id),
  amount_cents int not null check (amount_cents > 0),
  fee_cents int not null default 0 check (fee_cents >= 0),
  method text not null check (method in ('card','ach','check','cash','insurer')),
  stripe_ref text unique,
  received_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (invoice_id is not null or deposit_id is not null)
);

create table stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- Plant health care ------------------------------------------------------------------------------------------------

create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  epa_reg_no text not null,
  is_rup boolean not null default false,
  signal_word text check (signal_word is null or signal_word in ('caution','warning','danger')),
  rei_hours int,
  default_unit text not null default 'fl_oz',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, epa_reg_no)
);

create table phc_programs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id),
  year int not null check (year between 2000 and 2100),
  status text not null default 'proposed' check (status in ('proposed','active','done')),
  estimate_id uuid references estimates(id),
  notes text,
  created_at timestamptz not null default now()
);

create table phc_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  program_id uuid references phc_programs(id),
  property_id uuid not null references properties(id),
  applicator_worker_id uuid not null references workers(id),
  applicator_license_no text not null,
  product_id uuid not null references products(id),
  product_name text not null,
  epa_reg_no text not null,
  is_rup boolean not null default false,
  target_pest text,
  site_desc text not null,
  method text,
  concentration text,
  total_amount numeric(10,3) not null check (total_amount > 0),
  amount_unit text not null,
  area_treated text,
  applied_on date not null,
  start_time time,
  end_time time,
  wind_mph numeric(4,1),
  temp_f numeric(4,1),
  state_code char(2) not null,
  recorded_at timestamptz not null default now(),
  copy_token_hash char(64) unique,
  client_id uuid not null unique,
  created_at timestamptz not null default now()
);

-- Storms, claims, compliance ---------------------------------------------------------------------------------------

create table storm_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  branch_id uuid references branches(id),
  name text not null check (char_length(name) between 1 and 120),
  started_on date not null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table storm_intake (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  storm_event_id uuid not null references storm_events(id),
  caller_name text,
  phone text,
  address text not null,
  lat numeric(9,6),
  lon numeric(9,6),
  on_structure boolean not null default false,
  blocking_access boolean not null default false,
  lines_involved boolean not null default false,
  injury boolean not null default false,
  insurer text,
  notes text,
  status text not null default 'new' check (status in ('new','assessed','estimated','scheduled','done','declined','utility')),
  property_id uuid references properties(id),
  created_at timestamptz not null default now()
);
alter table jobs add constraint jobs_storm_intake_fk foreign key (storm_intake_id) references storm_intake(id);

create table claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid references jobs(id),
  opened_on date not null,
  kind text not null check (kind in ('property_damage','injury','vehicle','other')),
  description text not null,
  status text not null default 'open' check (status in ('open','closed')),
  viewer_token_hash char(64) unique,
  created_at timestamptz not null default now()
);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  holder text not null,
  kind text not null check (kind in ('gl','wc','auto','umbrella')),
  insurer text,
  policy_no text,
  expires_on date not null,
  file_path text,
  created_at timestamptz not null default now()
);

create table proof_packets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references jobs(id),
  sha256 char(64) not null,
  pdf_path text not null,
  manifest jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table prework_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade, -- null: shared rule
  state_code char(2),
  city text,
  kind text not null check (kind in ('811','permit','hoa','utility_line','neighbor','other')),
  trigger jsonb not null,
  lead_days int,
  valid_days int,
  source_note text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- Messages, weather, system ----------------------------------------------------------------------------------------

create table consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  phone text not null,
  channel text not null default 'sms',
  status text not null check (status in ('opted_in','opted_out')),
  source text not null,
  at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid references customers(id),
  worker_id uuid references workers(id),
  to_phone text not null,
  template text not null,
  locale text not null default 'en',
  body text not null,
  related_type text,
  related_id uuid,
  status text not null default 'queued' check (status in ('queued','sent','mock_sent','failed','blocked_no_consent','held_quiet_hours')),
  provider_id text,
  idem_key text not null,
  error text,
  created_at timestamptz not null default now(),
  unique (tenant_id, idem_key)
);

create table weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lat numeric(9,6) not null,
  lon numeric(9,6) not null,
  for_date date not null,
  source text not null,
  fetched_at timestamptz not null,
  request_url text,
  sha256 char(64),
  hourly jsonb not null,
  flags jsonb not null,
  created_at timestamptz not null default now()
);
alter table briefings add constraint briefings_weather_fk foreign key (weather_snapshot_id) references weather_snapshots(id);

create table jobs_queue (
  id bigserial primary key,
  tenant_id uuid references tenants(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  run_after timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  status text not null default 'queued' check (status in ('queued','running','done','dead')),
  locked_until timestamptz,
  idem_key text unique,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_id uuid,
  action text not null,
  target_table text,
  target_id uuid,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create table idempotency_keys (
  tenant_id uuid not null references tenants(id) on delete cascade,
  key uuid not null,
  route text not null,
  status int not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

create table counters (
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  value int not null default 0,
  primary key (tenant_id, name)
);

-- Indexes ----------------------------------------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['branches','memberships','workers','crews','crew_members','equipment','hospitals','customers','properties','trees',
    'estimates','estimate_options','estimate_lines','photos','photo_markups','signatures','deposits','jobs','prework_checks','job_days',
    'equipment_bookings','crew_links','briefings','briefing_signoffs','work_log','tree_confirmations','change_orders','corrections',
    'disposal_tickets','invoices','invoice_lines','payments','products','phc_programs','phc_applications','storm_events','storm_intake',
    'claims','certificates','proof_packets','consents','messages','weather_snapshots','audit_log']
  loop
    execute format('create index %I on %I (tenant_id)', t || '_tenant_idx', t);
  end loop;
end $$;

create index job_days_day_crew_idx on job_days (day, crew_id);
create index trees_property_idx on trees (property_id);
create index prework_checks_job_status_idx on prework_checks (job_id, status);
create index phc_applications_applied_idx on phc_applications (applied_on);
create index jobs_queue_status_run_idx on jobs_queue (status, run_after);
create index photos_tree_idx on photos (tree_id);
create index photos_job_day_idx on photos (job_day_id);
create index estimate_lines_option_idx on estimate_lines (option_id);
create index estimate_options_estimate_idx on estimate_options (estimate_id);
create index consents_phone_idx on consents (tenant_id, phone, at desc);
create index weather_lookup_idx on weather_snapshots (tenant_id, lat, lon, for_date, fetched_at desc);
create index audit_target_idx on audit_log (target_table, target_id);

-- Append-only triggers ---------------------------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['photos','photo_markups','signatures','briefings','briefing_signoffs','work_log','tree_confirmations',
    'corrections','payments','phc_applications','consents','weather_snapshots','audit_log','proof_packets']
  loop
    execute format('create trigger %I before update or delete on %I for each row execute function app.forbid_update_delete()', t || '_ao', t);
  end loop;
end $$;

-- updated_at on the two tables the board sorts by.
create or replace function app.touch() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger estimates_touch before update on estimates for each row execute function app.touch();
create trigger prework_checks_touch before update on prework_checks for each row execute function app.touch();

-- Numbers per tenant (estimate 1001, job 1001, invoice 1001) without gaps from concurrent inserts.
create or replace function app.next_number(t uuid, counter text) returns int language sql as $$
  insert into counters (tenant_id, name, value) values (t, counter, 1001)
  on conflict (tenant_id, name) do update set value = counters.value + 1
  returning value
$$;
