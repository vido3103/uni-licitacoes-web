create or replace function public.claim_opportunity_ai_analysis_job_service(p_queue_id uuid,p_client_id uuid,p_worker_id text)
returns setof public.opportunity_ai_analysis_queue
language sql security definer set search_path=''
as $$ select * from private.claim_opportunity_ai_analysis_job_for_client(p_queue_id,p_client_id,p_worker_id); $$;

create or replace function public.complete_opportunity_ai_analysis_job_service(p_queue_id uuid,p_worker_id text,p_recommendation text,p_gate_results jsonb,p_evidence jsonb,p_analysis_payload jsonb,p_model_provider text,p_model_name text,p_provider_request_id text)
returns uuid language sql security definer set search_path=''
as $$ select private.complete_opportunity_ai_analysis_job(p_queue_id,p_worker_id,p_recommendation,p_gate_results,p_evidence,p_analysis_payload,p_model_provider,p_model_name,p_provider_request_id); $$;

create or replace function public.fail_opportunity_ai_analysis_job_service(p_queue_id uuid,p_worker_id text,p_error text,p_retry_delay_seconds integer)
returns text language sql security definer set search_path=''
as $$ select private.fail_opportunity_ai_analysis_job(p_queue_id,p_worker_id,p_error,p_retry_delay_seconds); $$;

revoke all on function public.claim_opportunity_ai_analysis_job_service(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.complete_opportunity_ai_analysis_job_service(uuid,text,text,jsonb,jsonb,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.fail_opportunity_ai_analysis_job_service(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.claim_opportunity_ai_analysis_job_service(uuid,uuid,text) to service_role;
grant execute on function public.complete_opportunity_ai_analysis_job_service(uuid,text,text,jsonb,jsonb,jsonb,text,text,text) to service_role;
grant execute on function public.fail_opportunity_ai_analysis_job_service(uuid,text,text,integer) to service_role;
