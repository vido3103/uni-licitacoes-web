-- Consolidated, idempotent hardening for the simplified Habilitação flow.

create table if not exists public.client_habilitation_reviews (
  client_id uuid primary key references public.clients(id) on delete cascade,
  habilitado boolean not null default false,
  notes text,
  validated_by uuid references auth.users(id),
  validated_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.client_habilitation_reviews enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policy
    where polrelid='public.client_habilitation_reviews'::regclass
      and polname='client_habilitation_reviews_select'
  ) then
    create policy client_habilitation_reviews_select
      on public.client_habilitation_reviews
      for select to authenticated
      using (private.is_platform_owner() or private.is_client_member(client_id));
  end if;
end $$;

create index if not exists idx_client_habilitation_reviews_validated_by on public.client_habilitation_reviews(validated_by);
create index if not exists idx_company_access_requests_client_id on public.company_access_requests(client_id);
create index if not exists idx_company_access_requests_reviewed_by on public.company_access_requests(reviewed_by);
create index if not exists idx_company_access_requests_user_id on public.company_access_requests(user_id);

create or replace function public.set_client_habilitation_status(
  p_client_id uuid,
  p_habilitado boolean,
  p_notes text default null
)
returns public.client_habilitation_reviews
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row public.client_habilitation_reviews;
begin
  if (select auth.uid()) is null or not private.is_platform_owner() then
    raise sqlstate 'PT403' using message='Somente o Owner pode validar a habilitação do cliente.';
  end if;
  if not exists (select 1 from public.clients c where c.id=p_client_id) then
    raise sqlstate 'PT404' using message='Cliente não localizado.';
  end if;
  insert into public.client_habilitation_reviews(client_id,habilitado,notes,validated_by,validated_at,updated_at)
  values (
    p_client_id,
    coalesce(p_habilitado,false),
    nullif(trim(coalesce(p_notes,'')),''),
    case when p_habilitado then (select auth.uid()) else null end,
    case when p_habilitado then now() else null end,
    now()
  )
  on conflict (client_id) do update set
    habilitado=excluded.habilitado,
    notes=excluded.notes,
    validated_by=excluded.validated_by,
    validated_at=excluded.validated_at,
    updated_at=now()
  returning * into v_row;
  return v_row;
end;
$function$;

revoke all on function public.set_client_habilitation_status(uuid, boolean, text) from public, anon;
grant execute on function public.set_client_habilitation_status(uuid, boolean, text) to authenticated;

revoke all on function public.sync_sicaf_from_documents_internal(uuid, uuid) from public, anon, authenticated;
grant execute on function public.sync_sicaf_from_documents_internal(uuid, uuid) to service_role;

create or replace function private.invalidate_client_habilitation_review()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_client_id uuid;
begin
  v_client_id := coalesce(new.client_id, old.client_id);
  update public.client_habilitation_reviews
     set habilitado = false,
         validated_by = null,
         validated_at = null,
         updated_at = now()
   where client_id = v_client_id
     and habilitado = true;
  return coalesce(new, old);
end;
$function$;
revoke all on function private.invalidate_client_habilitation_review() from public, anon, authenticated;

drop trigger if exists trg_client_docs_invalidate_habilitation_insert on public.client_documents;
create trigger trg_client_docs_invalidate_habilitation_insert
after insert on public.client_documents
for each row execute function private.invalidate_client_habilitation_review();

drop trigger if exists trg_client_docs_invalidate_habilitation_delete on public.client_documents;
create trigger trg_client_docs_invalidate_habilitation_delete
after delete on public.client_documents
for each row execute function private.invalidate_client_habilitation_review();

drop trigger if exists trg_client_docs_invalidate_habilitation_update on public.client_documents;
create trigger trg_client_docs_invalidate_habilitation_update
after update of document_type_id, is_current, storage_path, expiry_date on public.client_documents
for each row
when (old.document_type_id is distinct from new.document_type_id
   or old.is_current is distinct from new.is_current
   or old.storage_path is distinct from new.storage_path
   or old.expiry_date is distinct from new.expiry_date)
execute function private.invalidate_client_habilitation_review();

