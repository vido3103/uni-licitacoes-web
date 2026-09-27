-- VEENCE-HML only. Persist the exact workflow approved by the human operator.
-- This migration does not enable agents, call a provider, or execute inference.

alter table hml.agent_workflow_authorizations
  add column if not exists workflow text;

alter table hml.agent_workflow_authorizations
  drop constraint if exists agent_workflow_authorizations_workflow_check;
alter table hml.agent_workflow_authorizations
  add constraint agent_workflow_authorizations_workflow_check
  check (workflow is null or workflow in (
    'licitacao_completa','radar','triagem','habilitacao','cotacao_e_viabilidade','auditoria_relatorio'
  ));

create or replace function public.hml_issue_agent_workflow_authorization_v2_service(
  p_user uuid,
  p_queue uuid,
  p_request_key uuid,
  p_workflow text,
  p_allowed_agents jsonb,
  p_max_calls integer,
  p_max_cost numeric,
  p_ttl_minutes integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.opportunity_ai_analysis_queue; a hml.agent_workflow_authorizations; code text;
begin
  if p_workflow not in ('licitacao_completa','radar','triagem','habilitacao','cotacao_e_viabilidade','auditoria_relatorio') then
    return null;
  end if;
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
    if a.expires_at<=now() then
      update hml.agent_workflow_authorizations set status='revoked',revoked_at=now() where id=a.id;
    elsif a.workflow is distinct from p_workflow
       or a.allowed_agents is distinct from p_allowed_agents
       or a.max_calls is distinct from p_max_calls
       or a.max_cost_usd is distinct from p_max_cost then
      return null;
    else
      return jsonb_build_object('id',a.id,'status',a.status,'workflow',a.workflow,'expiresAt',a.expires_at,
        'allowedAgents',a.allowed_agents,'maxCalls',a.max_calls,'consumedCalls',a.consumed_calls,
        'maxCostUsd',a.max_cost_usd,'reservedCostUsd',a.reserved_cost_usd,'reused',true);
    end if;
  end if;

  insert into hml.agent_workflow_authorizations
    (request_key,authorized_by,client_id,queue_id,workflow,allowed_agents,max_calls,max_cost_usd,expires_at)
  values(p_request_key,p_user,q.client_id,q.id,p_workflow,p_allowed_agents,p_max_calls,p_max_cost,
    now()+make_interval(mins=>p_ttl_minutes))
  on conflict(request_key) do nothing returning * into a;
  if not found then
    select * into a from hml.agent_workflow_authorizations where request_key=p_request_key;
    if not found or a.authorized_by<>p_user or a.queue_id<>p_queue or a.workflow is distinct from p_workflow then return null; end if;
  end if;
  return jsonb_build_object('id',a.id,'status',a.status,'workflow',a.workflow,'expiresAt',a.expires_at,
    'allowedAgents',a.allowed_agents,'maxCalls',a.max_calls,'consumedCalls',a.consumed_calls,
    'maxCostUsd',a.max_cost_usd,'reservedCostUsd',a.reserved_cost_usd,'reused',false);
end $$;

revoke all on function public.hml_issue_agent_workflow_authorization_v2_service(uuid,uuid,uuid,text,jsonb,integer,numeric,integer) from public,anon,authenticated;
grant execute on function public.hml_issue_agent_workflow_authorization_v2_service(uuid,uuid,uuid,text,jsonb,integer,numeric,integer) to service_role;
