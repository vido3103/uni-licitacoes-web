-- HML only. Strengthen the foundation before any agent can be enabled.
alter table hml.agent_invocations
  add column if not exists reserved_upper_cost_usd numeric(12,6)
  check (reserved_upper_cost_usd >= 0);
create unique index if not exists hml_agent_invocations_one_per_queue
  on hml.agent_invocations(queue_id) where queue_id is not null;

revoke all on function hml.reserve_agent_invocation(uuid,text,uuid,uuid)
  from public, anon, authenticated, service_role;

create or replace function hml.reserve_agent_invocation(
 p_invocation_key uuid, p_agent_code text, p_client_id uuid, p_queue_id uuid,
 p_estimated_upper_cost_usd numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare a hml.agent_registry; reserved_id uuid;
begin
 select * into a from hml.agent_registry where agent_code = p_agent_code and enabled for update;
 if not found or p_estimated_upper_cost_usd is null or
    p_estimated_upper_cost_usd < 0 or p_estimated_upper_cost_usd > a.max_cost_usd
 then return null; end if;
 insert into hml.agent_invocations
  (invocation_key,agent_id,client_id,queue_id,model,provider,reserved_upper_cost_usd)
 values(p_invocation_key,a.id,p_client_id,p_queue_id,a.model,a.provider,p_estimated_upper_cost_usd)
 on conflict do nothing returning id into reserved_id;
 return reserved_id;
end $$;
revoke all on function hml.reserve_agent_invocation(uuid,text,uuid,uuid,numeric)
  from public, anon, authenticated;
grant execute on function hml.reserve_agent_invocation(uuid,text,uuid,uuid,numeric)
  to service_role;

create or replace function hml.finish_agent_invocation(
 p_key uuid, p_status text, p_request_id text, p_model text,
 p_input_tokens integer, p_output_tokens integer, p_reported_cost_usd numeric,
 p_audit jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare updated integer;
begin
 if p_status not in ('completed','failed','ambiguous') then return false; end if;
 update hml.agent_invocations set
  status = p_status, completed_at = now(), provider_request_id = p_request_id,
  model = coalesce(nullif(p_model,''), model), input_tokens = p_input_tokens,
  output_tokens = p_output_tokens, reported_cost_usd = p_reported_cost_usd,
  audit = coalesce(p_audit,'{}'::jsonb)
 where invocation_key = p_key and status = 'reserved';
 get diagnostics updated = row_count;
 return updated = 1;
end $$;
revoke all on function hml.finish_agent_invocation(uuid,text,text,text,integer,integer,numeric,jsonb)
 from public,anon,authenticated;
grant execute on function hml.finish_agent_invocation(uuid,text,text,text,integer,integer,numeric,jsonb)
 to service_role;
