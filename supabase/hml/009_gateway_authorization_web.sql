-- HML only. Web-issued authorization for exactly one real Gateway call.
create unique index if not exists execution_authorizations_one_pending_gateway_per_user_queue
on hml.execution_authorizations(authorized_by,queue_id,flow)
where status='pending' and flow='gateway_single_shot';

create or replace function public.hml_issue_gateway_authorization_service(
  p_user uuid, p_queue uuid, p_request_key uuid, p_max_cost numeric, p_ttl_minutes integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.opportunity_ai_analysis_queue; a hml.execution_authorizations;
begin
  select * into q from public.opportunity_ai_analysis_queue where id=p_queue;
  if not found or q.status<>'pending' or q.attempt_count<>0 or q.max_attempts<>1 then return null; end if;
  if not exists(select 1 from public.client_members where client_id=q.client_id and user_id=p_user)
    and not exists(select 1 from public.platform_user_roles where user_id=p_user and role='platform_owner' and active)
  then return null; end if;
  if p_max_cost is null or p_max_cost<=0 or p_max_cost>0.10 or p_ttl_minutes not between 1 and 15 then return null; end if;
  select * into a from hml.execution_authorizations
    where authorized_by=p_user and queue_id=p_queue and flow='gateway_single_shot' and status='pending'
    order by created_at desc limit 1;
  if found then return jsonb_build_object('id',a.id,'status',a.status,'expiresAt',a.expires_at,'maxCalls',a.max_calls,
    'consumedCalls',a.consumed_calls,'maxCostUsd',a.max_cost_usd,'flow',a.flow,'agentCode',a.agent_code,'reused',true); end if;
  insert into hml.execution_authorizations
    (request_key,authorized_by,client_id,queue_id,agent_code,flow,max_cost_usd,expires_at)
  values(p_request_key,p_user,q.client_id,q.id,'orchestracao_veence','gateway_single_shot',p_max_cost,
    now()+make_interval(mins=>p_ttl_minutes))
  on conflict(request_key) do nothing returning * into a;
  if not found then
    select * into a from hml.execution_authorizations where request_key=p_request_key;
    if not found or a.authorized_by<>p_user or a.queue_id<>p_queue or a.flow<>'gateway_single_shot' then return null; end if;
  else
    insert into hml.execution_events(authorization_id,actor_user_id,event_type,details)
    values(a.id,p_user,'gateway_authorization_created',jsonb_build_object('max_calls',1,'max_cost_usd',a.max_cost_usd,'ttl_minutes',p_ttl_minutes));
  end if;
  return jsonb_build_object('id',a.id,'status',a.status,'expiresAt',a.expires_at,'maxCalls',a.max_calls,
    'consumedCalls',a.consumed_calls,'maxCostUsd',a.max_cost_usd,'flow',a.flow,'agentCode',a.agent_code,'reused',false);
end $$;

create or replace function public.hml_revoke_gateway_authorization_service(p_user uuid,p_authorization uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare a hml.execution_authorizations;
begin
  update hml.execution_authorizations set status='revoked',revoked_at=now()
  where id=p_authorization and authorized_by=p_user and flow='gateway_single_shot' and status='pending' returning * into a;
  if not found then return false; end if;
  insert into hml.execution_events(authorization_id,actor_user_id,event_type) values(a.id,p_user,'gateway_authorization_revoked');
  return true;
end $$;

create or replace function public.hml_gateway_authorization_snapshot_service(p_user uuid,p_queue uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q public.opportunity_ai_analysis_queue; a hml.execution_authorizations;
begin
  select * into q from public.opportunity_ai_analysis_queue where id=p_queue;
  if not found or (not exists(select 1 from public.client_members where client_id=q.client_id and user_id=p_user)
    and not exists(select 1 from public.platform_user_roles where user_id=p_user and role='platform_owner' and active)) then return null; end if;
  select * into a from hml.execution_authorizations where queue_id=p_queue and authorized_by=p_user and flow='gateway_single_shot' order by created_at desc limit 1;
  if not found then return null; end if;
  return to_jsonb(a) - 'request_key';
end $$;

revoke all on function public.hml_issue_gateway_authorization_service(uuid,uuid,uuid,numeric,integer) from public,anon,authenticated;
grant execute on function public.hml_issue_gateway_authorization_service(uuid,uuid,uuid,numeric,integer) to service_role;
revoke all on function public.hml_revoke_gateway_authorization_service(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hml_revoke_gateway_authorization_service(uuid,uuid) to service_role;
revoke all on function public.hml_gateway_authorization_snapshot_service(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hml_gateway_authorization_snapshot_service(uuid,uuid) to service_role;
