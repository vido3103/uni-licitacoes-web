create or replace function private.set_client_habilitation_status_internal(p_client_id uuid, p_habilitado boolean, p_notes text default null::text)
returns public.client_habilitation_reviews
language plpgsql security definer set search_path=''
as $function$
declare v_row public.client_habilitation_reviews; v_uid uuid:=auth.uid();
begin
 if v_uid is null or not private.is_platform_owner() then raise sqlstate 'PT403' using message='Somente o Owner pode validar a habilitação do cliente.'; end if;
 if not exists(select 1 from public.clients c where c.id=p_client_id and c.status<>'inactive') then raise sqlstate 'PT404' using message='Cliente ativo não localizado.'; end if;
 insert into public.client_habilitation_reviews(client_id,habilitado,notes,validated_by,validated_at,updated_at) values(p_client_id,coalesce(p_habilitado,false),nullif(trim(coalesce(p_notes,'')),''),case when p_habilitado then v_uid end,case when p_habilitado then now() end,now()) on conflict(client_id) do update set habilitado=excluded.habilitado,notes=excluded.notes,validated_by=excluded.validated_by,validated_at=excluded.validated_at,updated_at=now() returning * into v_row;
 if coalesce(p_habilitado,false) then
  update public.clients set status='ready',updated_at=now() where id=p_client_id and status<>'inactive';
  update public.client_capabilities set status='habilitada',updated_at=now() where client_id=p_client_id and selected=true;
  insert into public.client_radar_enrollments(client_id,capability_id,monitoring_enabled,participation_enabled,incremental_sync_enabled,updated_at) select p_client_id,c.id,true,true,true,now() from public.client_capabilities c where c.client_id=p_client_id and c.selected=true on conflict(client_id,capability_id) do update set monitoring_enabled=true,participation_enabled=true,incremental_sync_enabled=true,updated_at=now();
  insert into public.client_sicaf_status(client_id,sicaf_level_id,status,observations,last_checked_at,updated_at,evidence_document_id) select p_client_id,l.id,'atende','Aprovado automaticamente após habilitação geral do cliente pelo Owner.',now(),now(),null from public.sicaf_levels l on conflict(client_id,sicaf_level_id) do update set status='atende',observations='Aprovado automaticamente após habilitação geral do cliente pelo Owner.',last_checked_at=now(),updated_at=now(),evidence_document_id=null;
  insert into public.audit_events(client_id,actor_user_id,event_type,entity_type,entity_id,after_data) values(p_client_id,v_uid,'client_habilitation_finalized','client_habilitation',p_client_id::text,jsonb_build_object('habilitado',true,'client_status','ready','selected_capabilities_status','habilitada','radar_participation_enabled',true));
 else insert into public.audit_events(client_id,actor_user_id,event_type,entity_type,entity_id,after_data) values(p_client_id,v_uid,'client_habilitation_revoked','client_habilitation',p_client_id::text,jsonb_build_object('habilitado',false)); end if;
 return v_row;
end;$function$;

