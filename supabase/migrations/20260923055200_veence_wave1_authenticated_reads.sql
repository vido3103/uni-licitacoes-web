-- Veence Onda 1 — elimina policies tenant atribuídas ao papel Postgres public.
-- A expressão de membership já bloqueava anônimos; esta migration explicita menor privilégio.

drop policy if exists client_suppliers_member_select on public.client_suppliers;
create policy client_suppliers_member_select
on public.client_suppliers for select to authenticated
using (private.is_client_member(client_id) or private.is_platform_owner());

drop policy if exists gate_economic_results_member_select on public.gate_economic_results;
create policy gate_economic_results_member_select
on public.gate_economic_results for select to authenticated
using (private.is_client_member(client_id) or private.is_platform_owner());
