create or replace function private.set_client_habilitation_status_internal(
  p_client_id uuid,
  p_habilitado boolean,
  p_notes text default null
)
returns public.client_habilitation_reviews
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_row public.client_habilitation_reviews;
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not private.is_platform_owner() then
    raise sqlstate 'PT403' using message='Somente o Owner pode validar a habilitação do cliente.';
  end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id) then
    raise sqlstate 'PT404' using message='Cliente não localizado.';
  end if;

  insert into public.client_habilitation_reviews(
    client_id, habilitado, notes, validated_by, validated_at, updated_at
  )
  values (
    p_client_id,
    coalesce(p_habilitado,false),
    nullif(trim(coalesce(p_notes,'')),''),
    case when p_habilitado then v_uid else null end,
    case when p_habilitado then now() else null end,
    now()
  )
  on conflict (client_id) do update set
    habilitado = excluded.habilitado,
    notes = excluded.notes,
    validated_by = excluded.validated_by,
    validated_at = excluded.validated_at,
    updated_at = now()
  returning * into v_row;

  if coalesce(p_habilitado,false) then
    insert into public.client_sicaf_status(
      client_id,
      sicaf_level_id,
      status,
      observations,
      last_checked_at,
      updated_at,
      evidence_document_id
    )
    select
      p_client_id,
      l.id,
      'atende',
      'Aprovado automaticamente após habilitação geral do cliente pelo Owner.',
      now(),
      now(),
      null
    from public.sicaf_levels l
    on conflict (client_id, sicaf_level_id) do update set
      status = 'atende',
      observations = 'Aprovado automaticamente após habilitação geral do cliente pelo Owner.',
      last_checked_at = now(),
      updated_at = now(),
      evidence_document_id = null;

    insert into public.audit_events(
      client_id,
      actor_user_id,
      event_type,
      entity_type,
      entity_id,
      after_data
    )
    values (
      p_client_id,
      v_uid,
      'client_habilitation_approved_all_sicaf_levels',
      'client_habilitation',
      p_client_id::text,
      jsonb_build_object(
        'habilitado', true,
        'sicaf_levels_status', 'atende',
        'sicaf_levels_total', (select count(*) from public.sicaf_levels)
      )
    );
  end if;

  return v_row;
end;
$$;

revoke all on function private.set_client_habilitation_status_internal(uuid,boolean,text) from public, anon, authenticated;
grant execute on function private.set_client_habilitation_status_internal(uuid,boolean,text) to service_role;

insert into public.client_sicaf_status(
  client_id,
  sicaf_level_id,
  status,
  observations,
  last_checked_at,
  updated_at,
  evidence_document_id
)
select
  r.client_id,
  l.id,
  'atende',
  'Aprovado automaticamente após habilitação geral do cliente pelo Owner.',
  now(),
  now(),
  null
from public.client_habilitation_reviews r
cross join public.sicaf_levels l
where r.habilitado is true
on conflict (client_id, sicaf_level_id) do update set
  status = 'atende',
  observations = 'Aprovado automaticamente após habilitação geral do cliente pelo Owner.',
  last_checked_at = now(),
  updated_at = now(),
  evidence_document_id = null;