create or replace function private.evaluate_participation_gate(p_client_id uuid,p_capability_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=auth.uid();v_owner boolean;v_member boolean;v_cap record;v_habilitado boolean:=false;v_blockers jsonb:='[]'::jsonb;v_res jsonb:='[]'::jsonb;v_enroll boolean:=false;v_status text;v_checks jsonb;v_id uuid;v_nonblocking int:=0;v_client_status text;
begin
 if v_uid is null then raise exception 'unauthorized'; end if;
 select exists(select 1 from public.platform_user_roles r where r.user_id=v_uid and r.role='platform_owner' and r.active) into v_owner;
 select exists(select 1 from public.client_members m join public.clients c on c.id=m.client_id and c.status<>'inactive' where m.user_id=v_uid and m.client_id=p_client_id) into v_member;
 if not(v_owner or v_member) then raise exception 'client_access_required'; end if;
 select c.status into v_client_status from public.clients c where c.id=p_client_id; if v_client_status is null or v_client_status='inactive' then raise exception 'active_client_required'; end if;
 select c.id,c.selected,c.status,c.client_id into v_cap from public.client_capabilities c where c.id=p_capability_id; if v_cap.id is null or v_cap.client_id<>p_client_id then raise exception 'capability_not_found_for_client'; end if;
 select coalesce(h.habilitado,false) into v_habilitado from public.client_habilitation_reviews h where h.client_id=p_client_id; if not coalesce(v_habilitado,false) then v_blockers:=v_blockers||jsonb_build_array('cliente_nao_habilitado'); end if;
 if not coalesce(v_cap.selected,false) then v_blockers:=v_blockers||jsonb_build_array('capacidade_nao_selecionada'); end if; if v_cap.status::text<>'habilitada' then v_blockers:=v_blockers||jsonb_build_array('capacidade_nao_habilitada'); end if;
 select coalesce(e.participation_enabled,false) into v_enroll from public.client_radar_enrollments e where e.client_id=p_client_id and e.capability_id=p_capability_id limit 1; if not coalesce(v_enroll,false) then v_blockers:=v_blockers||jsonb_build_array('participacao_radar_desabilitada'); end if;
 if exists(select 1 from public.client_pending_items p where p.client_id=p_client_id and(p.capability_id is null or p.capability_id=p_capability_id)and p.state not in('resolvida','cancelada')and p.impact in('bloqueia_categoria','bloqueia_participacao')) then v_blockers:=v_blockers||jsonb_build_array('pendencia_impeditiva_aberta'); end if;
 select count(*) into v_nonblocking from public.client_pending_items p where p.client_id=p_client_id and(p.capability_id is null or p.capability_id=p_capability_id)and p.state not in('resolvida','cancelada')and p.impact not in('bloqueia_categoria','bloqueia_participacao'); if v_nonblocking>0 then v_res:=v_res||jsonb_build_array(v_nonblocking::text||'_pendencia(s)_nao_impeditiva(s)'); end if;
 v_checks:=jsonb_build_object('client_active',true,'client_status',v_client_status,'client_habilitado',coalesce(v_habilitado,false),'capability_selected',coalesce(v_cap.selected,false),'capability_status',v_cap.status::text,'participation_enabled',coalesce(v_enroll,false),'nonblocking_pending_count',v_nonblocking);v_status:=case when jsonb_array_length(v_blockers)>0 then 'nao_aprovado' when jsonb_array_length(v_res)>0 then 'aprovado_com_ressalva' else 'aprovado' end;
 insert into public.participation_gate_evaluations(client_id,capability_id,status,checks,blockers,reservations,evaluated_by) values(p_client_id,p_capability_id,v_status,v_checks,v_blockers,v_res,v_uid) returning id into v_id; insert into public.audit_events(client_id,actor_user_id,event_type,entity_type,entity_id,after_data) values(p_client_id,v_uid,'participation_gate_evaluated','participation_gate',v_id::text,jsonb_build_object('capability_id',p_capability_id,'status',v_status,'checks',v_checks,'blockers',v_blockers,'reservations',v_res));return jsonb_build_object('id',v_id,'status',v_status,'checks',v_checks,'blockers',v_blockers,'reservations',v_res,'evaluated_at',now());
end;$function$;

update public.clients c set status='ready',updated_at=now() where c.status<>'inactive' and exists(select 1 from public.client_habilitation_reviews h where h.client_id=c.id and h.habilitado=true);
update public.client_capabilities cc set status='habilitada',updated_at=now() where cc.selected=true and exists(select 1 from public.client_habilitation_reviews h join public.clients c on c.id=h.client_id and c.status<>'inactive' where h.client_id=cc.client_id and h.habilitado=true);
insert into public.client_radar_enrollments(client_id,capability_id,monitoring_enabled,participation_enabled,incremental_sync_enabled,updated_at) select cc.client_id,cc.id,true,true,true,now() from public.client_capabilities cc join public.client_habilitation_reviews h on h.client_id=cc.client_id and h.habilitado=true join public.clients c on c.id=cc.client_id and c.status<>'inactive' where cc.selected=true on conflict(client_id,capability_id) do update set monitoring_enabled=true,participation_enabled=true,incremental_sync_enabled=true,updated_at=now();