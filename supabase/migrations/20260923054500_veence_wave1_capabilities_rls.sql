-- Veence Onda 1 — Fundação e Segurança
-- Menor privilégio para operações críticas, preservando leitura multi-tenant existente.

create or replace function private.has_client_role(target_client_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_owner()
      or exists (
        select 1
        from public.client_members cm
        where cm.client_id = target_client_id
          and cm.user_id = auth.uid()
          and cm.role = any(allowed_roles)
      );
$$;

revoke all on function private.has_client_role(uuid, text[]) from public;
grant execute on function private.has_client_role(uuid, text[]) to authenticated;

-- Configuração empresarial: somente owner/admin ou Platform Owner.
drop policy if exists client_settings_insert on public.client_settings;
drop policy if exists client_settings_update on public.client_settings;
create policy client_settings_insert
on public.client_settings for insert to authenticated
with check (private.has_client_role(client_id, array['owner','admin']::text[]));
create policy client_settings_update
on public.client_settings for update to authenticated
using (private.has_client_role(client_id, array['owner','admin']::text[]))
with check (private.has_client_role(client_id, array['owner','admin']::text[]));

-- Fornecedores: leitura continua para membros; escrita somente owner/admin.
drop policy if exists client_suppliers_member_insert on public.client_suppliers;
drop policy if exists client_suppliers_member_update on public.client_suppliers;
drop policy if exists client_suppliers_member_delete on public.client_suppliers;
create policy client_suppliers_manage_insert
on public.client_suppliers for insert to authenticated
with check (
  private.has_client_role(client_id, array['owner','admin']::text[])
  and created_by = auth.uid()
);
create policy client_suppliers_manage_update
on public.client_suppliers for update to authenticated
using (private.has_client_role(client_id, array['owner','admin']::text[]))
with check (private.has_client_role(client_id, array['owner','admin']::text[]));
create policy client_suppliers_manage_delete
on public.client_suppliers for delete to authenticated
using (private.has_client_role(client_id, array['owner','admin']::text[]));

-- Solicitação de análise: owner/admin/operacional podem enfileirar.
-- Atualização da fila é responsabilidade do backend/worker (service role).
drop policy if exists ai_queue_insert_member on public.opportunity_ai_analysis_queue;
drop policy if exists ai_queue_update_member on public.opportunity_ai_analysis_queue;
create policy ai_queue_request_insert
on public.opportunity_ai_analysis_queue for insert to authenticated
with check (private.has_client_role(client_id, array['owner','admin','operational']::text[]));

-- Resultado oficial de IA: nunca gravado diretamente por usuário autenticado.
-- Service role continua apta via bypass de RLS.
drop policy if exists ai_results_insert_member on public.opportunity_ai_analysis_results;

-- Resultado econômico: cálculo/registro oficial restrito a owner/admin.
drop policy if exists gate_economic_results_member_insert on public.gate_economic_results;
drop policy if exists gate_economic_results_member_update on public.gate_economic_results;
create policy gate_economic_results_manage_insert
on public.gate_economic_results for insert to authenticated
with check (
  private.has_client_role(client_id, array['owner','admin']::text[])
  and created_by = auth.uid()
);
create policy gate_economic_results_manage_update
on public.gate_economic_results for update to authenticated
using (private.has_client_role(client_id, array['owner','admin']::text[]))
with check (private.has_client_role(client_id, array['owner','admin']::text[]));

-- Decisão de participação: autoridade humana explícita owner/admin.
drop policy if exists participation_decisions_insert_member on public.opportunity_participation_decisions;
drop policy if exists participation_decisions_update_member on public.opportunity_participation_decisions;
create policy participation_decisions_authorized_insert
on public.opportunity_participation_decisions for insert to authenticated
with check (private.has_client_role(client_id, array['owner','admin']::text[]));
create policy participation_decisions_authorized_update
on public.opportunity_participation_decisions for update to authenticated
using (private.has_client_role(client_id, array['owner','admin']::text[]))
with check (private.has_client_role(client_id, array['owner','admin']::text[]));
