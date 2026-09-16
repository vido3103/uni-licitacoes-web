-- Owner / Clientes: keep habilitation, client lifecycle and Radar participation consistent.
-- Production migration applied during deep homologation on 2026-09-16.

create or replace function private.set_client_habilitation_status_internal(p_client_id uuid, p_habilitado boolean, p_notes text default null::text)
returns public.client_habilitation_reviews
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row public.client_habilitation_reviews;
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not private.is_platform_owner() then
    raise sqlstate 'PT403' using message='Somente o Owner pode validar a habilitação do cliente.';
  end if;
  if not exists (select 1 from public.clients c where c.id=p_client_id and c.status<>'inactive') then
    raise sqlstate 'PT404' using message='Cliente ativo não localizado.';
  end if;

  insert into public.client_habilitation_reviews(client_id,habilitado,notes,validated_by,validated_at,updated_at)
  values(p_client_id,coalesce(p_habilitado,false),nullif(trim(coalesce(p_notes,'')),''),case when p_habilitado then v_uid end,case when p_habilitado then now() end,now())
  on conflict(client_id) do update set habilitado=excluded.habilitado,notes=excluded.notes,validated_by=excluded.validated_by,validated_at=excluded.validated_at,updated_at=now()
  returning * into v_row;

  if coalesce(p_habilitado,false) then
    update public.clients set status='ready',updated_at=now() where id=p_client_id and status<>'inactive';
    update public.client_capabilities set status='habilitada',updated_at=now() where client_id=p_client_id and selected=true;
    insert into public.client_radar_enrollments(client_id,capability_id,monitoring_enabled,participation_enabled,incremental_sync_enabled,updated_at)
    select p_client_id,c.id,true,true,true,now() from public.client_capabilities c where c.client_id=p_client_id and c.selected=true
    on conflict(client_id,capability_id) do update set monitoring_enabled=true,participation_enabled=true,incremental_sync_enabled=true,updated_at=now();

    insert into public.client_sicaf_status(client_id,sicaf_level_id,status,observations,last_checked_at,updated_at,evidence_document_id)
    select p_client_id,l.id,'atende','Aprovado automaticamente após habilitação geral do cliente pelo Owner.',now(),now(),null from public.sicaf_levels l
    on conflict(client_id,sicaf_level_id) do update set status='atende',observations='Aprovado automaticamente após habilitação geral do cliente pelo Owner.',last_checked_at=now(),updated_at=now(),evidence_document_id=null;

    insert into public.audit_events(client_id,actor_user_id,event_type,entity_type,entity_id,after_data)
    values(p_client_id,v_uid,'client_habilitation_finalized','client_habilitation',p_client_id::text,jsonb_build_object('habilitado',true,'client_status','ready','selected_capabilities_status','habilitada','radar_participation_enabled',true));
  else
    update public.clients set status='onboarding',updated_at=now() where id=p_client_id and status<>'inactive';
    update public.client_capabilities set status='em_preparacao',updated_at=now() where client_id=p_client_id and selected=true;
    update public.client_radar_enrollments set monitoring_enabled=false,participation_enabled=false,incremental_sync_enabled=false,updated_at=now() where client_id=p_client_id;

    insert into public.audit_events(client_id,actor_user_id,event_type,entity_type,entity_id,after_data)
    values(p_client_id,v_uid,'client_habilitation_revoked','client_habilitation',p_client_id::text,jsonb_build_object('habilitado',false,'client_status','onboarding','selected_capabilities_status','em_preparacao','radar_participation_enabled',false,'radar_monitoring_enabled',false));
  end if;
  return v_row;
end;$function$;

revoke execute on function private.set_client_habilitation_status_internal(uuid,boolean,text) from public, anon, authenticated;
grant execute on function private.set_client_habilitation_status_internal(uuid,boolean,text) to service_role;

create or replace function public.set_client_habilitation_status(p_client_id uuid, p_habilitado boolean, p_notes text default null::text)
returns public.client_habilitation_reviews
language sql
security definer
set search_path to ''
as $function$
  select private.set_client_habilitation_status_internal(p_client_id,p_habilitado,p_notes);
$function$;

revoke execute on function public.set_client_habilitation_status(uuid,boolean,text) from public, anon;
grant execute on function public.set_client_habilitation_status(uuid,boolean,text) to authenticated, service_role;
