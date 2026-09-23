-- Veence Onda 1: evaluate auth.uid() once per statement in insert policies.
alter policy client_suppliers_manage_insert on public.client_suppliers
  with check (private.has_client_role(client_id, ARRAY['owner'::text,'admin'::text]) and created_by = (select auth.uid()));

alter policy gate_economic_results_manage_insert on public.gate_economic_results
  with check (private.has_client_role(client_id, ARRAY['owner'::text,'admin'::text]) and created_by = (select auth.uid()));
