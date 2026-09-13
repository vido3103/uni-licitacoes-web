create table if not exists public.client_opportunity_item_selections (
  client_id uuid not null references public.clients(id) on delete cascade,
  opportunity_id uuid not null references public.public_opportunities(id) on delete cascade,
  item_id uuid not null references public.public_opportunity_items(id) on delete cascade,
  selected boolean not null default true,
  selected_by uuid null references auth.users(id),
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_id,item_id)
);

create index if not exists idx_client_opp_item_selection_opp on public.client_opportunity_item_selections(client_id,opportunity_id,selected);

alter table public.client_opportunity_item_selections enable row level security;

drop policy if exists client_opportunity_item_selections_select on public.client_opportunity_item_selections;
create policy client_opportunity_item_selections_select on public.client_opportunity_item_selections
for select to authenticated
using (private.is_client_member(client_id));

drop policy if exists client_opportunity_item_selections_insert on public.client_opportunity_item_selections;
create policy client_opportunity_item_selections_insert on public.client_opportunity_item_selections
for insert to authenticated
with check (private.is_client_member(client_id) and selected_by = auth.uid());

drop policy if exists client_opportunity_item_selections_update on public.client_opportunity_item_selections;
create policy client_opportunity_item_selections_update on public.client_opportunity_item_selections
for update to authenticated
using (private.is_client_member(client_id))
with check (private.is_client_member(client_id) and selected_by = auth.uid());

grant select,insert,update on public.client_opportunity_item_selections to authenticated;
