-- Keep mock status isolated after real Gateway authorizations are introduced.
create or replace function public.hml_mock_snapshot_service(p_user uuid,p_queue uuid)
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
      where a.queue_id=p_queue and a.authorized_by=p_user and a.flow='mock_orchestration' order by a.created_at desc limit 1),
    'execution',(select to_jsonb(e) from hml.mock_executions e join hml.execution_authorizations a
      on a.id=e.authorization_id where a.queue_id=p_queue and a.authorized_by=p_user and a.flow='mock_orchestration' order by e.created_at desc limit 1),
    'audit',(select coalesce(jsonb_agg(jsonb_build_object('type',event_type,'at',created_at,'details',details)
      order by created_at),'[]'::jsonb) from hml.execution_events
      where authorization_id in (select id from hml.execution_authorizations where queue_id=p_queue and authorized_by=p_user))
  );
end $$;
