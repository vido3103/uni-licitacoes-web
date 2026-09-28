create or replace function hml.fail_agent_invocation(
  p_invocation uuid,
  p_error text,
  p_ambiguous boolean,
  p_audit jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  i hml.agent_invocations;
begin
  select * into i
  from hml.agent_invocations
  where id=p_invocation and status='reserved'
  for update;

  if not found then
    return false;
  end if;

  update hml.agent_invocations
  set status=case when p_ambiguous then 'ambiguous' else 'failed' end,
      completed_at=now(),
      error_detail=left(coalesce(p_error,'unknown_error'),4000),
      audit=coalesce(p_audit,'{}'::jsonb) || jsonb_build_object(
        'ambiguous',p_ambiguous,
        'retry_allowed',false,
        'workflow_gate_terminalized',true
      )
  where id=i.id;

  update hml.agent_workflow_authorizations
  set status='revoked',
      revoked_at=coalesce(revoked_at,now())
  where id=i.authorization_id
    and status='pending';

  return true;
end
$function$;
