-- VEENCE-HML only. Keep authorization idempotency keys server-side.
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
  return to_jsonb(a) - 'request_key' - 'release_request_key';
end $$;

revoke all on function public.hml_agent_workflow_authorization_snapshot_service(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hml_agent_workflow_authorization_snapshot_service(uuid,uuid) to service_role;
