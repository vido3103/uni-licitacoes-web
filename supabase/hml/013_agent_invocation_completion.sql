-- VEENCE-HML only. Durable completion/failure state for real agent invocations.
-- Reservations and budget remain consumed after any provider attempt; no automatic retry.

alter table hml.agent_invocations
  add column if not exists result jsonb,
  add column if not exists error_detail text;

create or replace function hml.complete_agent_invocation(
  p_invocation uuid,
  p_provider_request_id text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_reported_cost numeric,
  p_result jsonb,
  p_audit jsonb default '{}'::jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare i hml.agent_invocations; overrun boolean;
begin
  select * into i from hml.agent_invocations where id=p_invocation and status='reserved' for update;
  if not found then return false; end if;
  if p_input_tokens is not null and p_input_tokens<0 then return false; end if;
  if p_output_tokens is not null and p_output_tokens<0 then return false; end if;
  if p_reported_cost is not null and p_reported_cost<0 then return false; end if;
  overrun := p_reported_cost is not null and i.estimated_cost_usd is not null and p_reported_cost>i.estimated_cost_usd;
  update hml.agent_invocations
    set status='completed', completed_at=now(), provider_request_id=p_provider_request_id,
        input_tokens=p_input_tokens, output_tokens=p_output_tokens, reported_cost_usd=p_reported_cost,
        result=p_result, error_detail=null,
        audit=coalesce(p_audit,'{}'::jsonb)||jsonb_build_object('cost_overrun',overrun,'retry_allowed',false)
    where id=i.id;
  return true;
end $$;

create or replace function hml.fail_agent_invocation(
  p_invocation uuid,
  p_error text,
  p_ambiguous boolean,
  p_audit jsonb default '{}'::jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare i hml.agent_invocations;
begin
  select * into i from hml.agent_invocations where id=p_invocation and status='reserved' for update;
  if not found then return false; end if;
  update hml.agent_invocations
    set status=case when p_ambiguous then 'ambiguous' else 'failed' end,
        completed_at=now(), error_detail=left(coalesce(p_error,'unknown_error'),4000),
        audit=coalesce(p_audit,'{}'::jsonb)||jsonb_build_object('ambiguous',p_ambiguous,'retry_allowed',false)
    where id=i.id;
  return true;
end $$;

revoke all on function hml.complete_agent_invocation(uuid,text,integer,integer,numeric,jsonb,jsonb) from public,anon,authenticated;
grant execute on function hml.complete_agent_invocation(uuid,text,integer,integer,numeric,jsonb,jsonb) to service_role;
revoke all on function hml.fail_agent_invocation(uuid,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function hml.fail_agent_invocation(uuid,text,boolean,jsonb) to service_role;
