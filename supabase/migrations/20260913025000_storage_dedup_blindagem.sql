alter table public.client_documents add column if not exists content_sha256 text;
create index if not exists idx_client_documents_sha256 on public.client_documents(client_id,content_sha256) where content_sha256 is not null;

create table if not exists private.storage_maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  status text not null default 'approved' check (status in ('approved','running','completed','failed')),
  expires_at timestamptz not null default (now()+interval '10 minutes'),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb not null default '{}'::jsonb
);
revoke all on private.storage_maintenance_requests from public,anon,authenticated;
grant select,update on private.storage_maintenance_requests to service_role;

create or replace function private.claim_storage_maintenance_request(p_id uuid,p_action text)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_count int;begin
 update private.storage_maintenance_requests set status='running',started_at=now()
 where id=p_id and action=p_action and status='approved' and expires_at>now();
 get diagnostics v_count=row_count; return v_count=1;
end;$function$;

create or replace function private.complete_storage_maintenance_request(p_id uuid,p_status text,p_result jsonb)
returns void language plpgsql security definer set search_path=''
as $function$ begin
 if p_status not in ('completed','failed') then raise exception 'invalid status'; end if;
 update private.storage_maintenance_requests set status=p_status,completed_at=now(),result=coalesce(p_result,'{}'::jsonb)
 where id=p_id and status='running';
end;$function$;

create or replace function public.claim_storage_maintenance_request_service(p_id uuid,p_action text)
returns boolean language sql security definer set search_path=''
as $$ select private.claim_storage_maintenance_request(p_id,p_action); $$;
create or replace function public.complete_storage_maintenance_request_service(p_id uuid,p_status text,p_result jsonb)
returns void language sql security definer set search_path=''
as $$ select private.complete_storage_maintenance_request(p_id,p_status,p_result); $$;

revoke all on function private.claim_storage_maintenance_request(uuid,text) from public,anon,authenticated;
revoke all on function private.complete_storage_maintenance_request(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.claim_storage_maintenance_request_service(uuid,text) from public,anon,authenticated;
revoke all on function public.complete_storage_maintenance_request_service(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.claim_storage_maintenance_request(uuid,text) to service_role;
grant execute on function private.complete_storage_maintenance_request(uuid,text,jsonb) to service_role;
grant execute on function public.claim_storage_maintenance_request_service(uuid,text) to service_role;
grant execute on function public.complete_storage_maintenance_request_service(uuid,text,jsonb) to service_role;
