-- VEENCE-HML only. Operational gate for future real multi-agent workflows.
-- This migration does not enable any agent and cannot trigger inference by itself.

create table if not exists hml.agent_workflow_authorizations (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  authorized_by uuid not null references auth.users(id),
  client_id uuid not null references public.clients(id),
  queue_id uuid not null references public.opportunity_ai_analysis_queue(id),
  allowed_agents jsonb not null check (jsonb_typeof(allowed_agents) = 'array'),
  max_calls integer not null check (max_calls between 1 and 10),
  consumed_calls integer not null default 0 check (consumed_calls between 0 and 10),
  max_cost_usd numeric(12,6) not null check (max_cost_usd > 0 and max_cost_usd <= 0.50),
  reserved_cost_usd numeric(12,6) not null default 0 check (reserved_cost_usd >= 0),
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','consumed','revoked')),
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check (consumed_calls <= max_calls),
  check (reserved_cost_usd <= max_cost_usd)
);

alter table hml.agent_workflow_authorizations enable row level security;
revoke all on hml.agent_workflow_authorizations from public, anon, authenticated;
grant select, insert, update on hml.agent_workflow_authorizations to service_role;

alter table hml.agent_invocations
  add column if not exists authorization_id uuid references hml.agent_workflow_authorizations(id);

create unique index if not exists agent_workflow_one_pending_per_user_queue
on hml.agent_workflow_authorizations(authorized_by, queue_id)
where status = 'pending';

create or replace function public.hml_issue_agent_workflow_authorization_service(
  p_user uuid,
  p_queue uuid,
  p_request_key uuid,
  p_allowed_agents jsonb,
  p_max_calls integer,
  p_max_cost numeric,
  p_ttl_minutes integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.opportunity_ai_analysis_queue; a hml.agent_workflow_authorizations; code text;
begin
  select * into q from public.opportunity_ai_analysis_queue where id = p_queue;
  if not found then return null; end if;
  if not exists(select 1 from public.client_members where client_id=q.client_id and user_id=p_user)
     and not exists(select 1 from public.platform_user_roles where user_id=p_user and role='platform_owner' and active)
  then return null; end if;
  if jsonb_typeof(p_allowed_agents) is distinct from 'array' or jsonb_array_length(p_allowed_agents)=0
     or jsonb_array_length(p_allowed_agents)>10 or p_max_calls<1 or p_max_calls>10
     or p_max_calls>jsonb_array_length(p_allowed_agents)
     or p_max_cost is null or p_max_cost<=0 or p_max_cost>0.50
     or p_ttl_minutes not between 1 and 30 then return null; end if;
  for code in select jsonb_array_elements_text(p_allowed_agents) loop
    if not exists(select 1 from hml.agent_registry where agent_code=code) then return null; end if;
  end loop;
  select * into a from hml.agent_workflow_authorizations
    where authorized_by=p_user and queue_id=p_queue and status='pending'
    order by created_at desc limit 1;
  if found then
    return jsonb_build_object('id',a.id,'status',a.status,'expiresAt',a.expires_at,
      'allowedAgents',a.allowed_agents,'maxCalls',a.max_calls,'consumedCalls',a.consumed_calls,
      'maxCostUsd',a.max_cost_usd,'reservedCostUsd',a.reserved_cost_usd,'reused',true);
  end if;
  insert into hml.agent_workflow_authorizations
    (request_key,authorized_by,client_id,queue_id,allowed_agents,max_calls,max_cost_usd,expires_at)
  values(p_request_key,p_user,q.client_id,q.id,p_allowed_agents,p_max_calls,p_max_cost,
    now()+make_interval(mins=>p_ttl_minutes))
  on conflict(request_key) do nothing returning * into a;
  if not found then
    select * into a from hml.agent_workflow_authorizations where request_key=p_request_key;
    if not found or a.authorized_by<>p_user or a.queue_id<>p_queue then return null; end if;
  end if;
  return jsonb_build_object('id',a.id,'status',a.status,'expiresAt',a.expires_at,
    'allowedAgents',a.allowed_agents,'maxCalls',a.max_calls,'consumedCalls',a.consumed_calls,
    'maxCostUsd',a.max_cost_usd,'reservedCostUsd',a.reserved_cost_usd,'reused',false);
end $$;

create or replace function public.hml_revoke_agent_workflow_authorization_service(
  p_user uuid, p_authorization uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update hml.agent_workflow_authorizations set status='revoked',revoked_at=now()
  where id=p_authorization and authorized_by=p_user and status='pending';
  return found;
end $$;

create or replace function public.hml_agent_workflow_authorization_snapshot_service(
  p_user uuid, p_queue uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q public.opportunity_ai_analysis_queue; a hml.agent_workflow_authorizations;
begin
  select * into q from public.opportunity_ai_analysis_queue where id=p_queue;
  if not found or (not exists(select 1 from public.client_members where client_id=q.client_id and user_id=p_user)
    and not exists(select 1 from public.platform_user_roles where user_id=p_user and role='platform_owner' and active)) then return null; end if;
  select * into a from hml.agent_workflow_authorizations
    where queue_id=p_queue and authorized_by=p_user order by created_at desc limit 1;
  if not found then return null; end if;
  return to_jsonb(a) - 'request_key';
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

revoke all on function public.hml_issue_agent_workflow_authorization_service(uuid,uuid,uuid,jsonb,integer,numeric,integer) from public,anon,authenticated;
grant execute on function public.hml_issue_agent_workflow_authorization_service(uuid,uuid,uuid,jsonb,integer,numeric,integer) to service_role;
revoke all on function public.hml_revoke_agent_workflow_authorization_service(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hml_revoke_agent_workflow_authorization_service(uuid,uuid) to service_role;
revoke all on function public.hml_agent_workflow_authorization_snapshot_service(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hml_agent_workflow_authorization_snapshot_service(uuid,uuid) to service_role;
revoke all on function hml.reserve_authorized_agent_invocation(uuid,uuid,uuid,text,uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function hml.reserve_authorized_agent_invocation(uuid,uuid,uuid,text,uuid,uuid,numeric) to service_role;
