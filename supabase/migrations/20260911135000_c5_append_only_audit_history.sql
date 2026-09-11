-- C5: align grants with existing RLS and enforce append-only historical ledgers.
revoke update, delete on table public.audit_events from authenticated;
revoke update, delete on table public.ai_executions from authenticated;
revoke update, delete on table public.operational_readiness_history from authenticated;
revoke insert, update, delete on table public.method_versions from authenticated;
revoke all privileges on table public.opportunity_provenance from authenticated;

create or replace function private.prevent_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append_only_relation: % cannot be %', tg_table_name, tg_op using errcode='55000';
end;
$$;

revoke execute on function private.prevent_append_only_mutation() from public, anon, authenticated;
grant execute on function private.prevent_append_only_mutation() to service_role;

drop trigger if exists audit_events_append_only on public.audit_events;
create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function private.prevent_append_only_mutation();

drop trigger if exists ai_executions_append_only on public.ai_executions;
create trigger ai_executions_append_only
before update or delete on public.ai_executions
for each row execute function private.prevent_append_only_mutation();

drop trigger if exists operational_readiness_history_append_only on public.operational_readiness_history;
create trigger operational_readiness_history_append_only
before update or delete on public.operational_readiness_history
for each row execute function private.prevent_append_only_mutation();
