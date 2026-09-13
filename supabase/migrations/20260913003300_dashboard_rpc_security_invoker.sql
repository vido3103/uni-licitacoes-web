create or replace function private.get_client_dashboard_backend_internal(p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_uid uuid:=auth.uid();v_allowed boolean;v_result jsonb;
begin
 if v_uid is null then raise exception 'authentication required' using errcode='42501';end if;
 v_allowed:=private.is_client_member(p_client_id);
 if not v_allowed then raise exception 'access denied for client' using errcode='42501';end if;
 select jsonb_build_object(
  'client',(select to_jsonb(c) from(select id,legal_name,display_name,status from public.clients where id=p_client_id)c),
  'summary',coalesce((select to_jsonb(s) from public.client_radar_summary s where s.client_id=p_client_id limit 1),jsonb_build_object('client_id',p_client_id,'live_count',0,'historical_count',0,'unknown_count',0,'released_for_participation_count',0,'live_not_released_count',0)),
  'pending',coalesce((select to_jsonb(p) from public.client_pending_dashboard p where p.client_id=p_client_id limit 1),jsonb_build_object('client_id',p_client_id,'open_pending_count',0,'blocking_pending_count',0,'last_pending_update',null)),
  'opportunities',coalesce((select jsonb_agg(to_jsonb(r) order by r.proposal_deadline nulls last) from(select capability_id,opportunity_id,process_number,title,object_text,buyer_name,city,state,modality,publication_date,proposal_deadline,estimated_value,currency,source_url,lifecycle,match_status,deterministic_score,participation_allowed,method_version,match_updated_at from public.client_radar_dashboard where client_id=p_client_id order by proposal_deadline nulls last limit 100)r),'[]'::jsonb),
  'market',coalesce((select jsonb_agg(to_jsonb(m) order by m.opportunity_count desc) from(select state,city,buyer_name,modality,opportunity_count,distinct_buyer_documents,total_estimated_value,avg_estimated_value,last_publication_date from public.market_demand_12m order by opportunity_count desc limit 25)m),'[]'::jsonb),
  'enrollments',coalesce((select jsonb_agg(to_jsonb(e)) from(select initial_history_months,initial_load_status,last_sync_at,monitoring_enabled,incremental_sync_enabled from public.client_radar_enrollments where client_id=p_client_id)e),'[]'::jsonb)
 ) into v_result;
 return v_result;
end
$function$;

revoke all on function private.get_client_dashboard_backend_internal(uuid) from public, anon;
grant execute on function private.get_client_dashboard_backend_internal(uuid) to authenticated;

create or replace function public.get_client_dashboard_backend(p_client_id uuid)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
 select private.get_client_dashboard_backend_internal(p_client_id);
$function$;

revoke all on function public.get_client_dashboard_backend(uuid) from public, anon;
grant execute on function public.get_client_dashboard_backend(uuid) to authenticated;
