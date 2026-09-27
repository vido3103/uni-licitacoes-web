-- VEENCE-HML only. Explicit human release between gate preparation and real execution.
-- This migration never enables AI, never enables agents, and never calls a provider.

alter table hml.agent_workflow_authorizations
  add column if not exists execution_released_by uuid references auth.users(id),
  add column if not exists execution_released_at timestamptz,
  add column if not exists release_request_key uuid;

create unique index if not exists agent_workflow_release_request_key_unique
  on hml.agent_workflow_authorizations(release_request_key)
  where release_request_key is not null;

alter table hml.agent_workflow_authorizations
  drop constraint if exists agent_workflow_execution_release_pair_check;
alter table hml.agent_workflow_authorizations
  add constraint agent_workflow_execution_release_pair_check check (
    (execution_released_by is null and execution_released_at is null and release_request_key is null)
    or
    (execution_released_by is not null and execution_released_at is not null and release_request_key is not null)
  );

create or replace function public.hml_release_agent_workflow_authorization_service(
  p_user uuid,
  p_authorization uuid,
  p_release_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a hml.agent_workflow_authorizations;
  code text;
  agent hml.agent_registry;
begin
  select * into a
  from hml.agent_workflow_authorizations
  where id=p_authorization
  for update;

  if not found or a.authorized_by<>p_user or a.status<>'pending' or a.expires_at<=now()
     or a.consumed_calls<>0 or a.reserved_cost_usd<>0 then
    return null;
  end if;

  if not exists(select 1 from public.client_members where client_id=a.client_id and user_id=p_user)
     and not exists(select 1 from public.platform_user_roles where user_id=p_user and role='platform_owner' and active) then
    return null;
  end if;

  if a.execution_released_at is not null then
    if a.execution_released_by=p_user and a.release_request_key=p_release_key then
      return jsonb_build_object(
        'id',a.id,'status',a.status,'workflow',a.workflow,'executionReleased',true,
        'executionReleasedAt',a.execution_released_at,'executionReleasedBy',a.execution_released_by,
        'expiresAt',a.expires_at,'consumedCalls',a.consumed_calls,'maxCalls',a.max_calls,
        'reservedCostUsd',a.reserved_cost_usd,'maxCostUsd',a.max_cost_usd,'reused',true
      );
    end if;
    return null;
  end if;

  if p_release_key is null then return null; end if;

  for code in select jsonb_array_elements_text(a.allowed_agents) loop
    select * into agent from hml.agent_registry where agent_code=code;
    if not found or agent.enabled is distinct from true or agent.provider<>'gateway'
       or agent.model is null or length(trim(agent.instructions))=0 or agent.max_cost_usd<=0 then
      return null;
    end if;
  end loop;

  update hml.agent_workflow_authorizations
  set execution_released_by=p_user,
      execution_released_at=now(),
      release_request_key=p_release_key
  where id=a.id
  returning * into a;

  return jsonb_build_object(
    'id',a.id,'status',a.status,'workflow',a.workflow,'executionReleased',true,
    'executionReleasedAt',a.execution_released_at,'executionReleasedBy',a.execution_released_by,
    'expiresAt',a.expires_at,'consumedCalls',a.consumed_calls,'maxCalls',a.max_calls,
    'reservedCostUsd',a.reserved_cost_usd,'maxCostUsd',a.max_cost_usd,'reused',false
  );
end $$;

create or replace function hml.reserve_authorized_agent_invocation(
  p_authorization uuid,
  p_user uuid,
  p_invocation_key uuid,
  p_agent_code text,
  p_client_id uuid,
  p_queue_id uuid,
  p_estimated_cost numeric
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a hml.agent_workflow_authorizations; agent hml.agent_registry; existing hml.agent_invocations; new_id uuid;
begin
  select * into existing from hml.agent_invocations where invocation_key=p_invocation_key;
  if found then
    if existing.authorization_id<>p_authorization or existing.agent_id<>(select id from hml.agent_registry where agent_code=p_agent_code) then return null; end if;
    return jsonb_build_object('id',existing.id,'replayed',true,'status',existing.status);
  end if;

  select * into a from hml.agent_workflow_authorizations where id=p_authorization for update;
  if not found or a.authorized_by<>p_user or a.client_id<>p_client_id or a.queue_id<>p_queue_id
     or a.status<>'pending' or a.expires_at<=now() or a.consumed_calls>=a.max_calls
     or a.execution_released_at is null or a.execution_released_by<>p_user
     or p_estimated_cost is null or p_estimated_cost<0 or a.reserved_cost_usd+p_estimated_cost>a.max_cost_usd
     or not (a.allowed_agents ? p_agent_code) then return null; end if;

  select * into agent from hml.agent_registry where agent_code=p_agent_code and enabled for update;
  if not found or agent.model is null or length(trim(agent.instructions))=0 or agent.max_cost_usd<=0
     or p_estimated_cost>agent.max_cost_usd then return null; end if;

  insert into hml.agent_invocations(invocation_key,agent_id,client_id,queue_id,model,provider,estimated_cost_usd,authorization_id)
    values(p_invocation_key,agent.id,p_client_id,p_queue_id,agent.model,agent.provider,p_estimated_cost,a.id)
    returning id into new_id;

  update hml.agent_workflow_authorizations
    set consumed_calls=consumed_calls+1,
        reserved_cost_usd=reserved_cost_usd+p_estimated_cost,
        status=case when consumed_calls+1>=max_calls then 'consumed' else status end,
        consumed_at=case when consumed_calls+1>=max_calls then now() else consumed_at end
    where id=a.id;

  return jsonb_build_object('id',new_id,'replayed',false,'status','reserved');
end $$;

revoke all on function public.hml_release_agent_workflow_authorization_service(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.hml_release_agent_workflow_authorization_service(uuid,uuid,uuid) to service_role;
revoke all on function hml.reserve_authorized_agent_invocation(uuid,uuid,uuid,text,uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function hml.reserve_authorized_agent_invocation(uuid,uuid,uuid,text,uuid,uuid,numeric) to service_role;