create or replace function private.evaluate_participation_gate(p_client_id uuid, p_capability_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
 v_uid uuid:=auth.uid(); v_owner boolean; v_member boolean; v_cap record; v_habilitado boolean:=false;
 v_blockers jsonb:='[]'::jsonb; v_res jsonb:='[]'::jsonb; v_enroll boolean:=false;
 v_status text; v_checks jsonb; v_id uuid; v_nonblocking int:=0;
begin
 if v_uid is null then raise exception 'unauthorized'; end if;
 select exists(select 1 from public.platform_user_roles r where r.user_id=v_uid and r.role='platform_owner' and r.active) into v_owner;
 select exists(select 1 from public.client_members m where m.user_id=v_uid and m.client_id=p_client_id) into v_member;
 if not (v_owner or v_member) then raise exception 'client_access_required'; end if;
 select c.id,c.selected,c.status,c.client_id into v_cap from public.client_capabilities c where c.id=p_capability_id;
 if v_cap.id is null or v_cap.client_id<>p_client_id then raise exception 'capability_not_found_for_client'; end if;
 select coalesce(h.habilitado,false) into v_habilitado from public.client_habilitation_reviews h where h.client_id=p_client_id;
 if not coalesce(v_habilitado,false) then v_blockers:=v_blockers||jsonb_build_array('cliente_nao_habilitado'); end if;
 if not coalesce(v_cap.selected,false) then v_blockers:=v_blockers||jsonb_build_array('capacidade_nao_selecionada'); end if;
 if v_cap.status::text<>'habilitada' then v_blockers:=v_blockers||jsonb_build_array('capacidade_nao_habilitada'); end if;
 select coalesce(e.participation_enabled,false) into v_enroll from public.client_radar_enrollments e where e.client_id=p_client_id and e.capability_id=p_capability_id limit 1;
 if not coalesce(v_enroll,false) then v_blockers:=v_blockers||jsonb_build_array('participacao_radar_desabilitada'); end if;
 if exists(select 1 from public.client_pending_items p where p.client_id=p_client_id and (p.capability_id is null or p.capability_id=p_capability_id) and p.state not in ('resolvida','cancelada') and p.impact in ('bloqueia_categoria','bloqueia_participacao')) then v_blockers:=v_blockers||jsonb_build_array('pendencia_impeditiva_aberta'); end if;
 select count(*) into v_nonblocking from public.client_pending_items p where p.client_id=p_client_id and (p.capability_id is null or p.capability_id=p_capability_id) and p.state not in ('resolvida','cancelada') and p.impact not in ('bloqueia_categoria','bloqueia_participacao');
 if v_nonblocking>0 then v_res:=v_res||jsonb_build_array(v_nonblocking::text||'_pendencia(s)_nao_impeditiva(s)'); end if;
 v_checks:=jsonb_build_object('client_habilitado',coalesce(v_habilitado,false),'capability_selected',coalesce(v_cap.selected,false),'capability_status',v_cap.status::text,'participation_enabled',coalesce(v_enroll,false),'nonblocking_pending_count',v_nonblocking);
 v_status:=case when jsonb_array_length(v_blockers)>0 then 'nao_aprovado' when jsonb_array_length(v_res)>0 then 'aprovado_com_ressalva' else 'aprovado' end;
 insert into public.participation_gate_evaluations(client_id,capability_id,status,checks,blockers,reservations,evaluated_by) values(p_client_id,p_capability_id,v_status,v_checks,v_blockers,v_res,v_uid) returning id into v_id;
 insert into public.audit_events(client_id,actor_user_id,event_type,entity_type,entity_id,after_data) values(p_client_id,v_uid,'participation_gate_evaluated','participation_gate',v_id::text,jsonb_build_object('capability_id',p_capability_id,'status',v_status,'checks',v_checks,'blockers',v_blockers,'reservations',v_res));
 return jsonb_build_object('id',v_id,'status',v_status,'checks',v_checks,'blockers',v_blockers,'reservations',v_res,'evaluated_at',now());
end
$function$;

create or replace function public.fill_public_opportunity_source_url()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.source_url is null
     and coalesce(new.source_payload->>'orgaoEntidadeCnpj','') <> ''
     and coalesce(new.source_payload->>'anoCompraPncp','') <> ''
     and coalesce(new.source_payload->>'sequencialCompraPncp','') <> '' then
    new.source_url := 'https://pncp.gov.br/app/editais/'
      || regexp_replace(new.source_payload->>'orgaoEntidadeCnpj','\D','','g')
      || '/' || (new.source_payload->>'anoCompraPncp')
      || '/' || (new.source_payload->>'sequencialCompraPncp');
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_fill_public_opportunity_source_url on public.public_opportunities;
create trigger trg_fill_public_opportunity_source_url
before insert or update of source_url, source_payload on public.public_opportunities
for each row execute function public.fill_public_opportunity_source_url();
