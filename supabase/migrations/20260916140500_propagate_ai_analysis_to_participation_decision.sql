-- Homologação profunda do fluxo de Oportunidades.
-- Uma análise detalhada concluída deve alimentar imediatamente a decisão
-- de participação e o estado do matching. Sem esta propagação o fluxo
-- permanecia em queued_for_analysis e nunca poderia chegar ao readiness/CFP.

create or replace function private.complete_opportunity_ai_analysis_job(
  p_queue_id uuid,
  p_worker_id text,
  p_recommendation text,
  p_gate_results jsonb,
  p_evidence jsonb,
  p_analysis_payload jsonb,
  p_model_provider text,
  p_model_name text,
  p_provider_request_id text default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  q public.opportunity_ai_analysis_queue%rowtype;
  result_id uuid;
  rec text;
begin
  if nullif(btrim(p_worker_id),'') is null then
    raise exception 'worker_id_required';
  end if;

  rec=lower(p_recommendation);
  if rec not in ('aprovado','aprovado_com_ressalva','nao_aprovado','revisao_manual') then
    raise exception 'invalid_recommendation';
  end if;

  select * into q
  from public.opportunity_ai_analysis_queue
  where id=p_queue_id
  for update;

  if not found then raise exception 'queue_not_found'; end if;
  if q.status<>'processing' or q.locked_by is distinct from p_worker_id then
    raise exception 'queue_not_owned_by_worker';
  end if;

  insert into public.opportunity_ai_analysis_results(
    queue_id,client_id,capability_id,opportunity_id,recommendation,
    gate_results,evidence,analysis_payload,prompt_master_version,
    profile_version,playbook_version,model_provider,model_name
  ) values(
    q.id,q.client_id,q.capability_id,q.opportunity_id,rec,
    coalesce(p_gate_results,'{}'::jsonb),coalesce(p_evidence,'[]'::jsonb),
    coalesce(p_analysis_payload,'{}'::jsonb),q.prompt_master_version,
    q.profile_version,q.playbook_version,p_model_provider,p_model_name
  )
  on conflict(queue_id) do nothing
  returning id into result_id;

  if result_id is null then raise exception 'queue_result_already_exists'; end if;

  update public.opportunity_ai_analysis_queue
  set status='completed',completed_at=now(),model_provider=p_model_provider,
      model_name=p_model_name,
      provider_request_id=coalesce(p_provider_request_id,provider_request_id),
      locked_at=null,locked_by=null,heartbeat_at=null,next_attempt_at=null,
      error_detail=null,updated_at=now()
  where id=q.id;

  perform public.evaluate_opportunity_participation(result_id);
  return result_id;
end
$$;
