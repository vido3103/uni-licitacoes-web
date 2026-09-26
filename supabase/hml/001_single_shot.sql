-- Apply only to the isolated VEENCE-HML project. Never to production.
create schema if not exists hml;

create table if not exists hml.single_shot (
  singleton boolean primary key default true check (singleton),
  test_id uuid not null unique,
  queue_id uuid not null,
  reserved_at timestamptz not null default now()
);
alter table hml.single_shot enable row level security;

revoke all on schema hml from public, anon, authenticated;
revoke all on hml.single_shot from public, anon, authenticated;

create or replace function hml.reserve_single_shot(p_test_id uuid, p_queue_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare reserved boolean;
begin
  insert into hml.single_shot(singleton, test_id, queue_id)
  values (true, p_test_id, p_queue_id)
  on conflict (singleton) do nothing;
  get diagnostics reserved = row_count;
  return reserved;
end;
$$;

revoke all on function hml.reserve_single_shot(uuid,uuid) from public, anon, authenticated;
grant usage on schema hml to service_role;
grant execute on function hml.reserve_single_shot(uuid,uuid) to service_role;

create or replace function public.hml_reserve_single_shot(p_test_id uuid, p_queue_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select hml.reserve_single_shot(p_test_id, p_queue_id)
$$;
revoke all on function public.hml_reserve_single_shot(uuid,uuid) from public, anon, authenticated;
grant execute on function public.hml_reserve_single_shot(uuid,uuid) to service_role;
