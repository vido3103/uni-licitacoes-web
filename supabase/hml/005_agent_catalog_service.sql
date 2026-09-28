-- HML only. Catalog is read by the HML Edge Function after checking Auth and membership.
create or replace function public.hml_agent_catalog_service()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', a.agent_code, 'version', a.version, 'enabled', a.enabled,
    'provider', a.provider, 'model', a.model,
    'maxOutputTokens', a.max_output_tokens, 'timeoutMs', a.timeout_ms,
    'maxCostUsd', a.max_cost_usd
  ) order by a.agent_code), '[]'::jsonb)
  from hml.agent_registry a
$$;
revoke all on function public.hml_agent_catalog_service() from public, anon, authenticated;
grant execute on function public.hml_agent_catalog_service() to service_role;
