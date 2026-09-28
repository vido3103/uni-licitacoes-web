-- VEENCE-HML only. Public-schema service-role wrappers for the Edge runtime.
-- No authenticated/anon direct execution is granted.

create or replace function public.hml_agent_config_service(p_agent_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(a) from hml.agent_registry a where a.agent_code=p_agent_code;
$$;

create or replace function public.hml_reserve_authorized_agent_invocation_service(
  p_authorization uuid,p_user uuid,p_invocation_key uuid,p_agent_code text,
  p_client_id uuid,p_queue_id uuid,p_estimated_cost numeric
) returns jsonb language sql security definer set search_path = '' as $$
  select hml.reserve_authorized_agent_invocation(
    p_authorization,p_user,p_invocation_key,p_agent_code,p_client_id,p_queue_id,p_estimated_cost
  );
$$;

create or replace function public.hml_complete_agent_invocation_service(
  p_invocation uuid,p_provider_request_id text,p_input_tokens integer,p_output_tokens integer,
  p_reported_cost numeric,p_result jsonb,p_audit jsonb default '{}'::jsonb
) returns boolean language sql security definer set search_path = '' as $$
  select hml.complete_agent_invocation(
    p_invocation,p_provider_request_id,p_input_tokens,p_output_tokens,p_reported_cost,p_result,p_audit
  );
$$;

create or replace function public.hml_fail_agent_invocation_service(
  p_invocation uuid,p_error text,p_ambiguous boolean,p_audit jsonb default '{}'::jsonb
) returns boolean language sql security definer set search_path = '' as $$
  select hml.fail_agent_invocation(p_invocation,p_error,p_ambiguous,p_audit);
$$;

create or replace function public.hml_agent_invocation_snapshot_service(p_user uuid,p_invocation uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(i)
  from hml.agent_invocations i
  join hml.agent_workflow_authorizations a on a.id=i.authorization_id
  where i.id=p_invocation and a.authorized_by=p_user;
$$;

do $$ declare signature text; begin
  foreach signature in array array[
    'public.hml_agent_config_service(text)',
    'public.hml_reserve_authorized_agent_invocation_service(uuid,uuid,uuid,text,uuid,uuid,numeric)',
    'public.hml_complete_agent_invocation_service(uuid,text,integer,integer,numeric,jsonb,jsonb)',
    'public.hml_fail_agent_invocation_service(uuid,text,boolean,jsonb)',
    'public.hml_agent_invocation_snapshot_service(uuid,uuid)'
  ] loop
    execute format('revoke all on function %s from public,anon,authenticated',signature);
    execute format('grant execute on function %s to service_role',signature);
  end loop;
end $$;
