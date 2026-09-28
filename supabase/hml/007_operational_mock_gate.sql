-- VEENCE-HML only. Mock workflow has no Gateway path and never mutates the real queue.
create table hml.execution_authorizations (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  authorized_by uuid not null references auth.users(id),
  client_id uuid not null references public.clients(id),
  queue_id uuid not null references public.opportunity_ai_analysis_queue(id),
  agent_code text not null references hml.agent_registry(agent_code),
  flow text not null check (flow = 'mock_orchestration'),
  max_calls integer not null default 1 check (max_calls = 1),
  consumed_calls integer not null default 0 check (consumed_calls between 0 and 1),
  max_cost_usd numeric(12,6) not null check (max_cost_usd between 0 and 1),
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','consumed','revoked')),
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
create table hml.mock_executions (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null unique references hml.execution_authorizations(id),
  client_id uuid not null references public.clients(id),
  queue_id uuid not null references public.opportunity_ai_analysis_queue(id),
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  result jsonb,
  input_tokens integer not null default 0 check (input_tokens = 0),
  output_tokens integer not null default 0 check (output_tokens = 0),
  cost_usd numeric(12,6) not null default 0 check (cost_usd = 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table hml.mock_agent_runs (
  execution_id uuid not null references hml.mock_executions(id),
  agent_code text not null references hml.agent_registry(agent_code),
  provider text not null default 'mock' check (provider = 'mock'),
  result jsonb not null,
  cost_usd numeric(12,6) not null default 0 check (cost_usd = 0),
  input_tokens integer not null default 0 check (input_tokens = 0),
  output_tokens integer not null default 0 check (output_tokens = 0),
  primary key (execution_id, agent_code)
);
create table hml.execution_events (
  id bigint generated always as identity primary key,
  authorization_id uuid references hml.execution_authorizations(id),
  execution_id uuid references hml.mock_executions(id),
  actor_user_id uuid not null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
do $$ declare table_name text; begin
  foreach table_name in array array['execution_authorizations','mock_executions','mock_agent_runs','execution_events'] loop
    execute format('alter table hml.%I enable row level security', table_name);
    execute format('revoke all on hml.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update on hml.%I to service_role', table_name);
  end loop;
end $$;
grant usage, select on sequence hml.execution_events_id_seq to service_role;

create function public.hml_issue_mock_authorization_service(
  p_user uuid, p_queue uuid, p_request_key uuid, p_agent text,
  p_max_cost numeric, p_ttl_minutes integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.opportunity_ai_analysis_queue; a hml.execution_authorizations;
begin
  select * into q from public.opportunity_ai_analysis_queue where id = p_queue;
  if not found or q.status <> 'pending' or q.attempt_count <> 0 or q.max_attempts <> 1 then return null; end if;
  if not exists (select 1 from public.client_members where client_id=q.client_id and user_id=p_user)
     and not exists (select 1 from public.platform_user_roles where user_id=p_user and role='platform_owner' and active)
  then return null; end if;
  if p_agent <> 'orchestracao_veence' or not exists (select 1 from hml.agent_registry where agent_code=p_agent)
     or p_max_cost is null or p_max_cost < 0 or p_max_cost > 1
     or p_ttl_minutes not between 1 and 60 then return null; end if;
  insert into hml.execution_authorizations
    (request_key,authorized_by,client_id,queue_id,agent_code,flow,max_cost_usd,expires_at)
  values (p_request_key,p_user,q.client_id,q.id,p_agent,'mock_orchestration',p_max_cost,
          now()+make_interval(mins=>p_ttl_minutes))
  on conflict(request_key) do nothing returning * into a;
  if found then
    insert into hml.execution_events(authorization_id,actor_user_id,event_type,details)
      values(a.id,p_user,'authorization_created',jsonb_build_object('flow',a.flow,'max_calls',1,'max_cost_usd',a.max_cost_usd));
  else
    select * into a from hml.execution_authorizations where request_key=p_request_key;
    if a.authorized_by <> p_user or a.queue_id <> p_queue or a.agent_code <> p_agent then return null; end if;
  end if;
  return jsonb_build_object('id',a.id,'status',a.status,'expiresAt',a.expires_at,
    'maxCalls',a.max_calls,'consumedCalls',a.consumed_calls,'maxCostUsd',a.max_cost_usd,
    'flow',a.flow,'agentCode',a.agent_code);
end $$;

create function public.hml_consume_mock_authorization_service(
  p_user uuid, p_queue uuid, p_authorization uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a hml.execution_authorizations; e hml.mock_executions; q public.opportunity_ai_analysis_queue;
begin
  select * into a from hml.execution_authorizations where id=p_authorization for update;
  if not found or a.authorized_by<>p_user or a.queue_id<>p_queue or a.flow<>'mock_orchestration' then return null; end if;
  select * into q from public.opportunity_ai_analysis_queue where id=a.queue_id and client_id=a.client_id;
  if not found or q.status<>'pending' or q.attempt_count<>0 or q.max_attempts<>1 then return null; end if;
  if not exists(select 1 from public.client_members where client_id=a.client_id and user_id=p_user)
     and not exists(select 1 from public.platform_user_roles where user_id=p_user and role='platform_owner' and active)
  then return null; end if;
  if a.status='consumed' then
    select * into e from hml.mock_executions where authorization_id=a.id;
    return jsonb_build_object('executionId',e.id,'status',e.status,'result',e.result,'replayed',true);
  end if;
  if a.status<>'pending' or a.consumed_calls<>0 or a.expires_at<=now() then return null; end if;
  update hml.execution_authorizations set status='consumed',consumed_calls=1,consumed_at=now() where id=a.id;
  insert into hml.mock_executions(authorization_id,client_id,queue_id)
    values(a.id,a.client_id,a.queue_id) returning * into e;
  insert into hml.execution_events(authorization_id,execution_id,actor_user_id,event_type)
    values(a.id,e.id,p_user,'authorization_consumed');
  return jsonb_build_object('executionId',e.id,'status',e.status,'replayed',false,
    'clientId',a.client_id,'queueId',a.queue_id,'agentCode',a.agent_code,'maxCostUsd',a.max_cost_usd);
end $$;

create function public.hml_complete_mock_execution_service(
  p_user uuid, p_execution uuid, p_result jsonb
) returns boolean language plpgsql security definer set search_path = '' as $$
declare e hml.mock_executions; a hml.execution_authorizations; item jsonb;
begin
  select * into e from hml.mock_executions where id=p_execution and status='processing' for update;
  if not found then return false; end if;
  select * into a from hml.execution_authorizations where id=e.authorization_id;
  if a.authorized_by<>p_user or jsonb_typeof(p_result->'agents') is distinct from 'array' or
     p_result->>'recommendation' is distinct from 'revisao_manual' then return false; end if;
  for item in select value from jsonb_array_elements(p_result->'agents') loop
    insert into hml.mock_agent_runs(execution_id,agent_code,result)
      values(e.id,item->>'code',item) on conflict do nothing;
  end loop;
  update hml.mock_executions set status='completed',result=p_result,completed_at=now() where id=e.id;
  insert into hml.execution_events(authorization_id,execution_id,actor_user_id,event_type,details)
    values(a.id,e.id,p_user,'mock_completed',jsonb_build_object('agent_count',jsonb_array_length(p_result->'agents'),'cost_usd',0));
  return true;
end $$;

create function public.hml_revoke_mock_authorization_service(p_user uuid,p_authorization uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare a hml.execution_authorizations;
begin
  update hml.execution_authorizations set status='revoked',revoked_at=now()
  where id=p_authorization and authorized_by=p_user and status='pending' returning * into a;
  if not found then return false; end if;
  insert into hml.execution_events(authorization_id,actor_user_id,event_type)
    values(a.id,p_user,'authorization_revoked');
  return true;
end $$;

create function public.hml_mock_snapshot_service(p_user uuid,p_queue uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q public.opportunity_ai_analysis_queue;
begin
  select * into q from public.opportunity_ai_analysis_queue where id=p_queue;
  if not found or (not exists(select 1 from public.client_members where client_id=q.client_id and user_id=p_user)
    and not exists(select 1 from public.platform_user_roles where user_id=p_user and role='platform_owner' and active))
  then return null; end if;
  return jsonb_build_object(
    'queue',jsonb_build_object('id',q.id,'status',q.status,'attempts',q.attempt_count,'maxAttempts',q.max_attempts),
    'clientId',q.client_id,'userId',p_user,
    'agents',(select coalesce(jsonb_agg(jsonb_build_object('code',agent_code,'enabled',enabled,'version',version,
      'model',model,'provider',provider,'maxCostUsd',max_cost_usd) order by agent_code),'[]'::jsonb) from hml.agent_registry),
    'authorization',(select to_jsonb(a) - 'request_key' from hml.execution_authorizations a
      where a.queue_id=p_queue and a.authorized_by=p_user order by a.created_at desc limit 1),
    'execution',(select to_jsonb(e) from hml.mock_executions e join hml.execution_authorizations a
      on a.id=e.authorization_id where a.queue_id=p_queue and a.authorized_by=p_user order by e.created_at desc limit 1),
    'audit',(select coalesce(jsonb_agg(jsonb_build_object('type',event_type,'at',created_at,'details',details)
      order by created_at),'[]'::jsonb) from hml.execution_events
      where authorization_id in (select id from hml.execution_authorizations where queue_id=p_queue and authorized_by=p_user))
  );
end $$;

do $$ declare signature text; begin
  foreach signature in array array[
    'public.hml_issue_mock_authorization_service(uuid,uuid,uuid,text,numeric,integer)',
    'public.hml_consume_mock_authorization_service(uuid,uuid,uuid)',
    'public.hml_complete_mock_execution_service(uuid,uuid,jsonb)',
    'public.hml_revoke_mock_authorization_service(uuid,uuid)',
    'public.hml_mock_snapshot_service(uuid,uuid)'
  ] loop
    execute format('revoke all on function %s from public,anon,authenticated',signature);
    execute format('grant execute on function %s to service_role',signature);
  end loop;
end $$;
