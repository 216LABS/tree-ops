-- Schedule Tree Ops' background jobs on Supabase pg_cron (copied from Flake: Vercel Hobby rejects sub-daily crons).
-- Safe to re-run: each job is unscheduled by name, then created again.
-- The app origin and bearer token are read from Vault at run time
-- (app_base_url, cron_secret). Nothing here is hard-coded.
-- Routes are GET and require `Authorization: Bearer <CRON_SECRET>`.

-- Conditional on purpose. A second CREATE EXTENSION IF NOT EXISTS still fires
-- Supabase's extension event trigger, and that trigger's revoke fails once
-- the grants already exist.
do $ext$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    create extension pg_cron with schema pg_catalog;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    -- In extensions, not public (Supabase advisor 0014). Its functions live in the net schema either way.
    create extension pg_net schema extensions;
  end if;
end
$ext$;

do $schedule$
declare
  base_url text;
  cron_secret text;
  spec record;
  job_id bigint;
  command text;
begin
  select decrypted_secret into base_url
  from vault.decrypted_secrets
  where name = 'app_base_url'
  order by created_at desc
  limit 1;

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'cron_secret'
  order by created_at desc
  limit 1;

  if coalesce(btrim(base_url), '') = '' or coalesce(btrim(cron_secret), '') = '' then
    raise exception 'Vault secrets app_base_url and cron_secret are required before scheduling';
  end if;

  -- Drop this run's names so a re-run cannot
  -- leave a second copy, including one that had the secret baked into the command.
  for job_id in
    select j.jobid from cron.job j
    where j.jobname in (
      'treeops-jobs', 'treeops-daily', 'treeops-prune-log'
    )
  loop
    perform cron.unschedule(job_id);
  end loop;

  for spec in
    select *
    from (values
      ('treeops-jobs'::text, '*/2 * * * *'::text, '/api/cron/jobs'::text, 15000),
      ('treeops-daily', '0 9 * * *', '/api/cron/daily', 30000)
    ) as v(job_name, job_schedule, path, timeout_ms)
  loop
    for job_id in select j.jobid from cron.job j where j.jobname = spec.job_name loop
      perform cron.unschedule(job_id);
    end loop;

    -- The stored command looks the secrets up when the job fires, so rotating
    -- either Vault value takes effect without editing cron.job.
    command := format($job$
      select net.http_get(
        url := rtrim((
          select decrypted_secret from vault.decrypted_secrets
          where name = 'app_base_url'
          order by created_at desc
          limit 1
        ), '/') || %L,
        headers := jsonb_build_object(
          'Authorization',
          'Bearer ' || (
            select decrypted_secret from vault.decrypted_secrets
            where name = 'cron_secret'
            order by created_at desc
            limit 1
          )
        ),
        timeout_milliseconds := %s
      );
    $job$, spec.path, spec.timeout_ms);

    perform cron.schedule(spec.job_name, spec.job_schedule, command);
  end loop;

  perform cron.schedule(
    'treeops-prune-log',
    '30 3 * * *',
    $prune$delete from cron.job_run_details where end_time < now() - interval '3 days'$prune$
  );

  if (
    select count(*)
    from cron.job
    where jobname in ('treeops-jobs', 'treeops-daily', 'treeops-prune-log')
  ) <> 3 then
    raise exception 'expected the tree ops cron jobs to be scheduled';
  end if;
end
$schedule$;
