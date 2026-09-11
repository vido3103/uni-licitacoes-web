-- I9 — permanent preservation once a participation decision exists
create or replace function private.preserve_participation_documents()
returns trigger language plpgsql set search_path='' as $$
begin
  update public.opportunity_documents
     set preserve_permanently=true, retention_class='permanent', archive_tier='active', archived_at=null
   where client_id=new.client_id and opportunity_id=new.opportunity_id;
  return new;
end $$;
revoke execute on function private.preserve_participation_documents() from public,anon,authenticated;
grant execute on function private.preserve_participation_documents() to service_role;
drop trigger if exists preserve_participation_documents on public.opportunity_participation_decisions;
create trigger preserve_participation_documents after insert on public.opportunity_participation_decisions for each row execute function private.preserve_participation_documents();
update public.opportunity_documents d set preserve_permanently=true,retention_class='permanent',archive_tier='active',archived_at=null where exists(select 1 from public.opportunity_participation_decisions p where p.client_id=d.client_id and p.opportunity_id=d.opportunity_id);
