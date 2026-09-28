-- Veence AI queue hardening before paid-provider homologation.
-- Reversible privilege hardening only. Rerun semantics are intentionally handled
-- in a separate migration after validation of the current production RPC flow.

-- Authenticated users consume these tables through RLS-protected reads and
-- approved RPCs. Worker writes remain service_role-only.
revoke insert, update, delete on table public.opportunity_ai_analysis_queue from authenticated;
revoke insert, update, delete on table public.opportunity_ai_analysis_results from authenticated;
revoke insert, update, delete on table public.ai_executions from authenticated;

-- Preserve the minimum direct read surface required by the current UI.
grant select on table public.opportunity_ai_analysis_queue to authenticated;
grant select on table public.opportunity_ai_analysis_results to authenticated;
grant select on table public.ai_executions to authenticated;

-- The user-facing enqueue entrypoint remains the only authenticated mutation path.
revoke all on function public.enqueue_opportunity_ai_analysis(uuid, uuid, text) from public, anon;
grant execute on function public.enqueue_opportunity_ai_analysis(uuid, uuid, text) to authenticated;

-- Worker lifecycle RPCs stay service-role only.
revoke all on function public.claim_opportunity_ai_analysis_job_service(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_opportunity_ai_analysis_job_service(uuid, text, text, jsonb, jsonb, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.fail_opportunity_ai_analysis_job_service(uuid, text, text, integer) from public, anon, authenticated;

grant execute on function public.claim_opportunity_ai_analysis_job_service(uuid, uuid, text) to service_role;
grant execute on function public.complete_opportunity_ai_analysis_job_service(uuid, text, text, jsonb, jsonb, jsonb, text, text, text) to service_role;
grant execute on function public.fail_opportunity_ai_analysis_job_service(uuid, text, text, integer) to service_role;
