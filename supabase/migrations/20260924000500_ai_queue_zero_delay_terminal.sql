-- Veence AI retry contract:
-- p_retry_delay_seconds = 0 means terminal failure (no automatic retry).
-- Positive delays retain the existing bounded retry behavior.
create or replace function private.fail_opportunity_ai_analysis_job(
  p_queue_id uuid,
  p_worker_id text,
  p_error text,
  p_retry_delay_seconds integer default 60
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status text;
  v_terminal boolean := coalesce(p_retry_delay_seconds,60) = 0;
begin
  update public.opportunity_ai_analysis_queue q
  set status = case
        when v_terminal then 'failed'
        when q.attempt_count < q.max_attempts then 'retry_wait'
        else 'failed'
      end,
      next_attempt_at = case
        when not v_terminal and q.attempt_count < q.max_attempts
          then now() + make_interval(secs => greatest(coalesce(p_retry_delay_seconds,60),1))
        else null
      end,
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
