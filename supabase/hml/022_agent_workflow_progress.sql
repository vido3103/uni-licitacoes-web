-- VEENCE-HML only. Durable workflow progress and one-agent-per-authorization idempotency.
-- Allows a timed-out HTTP orchestrator request to resume from completed durable invocations
-- without repeating provider calls that already succeeded.

create unique index if not exists hml_agent_invocations_one_agent_per_authorization
  on hml.agent_invocations(authorization_id, agent_id)
  where authorization_id is not null;

create or replace function public.hml_agent_workflow_progress_service(
  p_user uuid,
  p_authorization uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  a hml.agent_workflow_authorizations;
  payload jsonb;
begin
  select * into a from hml.agent_workflow_authorizations where id=p_authorization;
  if not found then return null; end if;
  if a.authorized_by<>p_user and not exists(
    select 1 from public.platform_user_roles
    where user_id=p_user and role='platform_owner' and active
  ) then return null; end if;
  if not exists(
    select 1 from public.client_members
    where client_id=a.client_id and user_id=p_user
  ) and not exists(
    select 1 from public.platform_user_roles
    where user_id=p_user and role='platform_owner' and active
  ) then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,
    'agentCode',r.agent_code,
    'status',i.status,
    'model',i.model,
    'provider',i.provider,
    'reservedAt',i.reserved_at,
    'completedAt',i.completed_at,
    'inputTokens',i.input_tokens,
    'outputTokens',i.output_tokens,
    'reportedCostUsd',i.reported_cost_usd,
    'estimatedCostUsd',i.estimated_cost_usd,
    'result',i.result,
    'errorDetail',i.error_detail,
    'audit',i.audit
  ) order by i.reserved_at),'[]'::jsonb)
  into payload
  from hml.agent_invocations i
  join hml.agent_registry r on r.id=i.agent_id
  where i.authorization_id=a.id;

  return jsonb_build_object(
    'authorizationId',a.id,
    'status',a.status,
    'workflow',a.workflow,
    'allowedAgents',a.allowed_agents,
    'maxCalls',a.max_calls,
    'consumedCalls',a.consumed_calls,
    'maxCostUsd',a.max_cost_usd,
    'reservedCostUsd',a.reserved_cost_usd,
    'expiresAt',a.expires_at,
    'executionReleasedAt',a.execution_released_at,
    'invocations',payload
  );
end $$;

revoke all on function public.hml_agent_workflow_progress_service(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hml_agent_workflow_progress_service(uuid,uuid) to service_role;
