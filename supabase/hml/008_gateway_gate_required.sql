-- HML only. The paid worker requires a separate authorization that cannot be issued by the mock API.
alter table hml.execution_authorizations
  drop constraint if exists execution_authorizations_flow_check;
alter table hml.execution_authorizations
  add constraint execution_authorizations_flow_check
  check (flow in ('mock_orchestration','gateway_single_shot'));

create function public.hml_consume_gateway_authorization_service(p_user uuid,p_queue uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a hml.execution_authorizations; q public.opportunity_ai_analysis_queue;
begin
  select * into q from public.opportunity_ai_analysis_queue where id=p_queue;
  if not found or q.status<>'pending' or q.attempt_count<>0 or q.max_attempts<>1 then return null; end if;
  select * into a from hml.execution_authorizations
  where authorized_by=p_user and queue_id=p_queue and client_id=q.client_id
    and flow='gateway_single_shot' and status='pending' and consumed_calls=0
    and expires_at>now() and max_calls=1 and max_cost_usd>0
  order by created_at desc limit 1 for update;
  if not found then return null; end if;
  if not exists(select 1 from public.client_members where client_id=a.client_id and user_id=p_user)
    and not exists(select 1 from public.platform_user_roles where user_id=p_user and role='platform_owner' and active)
  then return null; end if;
  update hml.execution_authorizations set status='consumed',consumed_calls=1,consumed_at=now() where id=a.id;
  insert into hml.execution_events(authorization_id,actor_user_id,event_type,details)
    values(a.id,p_user,'gateway_authorization_consumed',jsonb_build_object('max_cost_usd',a.max_cost_usd,'max_calls',1));
  return jsonb_build_object('authorizationId',a.id,'agentCode',a.agent_code,
    'maxCostUsd',a.max_cost_usd,'maxCalls',1);
end $$;
revoke all on function public.hml_consume_gateway_authorization_service(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.hml_consume_gateway_authorization_service(uuid,uuid)
  to service_role;
