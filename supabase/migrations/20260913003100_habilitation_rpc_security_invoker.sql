create or replace function private.set_client_habilitation_status_internal(
  p_client_id uuid,
  p_habilitado boolean,
  p_notes text default null
)
returns public.client_habilitation_reviews
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row public.client_habilitation_reviews;
begin
  if (select auth.uid()) is null or not private.is_platform_owner() then
    raise sqlstate 'PT403' using message='Somente o Owner pode validar a habilitação do cliente.';
  end if;
  if not exists (select 1 from public.clients c where c.id=p_client_id) then
    raise sqlstate 'PT404' using message='Cliente não localizado.';
  end if;
  insert into public.client_habilitation_reviews(client_id,habilitado,notes,validated_by,validated_at,updated_at)
  values (
    p_client_id,
    coalesce(p_habilitado,false),
    nullif(trim(coalesce(p_notes,'')),''),
    case when p_habilitado then (select auth.uid()) else null end,
    case when p_habilitado then now() else null end,
    now()
  )
  on conflict (client_id) do update set
    habilitado=excluded.habilitado,
    notes=excluded.notes,
    validated_by=excluded.validated_by,
    validated_at=excluded.validated_at,
    updated_at=now()
  returning * into v_row;
  return v_row;
end;
$function$;

revoke all on function private.set_client_habilitation_status_internal(uuid, boolean, text) from public, anon;
grant execute on function private.set_client_habilitation_status_internal(uuid, boolean, text) to authenticated;

create or replace function public.set_client_habilitation_status(
  p_client_id uuid,
  p_habilitado boolean,
  p_notes text default null
)
returns public.client_habilitation_reviews
language sql
security invoker
set search_path to ''
as $function$
  select private.set_client_habilitation_status_internal(p_client_id,p_habilitado,p_notes);
$function$;

revoke all on function public.set_client_habilitation_status(uuid, boolean, text) from public, anon;
grant execute on function public.set_client_habilitation_status(uuid, boolean, text) to authenticated;
