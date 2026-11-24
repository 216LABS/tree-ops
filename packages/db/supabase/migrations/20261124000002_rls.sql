-- Row level security (docs/SPEC.md sections 7 and 8).
-- Office roles read their tenant. Writes follow the permission matrix. Crew roles that sign in see only their crews'
-- job days. Crew, customer and viewer links never use these policies: the server checks the token and uses the
-- service connection with an explicit tenant filter (apps/web/lib/scope.ts).

create or replace function app.next_number(t uuid, counter text) returns int language sql security definer set search_path = public as $$
  insert into counters (tenant_id, name, value) values (t, counter, 1001)
  on conflict (tenant_id, name) do update set value = counters.value + 1
  returning value
$$;

create or replace function app.my_tenants() returns setof uuid language sql stable security definer set search_path = public as $$
  select tenant_id from memberships where user_id = auth.uid()
$$;

create or replace function app.has_role(t uuid, roles text[]) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where user_id = auth.uid() and tenant_id = t and role = any(roles))
$$;

create or replace function app.is_office(t uuid) returns boolean language sql stable security definer set search_path = public as $$
  select app.has_role(t, array['owner','office','sales_arborist','enterprise_admin'])
$$;

-- The crews a signed-in crew person belongs to.
create or replace function app.my_crews() returns setof uuid language sql stable security definer set search_path = public as $$
  select cm.crew_id from crew_members cm join workers w on w.id = cm.worker_id where w.user_id = auth.uid()
$$;

grant usage on schema app to authenticated;
grant execute on all functions in schema app to authenticated;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Service-only tables: never reachable from a signed-in session.
revoke all on jobs_queue, idempotency_keys, stripe_events, counters from authenticated;

do $$
declare
  t text;
  -- table => roles that may insert/update/delete (empty: the server writes it)
  writers jsonb := jsonb_build_object(
    'branches', '["owner","enterprise_admin"]',
    'memberships', '["owner","enterprise_admin"]',
    'workers', '["owner","office","enterprise_admin"]',
    'crews', '["owner","office"]',
    'crew_members', '["owner","office"]',
    'equipment', '["owner","office"]',
    'hospitals', '["owner","office"]',
    'customers', '["owner","office","sales_arborist"]',
    'properties', '["owner","office","sales_arborist"]',
    'trees', '["owner","office","sales_arborist"]',
    'estimates', '["owner","office","sales_arborist"]',
    'estimate_options', '["owner","office","sales_arborist"]',
    'estimate_lines', '["owner","office","sales_arborist"]',
    'photos', '["owner","office","sales_arborist"]',
    'photo_markups', '["owner","office","sales_arborist"]',
    'signatures', '[]',
    'deposits', '["owner","office"]',
    'jobs', '["owner","office"]',
    'prework_checks', '["owner","office","sales_arborist"]',
    'job_days', '["owner","office"]',
    'equipment_bookings', '["owner","office"]',
    'crew_links', '["owner","office"]',
    'briefings', '[]',
    'briefing_signoffs', '[]',
    'work_log', '[]',
    'tree_confirmations', '[]',
    'change_orders', '["owner","office","sales_arborist"]',
    'corrections', '["owner","office"]',
    'disposal_tickets', '["owner","office"]',
    'invoices', '["owner","office"]',
    'invoice_lines', '["owner","office"]',
    'payments', '[]',
    'products', '["owner","office","sales_arborist"]',
    'phc_programs', '["owner","office","sales_arborist"]',
    'phc_applications', '["owner","office","sales_arborist"]',
    'storm_events', '["owner","office"]',
    'storm_intake', '["owner","office","sales_arborist"]',
    'claims', '["owner","office"]',
    'certificates', '["owner","office"]',
    'proof_packets', '["owner","office"]',
    'consents', '["owner","office"]',
    'messages', '[]',
    'weather_snapshots', '[]',
    'audit_log', '[]'
  );
  roles text[];
