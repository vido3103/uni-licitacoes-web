create index if not exists idx_client_opp_item_sel_item_id on public.client_opportunity_item_selections(item_id);
create index if not exists idx_client_opp_item_sel_opportunity_id on public.client_opportunity_item_selections(opportunity_id);
create index if not exists idx_client_opp_item_sel_selected_by on public.client_opportunity_item_selections(selected_by);

drop policy if exists client_opportunity_item_selections_insert on public.client_opportunity_item_selections;
create policy client_opportunity_item_selections_insert on public.client_opportunity_item_selections
for insert to authenticated
with check (private.is_client_member(client_id) and selected_by=(select auth.uid()));

drop policy if exists client_opportunity_item_selections_update on public.client_opportunity_item_selections;
create policy client_opportunity_item_selections_update on public.client_opportunity_item_selections
for update to authenticated
using (private.is_client_member(client_id))
with check (private.is_client_member(client_id) and selected_by=(select auth.uid()));
