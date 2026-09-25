-- Veence AI: explicit terminal failure path for permanent/ambiguous provider errors.
-- This prevents 4xx/auth errors and ambiguous timeouts from being immediately
-- re-enqueued merely because attempt_count is still below max_attempts.

create or replace function private.fail_opportunity_ai_analysis_job_permanent(
  p_queue_id uuid,
  p_worker_id text,
  p_error text
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status text;
begin
  update public.opportunity_ai_analysis_queue q
  set status='failed',
      next_attempt_at=null,
      error_detail=left(coalesce(p_error,'worker_failure'),4000),
      locked_at=null,
      locked_by=null,
      heartbeat_at=null,
      updated_at=now()
  where q.id=p_queue_id
    and q.status='processing'
    and q.locked_by=p_worker_id
  returning q.status into v_status;

  if v_status is null then raise exception 'job_not_owned'; end if;
  return v_status;
end;
$function$;

create or replace function public.fail_opportunity_ai_analysis_job_permanent_service(
  p_queue_id uuid,
  p_worker_id text,
  p_error text
)
returns text
language sql
security definer
set search_path to ''
as $function$
  select private.fail_opportunity_ai_analysis_job_permanent(p_queue_id,p_worker_id,p_error);
$function$;

revoke all on function public.fail_opportunity_ai_analysis_job_permanent_service(uuid,text,text) from public,anon,authenticated;
grant execute on function public.fail_opportunity_ai_analysis_job_permanent_service(uuid,text,text) to service_role;
