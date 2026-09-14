revoke execute on function public.audit_client_settings_change() from public, anon, authenticated;
grant execute on function public.audit_client_settings_change() to service_role;

drop policy if exists client_settings_select on public.client_settings;
create policy client_settings_select on public.client_settings
for select to authenticated
using (
  exists (select 1 from public.client_members m where m.client_id = client_settings.client_id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.platform_user_roles r where r.user_id = (select auth.uid()) and r.role = 'platform_owner' and r.active = true)
);

drop policy if exists client_settings_insert on public.client_settings;
create policy client_settings_insert on public.client_settings
for insert to authenticated
with check (
  exists (select 1 from public.client_members m where m.client_id = client_settings.client_id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.platform_user_roles r where r.user_id = (select auth.uid()) and r.role = 'platform_owner' and r.active = true)
);

drop policy if exists client_settings_update on public.client_settings;
create policy client_settings_update on public.client_settings
for update to authenticated
using (
  exists (select 1 from public.client_members m where m.client_id = client_settings.client_id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.platform_user_roles r where r.user_id = (select auth.uid()) and r.role = 'platform_owner' and r.active = true)
)
with check (
  exists (select 1 from public.client_members m where m.client_id = client_settings.client_id and m.user_id = (select auth.uid()))
  or exists (select 1 from public.platform_user_roles r where r.user_id = (select auth.uid()) and r.role = 'platform_owner' and r.active = true)
);