begin
  for t in select jsonb_object_keys(writers) loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (app.is_office(tenant_id))', t || '_read', t);
    select coalesce(array_agg(x), '{}') into roles from jsonb_array_elements_text((writers ->> t)::jsonb) x;
    if array_length(roles, 1) > 0 then
      execute format('create policy %I on %I for insert to authenticated with check (app.has_role(tenant_id, %L))', t || '_ins', t, roles);
      execute format('create policy %I on %I for update to authenticated using (app.has_role(tenant_id, %L)) with check (app.has_role(tenant_id, %L))', t || '_upd', t, roles, roles);
      execute format('create policy %I on %I for delete to authenticated using (app.has_role(tenant_id, %L))', t || '_del', t, roles);
    end if;
  end loop;
end $$;

-- Everyone sees their own membership row (the app reads it to learn the tenant and role).
create policy memberships_self on memberships for select to authenticated using (user_id = auth.uid());

-- Tenants: members read; owner and enterprise admin edit.
alter table tenants enable row level security;
create policy tenants_read on tenants for select to authenticated using (id in (select app.my_tenants()));
create policy tenants_upd on tenants for update to authenticated using (app.has_role(id, array['owner','enterprise_admin'])) with check (app.has_role(id, array['owner','enterprise_admin']));

-- Crew roles: only their crews' job days and those jobs.
create policy job_days_crew on job_days for select to authenticated using (crew_id in (select app.my_crews()));
create policy jobs_crew on jobs for select to authenticated using (id in (select jd.job_id from job_days jd where jd.crew_id in (select app.my_crews())));

-- Shared reference rows (tenant_id null) are readable by any signed-in user; tenant rows follow the usual rule.
alter table species enable row level security;
create policy species_read on species for select to authenticated using (tenant_id is null or app.is_office(tenant_id));
create policy species_write on species for all to authenticated using (app.has_role(tenant_id, array['owner','office'])) with check (app.has_role(tenant_id, array['owner','office']));
alter table prework_rules enable row level security;
create policy prework_rules_read on prework_rules for select to authenticated using (tenant_id is null or app.is_office(tenant_id));
create policy prework_rules_write on prework_rules for all to authenticated using (app.has_role(tenant_id, array['owner','office'])) with check (app.has_role(tenant_id, array['owner','office']));

-- Only an owner or office may override a pre-work check, even though sales arborists edit checks.
create or replace function app.guard_override() returns trigger language plpgsql as $$
begin
  if new.status = 'overridden' and (tg_op = 'INSERT' or old.status is distinct from 'overridden')
     and auth.uid() is not null and not app.has_role(new.tenant_id, array['owner','office']) then
    raise exception 'Only an owner or office can override a check' using errcode = '42501';
  end if;
  if new.status = 'overridden' and auth.uid() is not null then new.override_by = auth.uid(); end if;
  return new;
end $$;
create trigger prework_checks_override before insert or update on prework_checks for each row execute function app.guard_override();

-- Audit log: every write to the tables people change by hand.
create or replace function app.audit() returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into audit_log (tenant_id, actor_id, action, target_table, target_id, before, after)
  values (
    coalesce((rec ->> 'tenant_id')::uuid, (rec ->> 'id')::uuid),
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    (rec ->> 'id')::uuid,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tenants','branches','memberships','workers','crews','crew_members','equipment','customers','properties','trees',
    'estimates','deposits','jobs','prework_checks','job_days','equipment_bookings','crew_links','change_orders','invoices','products',
    'phc_programs','storm_intake','claims','certificates','prework_rules']
  loop
    execute format('create trigger %I after insert or update or delete on %I for each row execute function app.audit()', t || '_audit', t);
  end loop;
end $$;

-- Storage: private buckets; the server hands out short signed links.
insert into storage.buckets (id, name, public) values
  ('photos', 'photos', false), ('signatures', 'signatures', false), ('docs', 'docs', false), ('packets', 'packets', false)
on conflict (id) do nothing;
