-- Radar blindagem: pesquisa oficial paginada e fila de análise idempotente.

alter table public.opportunity_triage_runs
  add column if not exists run_sequence bigint generated always as identity;

create unique index if not exists opportunity_triage_runs_run_sequence_key
  on public.opportunity_triage_runs(run_sequence);

create or replace function public.search_radar_opportunities(
  p_client_id uuid,
  p_query text default null,
  p_process_number text default null,
  p_buyer_name text default null,
  p_city text default null,
  p_state text default null,
  p_source_code text default null,
  p_lifecycle text default null,
  p_participation_allowed boolean default null,
  p_min_value numeric default null,
  p_max_value numeric default null,
  p_publication_start date default null,
  p_publication_end date default null,
  p_modality_code integer default null,
  p_uasg text default null,
  p_agency_code integer default null,
  p_agency_cnpj text default null,
  p_ibge_code integer default null,
  p_pncp_updated_after timestamptz default null,
  p_legal_basis_code integer default null,
  p_excluded boolean default false,
  p_page integer default 1,
  p_page_size integer default 50
)
returns table (
  opportunity_id uuid,
  capability_id uuid,
  source_code text,
  source_name text,
  process_number text,
  title text,
  object_text text,
  buyer_name text,
  city text,
  state text,
  modality text,
  publication_date date,
  proposal_deadline timestamptz,
  estimated_value numeric,
  currency text,
  source_url text,
  lifecycle text,
  match_status text,
  deterministic_score numeric,
  participation_allowed boolean,
  official_modality_code integer,
  uasg text,
  agency_code integer,
  agency_cnpj text,
  ibge_code integer,
  pncp_updated_at timestamptz,
  legal_basis_code integer,
  excluded boolean,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
begin
  if (select auth.uid()) is null or not private.is_client_member(p_client_id) then
    raise sqlstate 'PT403' using message = 'Acesso negado ao ambiente informado.';
  end if;

  if p_publication_start is not null and p_publication_end is not null
     and p_publication_start > p_publication_end then
    raise sqlstate 'PT400' using message = 'A data inicial de publicação deve ser anterior à data final.';
  end if;

  if p_min_value is not null and p_max_value is not null and p_min_value > p_max_value then
    raise sqlstate 'PT400' using message = 'O valor mínimo deve ser menor ou igual ao valor máximo.';
  end if;

  return query
  with base as (
    select
      o.id as opportunity_id,
      o.publication_date,
      o.proposal_deadline
    from public.public_opportunities o
    join public.radar_sources source on source.id = o.source_id
    where source.active
      and (p_query is null or concat_ws(' ', o.title, o.object_text, o.process_number, o.buyer_name) ilike '%' || trim(p_query) || '%')
      and (p_process_number is null or o.process_number ilike '%' || trim(p_process_number) || '%')
      and (p_buyer_name is null or o.buyer_name ilike '%' || trim(p_buyer_name) || '%')
      and (p_city is null or o.city ilike '%' || trim(p_city) || '%')
      and (p_state is null or upper(o.state) = upper(trim(p_state)))
      and (p_source_code is null or source.code = p_source_code)
      and (p_lifecycle is null or public.opportunity_lifecycle(o.proposal_deadline, now()) = p_lifecycle)
      and (
        p_participation_allowed is null
        or (
          p_participation_allowed = true
          and exists (
            select 1 from public.client_opportunity_matches m
            where m.client_id = p_client_id and m.opportunity_id = o.id and m.participation_allowed
          )
        )
        or (
          p_participation_allowed = false
          and not exists (
            select 1 from public.client_opportunity_matches m
            where m.client_id = p_client_id and m.opportunity_id = o.id and m.participation_allowed
          )
        )
      )
      and (p_min_value is null or o.estimated_value >= p_min_value)
      and (p_max_value is null or o.estimated_value <= p_max_value)
      and (p_publication_start is null or o.publication_date >= p_publication_start)
      and (p_publication_end is null or o.publication_date <= p_publication_end)
      and (p_modality_code is null or nullif(o.source_payload ->> 'codigoModalidade', '')::integer = p_modality_code)
      and (p_uasg is null or o.source_payload ->> 'unidadeOrgaoCodigoUnidade' = trim(p_uasg))
      and (p_agency_code is null or nullif(o.source_payload ->> 'codigoOrgao', '')::integer = p_agency_code)
      and (p_agency_cnpj is null or regexp_replace(o.source_payload ->> 'orgaoEntidadeCnpj', '\D', '', 'g') = regexp_replace(p_agency_cnpj, '\D', '', 'g'))
      and (p_ibge_code is null or nullif(o.source_payload ->> 'unidadeOrgaoCodigoIbge', '')::integer = p_ibge_code)
      and (p_pncp_updated_after is null or nullif(o.source_payload ->> 'dataAtualizacaoPncp', '')::timestamptz >= p_pncp_updated_after)
      and (p_legal_basis_code is null or nullif(o.source_payload ->> 'amparoLegalCodigoPncp', '')::integer = p_legal_basis_code)
      and (p_excluded is null or coalesce(nullif(o.source_payload ->> 'contratacaoExcluida', '')::boolean, false) = p_excluded)
  ), counted as (
    select base.*, count(*) over() as total_count
    from base
  ), paged as (
    select counted.*
    from counted
    order by publication_date desc nulls last, proposal_deadline asc nulls last, opportunity_id
    limit v_page_size
    offset (v_page - 1) * v_page_size
  )
  select
    paged.opportunity_id,
    match.capability_id,
    source.code,
    source.name,
    o.process_number,
    o.title,
    o.object_text,
    o.buyer_name,
    o.city,
    o.state,
    o.modality,
    o.publication_date,
    o.proposal_deadline,
    o.estimated_value,
    o.currency,
    o.source_url,
    public.opportunity_lifecycle(o.proposal_deadline, now()),
    match.match_status,
    match.deterministic_score,
    coalesce(match.participation_allowed, false),
    nullif(o.source_payload ->> 'codigoModalidade', '')::integer,
    nullif(o.source_payload ->> 'unidadeOrgaoCodigoUnidade', ''),
    nullif(o.source_payload ->> 'codigoOrgao', '')::integer,
    nullif(o.source_payload ->> 'orgaoEntidadeCnpj', ''),
    nullif(o.source_payload ->> 'unidadeOrgaoCodigoIbge', '')::integer,
    nullif(o.source_payload ->> 'dataAtualizacaoPncp', '')::timestamptz,
    nullif(o.source_payload ->> 'amparoLegalCodigoPncp', '')::integer,
    coalesce(nullif(o.source_payload ->> 'contratacaoExcluida', '')::boolean, false),
    paged.total_count
  from paged
  join public.public_opportunities o on o.id = paged.opportunity_id
  join public.radar_sources source on source.id = o.source_id
  left join lateral (
    select m.capability_id, m.match_status, m.deterministic_score, m.participation_allowed
    from public.client_opportunity_matches m
    where m.client_id = p_client_id and m.opportunity_id = paged.opportunity_id
    order by m.participation_allowed desc, m.updated_at desc
    limit 1
  ) match on true
  order by o.publication_date desc nulls last, o.proposal_deadline asc nulls last, o.id;
end;
$$;

revoke all on function public.search_radar_opportunities(uuid,text,text,text,text,text,text,text,boolean,numeric,numeric,date,date,integer,text,integer,text,integer,timestamptz,integer,boolean,integer,integer) from public;
revoke all on function public.search_radar_opportunities(uuid,text,text,text,text,text,text,text,boolean,numeric,numeric,date,date,integer,text,integer,text,integer,timestamptz,integer,boolean,integer,integer) from anon;
grant execute on function public.search_radar_opportunities(uuid,text,text,text,text,text,text,text,boolean,numeric,numeric,date,date,integer,text,integer,text,integer,timestamptz,integer,boolean,integer,integer) to authenticated;

create or replace function public.enqueue_opportunity_ai_analysis(
  p_capability_id uuid,
  p_opportunity_id uuid,
  p_prompt_master_version text default 'Prompt Mestre v1.17'
)
returns uuid
language plpgsql
set search_path = 'public', 'private'
as $$
declare
  cid uuid;
  tr public.opportunity_triage_runs%rowtype;
  qid uuid;
  pver text;
  pbver text;
begin
  select c.client_id into cid
  from public.client_capabilities c
  where c.id = p_capability_id;

  if cid is null or not private.is_client_member(cid) then
    raise sqlstate 'PT403' using message = 'Acesso negado à capacidade informada.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_capability_id::text || ':' || p_opportunity_id::text, 0));

  select t.* into tr
  from public.opportunity_triage_runs t
  where t.client_id = cid
    and t.capability_id = p_capability_id
    and t.opportunity_id = p_opportunity_id
  order by t.run_sequence desc
  limit 1
  for update;

  if tr.id is null or not tr.ai_required or tr.result <> 'queued_for_ai' then
    raise sqlstate 'PT409' using message = 'A oportunidade não está aprovada pela triagem determinística vigente.';
  end if;

  if not exists (
    select 1
    from public.client_opportunity_matches m
    where m.client_id = cid
      and m.capability_id = p_capability_id
      and m.opportunity_id = p_opportunity_id
      and m.match_status = 'queued_for_analysis'
  ) then
    raise sqlstate 'PT409' using message = 'A compatibilidade vigente não libera a Análise Detalhada.';
  end if;

  if not exists (
    select 1
    from public.opportunity_documents d
    where d.client_id = cid
      and d.opportunity_id = p_opportunity_id
      and d.validation_status = 'available'
  ) then
    raise sqlstate 'PT409' using message = 'Nenhum documento disponível foi confirmado para esta oportunidade.';
  end if;

  select 'v' || cp.version_no::text into pver
  from public.client_profiles cp
  where cp.client_id = cid and cp.is_current
  order by cp.created_at desc
  limit 1;

  select 'v' || p.version_no::text into pbver
  from public.playbooks p
  where p.client_id = cid and p.is_current
  order by p.created_at desc
  limit 1;

  insert into public.opportunity_ai_analysis_queue(
    client_id, capability_id, opportunity_id, triage_run_id,
    prompt_master_version, profile_version, playbook_version
  ) values (
    cid, p_capability_id, p_opportunity_id, tr.id,
    p_prompt_master_version, pver, pbver
  )
  on conflict(client_id, capability_id, opportunity_id, triage_run_id)
  do update set
    prompt_master_version = excluded.prompt_master_version,
    profile_version = excluded.profile_version,
    playbook_version = excluded.playbook_version,
    status = case
      when public.opportunity_ai_analysis_queue.status in ('failed', 'retry_wait') then 'pending'
      else public.opportunity_ai_analysis_queue.status
    end,
    error_detail = case
      when public.opportunity_ai_analysis_queue.status in ('failed', 'retry_wait') then null
      else public.opportunity_ai_analysis_queue.error_detail
    end,
    next_attempt_at = case
      when public.opportunity_ai_analysis_queue.status in ('failed', 'retry_wait') then null
      else public.opportunity_ai_analysis_queue.next_attempt_at
    end,
    updated_at = now()
  returning id into qid;

  return qid;
end;
$$;

revoke all on function public.enqueue_opportunity_ai_analysis(uuid,uuid,text) from public;
grant execute on function public.enqueue_opportunity_ai_analysis(uuid,uuid,text) to authenticated;
