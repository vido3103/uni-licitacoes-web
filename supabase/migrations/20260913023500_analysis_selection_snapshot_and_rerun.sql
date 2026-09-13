create or replace function public.enqueue_opportunity_ai_analysis(
  p_capability_id uuid,
  p_opportunity_id uuid,
  p_prompt_master_version text default 'Prompt Mestre v1.17'::text
)
returns uuid
language plpgsql
set search_path to 'public','private'
as $function$
declare
  cid uuid;
  tr public.opportunity_triage_runs%rowtype;
  qid uuid;
  pver text;
  pbver text;
  v_selected jsonb;
  v_snapshot jsonb;
begin
  select c.client_id into cid from public.client_capabilities c where c.id=p_capability_id;
  if cid is null or not private.is_client_member(cid) then raise sqlstate 'PT403' using message='Acesso negado à capacidade informada.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_capability_id::text||':'||p_opportunity_id::text,0));
  select t.* into tr from public.opportunity_triage_runs t where t.client_id=cid and t.capability_id=p_capability_id and t.opportunity_id=p_opportunity_id order by t.run_sequence desc limit 1 for update;
  if tr.id is null or not tr.ai_required or tr.result<>'queued_for_ai' then raise sqlstate 'PT409' using message='A oportunidade não está aprovada pela triagem determinística vigente.'; end if;
  if not exists(select 1 from public.client_opportunity_matches m where m.client_id=cid and m.capability_id=p_capability_id and m.opportunity_id=p_opportunity_id and m.match_status='queued_for_analysis') then raise sqlstate 'PT409' using message='A compatibilidade vigente não libera a Análise Detalhada.'; end if;
  if not exists(select 1 from public.opportunity_documents d where d.client_id=cid and d.opportunity_id=p_opportunity_id and d.validation_status='available') then raise sqlstate 'PT409' using message='Nenhum documento disponível foi confirmado para esta oportunidade.'; end if;
  if exists(select 1 from public.public_opportunity_items i where i.opportunity_id=p_opportunity_id) and not exists(select 1 from public.client_opportunity_item_selections s where s.client_id=cid and s.opportunity_id=p_opportunity_id and s.selected=true) then raise sqlstate 'PT409' using message='Selecione ao menos um item antes de iniciar a Análise Detalhada.'; end if;
  select coalesce(jsonb_agg(s.item_id::text order by s.item_id::text),'[]'::jsonb) into v_selected from public.client_opportunity_item_selections s where s.client_id=cid and s.opportunity_id=p_opportunity_id and s.selected=true;
  v_snapshot:=jsonb_build_object('selection_snapshot',jsonb_build_object('selected_item_ids',coalesce(v_selected,'[]'::jsonb),'captured_at',now()));
  select 'v'||cp.version_no::text into pver from public.client_profiles cp where cp.client_id=cid and cp.is_current order by cp.created_at desc limit 1;
  select 'v'||p.version_no::text into pbver from public.playbooks p where p.client_id=cid and p.is_current order by p.created_at desc limit 1;
  insert into public.opportunity_ai_analysis_queue(client_id,capability_id,opportunity_id,triage_run_id,prompt_master_version,profile_version,playbook_version,context_snapshot)
  values(cid,p_capability_id,p_opportunity_id,tr.id,p_prompt_master_version,pver,pbver,v_snapshot)
  on conflict(client_id,capability_id,opportunity_id,triage_run_id) do update set
    prompt_master_version=excluded.prompt_master_version,profile_version=excluded.profile_version,playbook_version=excluded.playbook_version,context_snapshot=excluded.context_snapshot,
    status=case when public.opportunity_ai_analysis_queue.status in ('failed','retry_wait','completed') then 'pending' else public.opportunity_ai_analysis_queue.status end,
    error_detail=case when public.opportunity_ai_analysis_queue.status in ('failed','retry_wait','completed') then null else public.opportunity_ai_analysis_queue.error_detail end,
    next_attempt_at=case when public.opportunity_ai_analysis_queue.status in ('failed','retry_wait','completed') then null else public.opportunity_ai_analysis_queue.next_attempt_at end,
    completed_at=case when public.opportunity_ai_analysis_queue.status in ('failed','retry_wait','completed') then null else public.opportunity_ai_analysis_queue.completed_at end,
    started_at=case when public.opportunity_ai_analysis_queue.status in ('failed','retry_wait','completed') then null else public.opportunity_ai_analysis_queue.started_at end,
    locked_at=case when public.opportunity_ai_analysis_queue.status in ('failed','retry_wait','completed') then null else public.opportunity_ai_analysis_queue.locked_at end,
    locked_by=case when public.opportunity_ai_analysis_queue.status in ('failed','retry_wait','completed') then null else public.opportunity_ai_analysis_queue.locked_by end,
    heartbeat_at=case when public.opportunity_ai_analysis_queue.status in ('failed','retry_wait','completed') then null else public.opportunity_ai_analysis_queue.heartbeat_at end,
    updated_at=now()
  returning id into qid;
  return qid;
end;
$function$;
revoke all on function public.enqueue_opportunity_ai_analysis(uuid,uuid,text) from public,anon;
grant execute on function public.enqueue_opportunity_ai_analysis(uuid,uuid,text) to authenticated;
