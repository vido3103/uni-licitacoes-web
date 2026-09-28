-- Veence AI queue: automatically recover orphaned processing jobs.
-- The private recovery function already enforces a minimum stale TTL of 60s,
-- uses FOR UPDATE SKIP LOCKED, and respects attempt_count/max_attempts.
-- We keep the operational TTL at 300s (5 minutes) and scan once per minute.

create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'veence-ai-recover-stale-jobs') then
    perform cron.unschedule('veence-ai-recover-stale-jobs');
  end if;
end
$$;

select cron.schedule(
  'veence-ai-recover-stale-jobs',
  '* * * * *',
  $cron$select * from private.recover_stale_opportunity_ai_analysis_jobs(300, 50);$cron$
);
