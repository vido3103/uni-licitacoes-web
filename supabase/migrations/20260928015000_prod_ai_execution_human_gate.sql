-- PROD: gate humano auditável e fail-closed antes de qualquer claim do worker de IA.
-- Sem autorização RELEASED válida para a fila, claim retorna zero linhas e nenhuma inferência ocorre.

create table if not exists private.ai_execution_authorizations (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.opportunity_ai_analysis_queue(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  authorized_by uuid not null references auth.users(id),
  worker_scope text not null default 'uni-analysis-worker-gemini',
  max_claims integer not null default 1 check (max_claims between 1 and 8),
  consumed_claims integer not null default 0 check (consumed_claims >= 0 and consumed_claims <= max_claims),
  max_cost_usd numeric(10,4) not null check (max_cost_usd > 0 and max_cost_usd <= 5),
  expires_at timestamptz not null,
  status text not null default 'released' check (status in ('released','consumed','revoked','expired')),
  idempotency_key text not null unique,
  reason text,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  revoked_at timestamptz,
  constraint ai_execution_authorizations_expiry_check check (expires_at > created_at)
);

create index if not exists ai_execution_authorizations_claim_idx
  on private.ai_execution_authorizations(queue_id,client_id,status,expires_at)
  where status='released';

revoke all on table private.ai_execution_authorizations from public,anon,authenticated;
grant select,insert,update on table private.ai_execution_authorizations to service_role;

create or replace function public.authorize_ai_execution(
  p_queue_id uuid,
  p_max_claims integer,
  p_max_cost_usd numeric,
  p_valid_for_minutes integer,
  p_idempotency_key text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_client uuid;
  v_existing private.ai_execution_authorizations%rowtype;
  v_id uuid;
begin
  if v_user is null or not private.is_platform_owner() then
    raise sqlstate 'PT403' using message='Somente o platform owner pode liberar execução de IA em produção.';
  end if;
  if p_queue_id is null or coalesce(p_max_claims,0) not between 1 and 8 then
    raise sqlstate 'PT400' using message='Parâmetros de autorização inválidos.';
  end if;
  if coalesce(p_max_cost_usd,0) <= 0 or p_max_cost_usd > 5 then
    raise sqlstate 'PT400' using message='Teto de custo inválido.';
  end if;
  if coalesce(p_valid_for_minutes,0) not between 1 and 60 then
    raise sqlstate 'PT400' using message='Validade deve estar entre 1 e 60 minutos.';
  end if;
  if nullif(btrim(coalesce(p_idempotency_key,'')),'') is null then
    raise sqlstate 'PT400' using message='Chave de idempotência obrigatória.';
  end if;

  select q.client_id into v_client
  from public.opportunity_ai_analysis_queue q
  where q.id=p_queue_id and q.status in ('pending','retry_wait');
  if v_client is null then
    raise sqlstate 'PT409' using message='Fila inexistente ou não liberável no estado atual.';
  end if;

  select * into v_existing
  from private.ai_execution_authorizations a
  where a.idempotency_key=p_idempotency_key;
  if found then
    if v_existing.queue_id<>p_queue_id or v_existing.client_id<>v_client or v_existing.authorized_by<>v_user then
      raise sqlstate 'PT409' using message='Chave de idempotência já usada em outra autorização.';
    end if;
    return v_existing.id;
  end if;

  -- Revoga releases anteriores ainda abertas para a mesma fila; uma fila só pode ter um release ativo.
  update private.ai_execution_authorizations
  set status='revoked', revoked_at=now()
  where queue_id=p_queue_id and client_id=v_client and status='released';

  insert into private.ai_execution_authorizations(
    queue_id,client_id,authorized_by,max_claims,max_cost_usd,expires_at,idempotency_key,reason
  ) values (
    p_queue_id,v_client,v_user,p_max_claims,p_max_cost_usd,now()+make_interval(mins=>p_valid_for_minutes),p_idempotency_key,p_reason
  ) returning id into v_id;

  insert into public.audit_events(client_id,actor_user_id,event_type,entity_type,entity_id,after_data)
  values(v_client,v_user,'ai_execution_authorized','opportunity_ai_analysis_queue',p_queue_id,
    jsonb_build_object('authorization_id',v_id,'max_claims',p_max_claims,'max_cost_usd',p_max_cost_usd,'valid_for_minutes',p_valid_for_minutes,'reason',p_reason));

  return v_id;
end;
$function$;

revoke all on function public.authorize_ai_execution(uuid,integer,numeric,integer,text,text) from public,anon;
grant execute on function public.authorize_ai_execution(uuid,integer,numeric,integer,text,text) to authenticated;

create or replace function public.revoke_ai_execution_authorization(p_authorization_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_client uuid;
begin
  if v_user is null or not private.is_platform_owner() then
    raise sqlstate 'PT403' using message='Somente o platform owner pode revogar autorização de IA em produção.';
  end if;
  update private.ai_execution_authorizations
  set status='revoked',revoked_at=now()
  where id=p_authorization_id and status='released'
  returning client_id into v_client;
  if v_client is null then return false; end if;
  insert into public.audit_events(client_id,actor_user_id,event_type,entity_type,entity_id,after_data)
  values(v_client,v_user,'ai_execution_authorization_revoked','ai_execution_authorization',p_authorization_id,jsonb_build_object('revoked',true));
  return true;
end;
$function$;

revoke all on function public.revoke_ai_execution_authorization(uuid) from public,anon;
grant execute on function public.revoke_ai_execution_authorization(uuid) to authenticated;

create or replace function public.get_ai_execution_authorization(p_queue_id uuid)
returns table(
  authorization_id uuid,
  queue_id uuid,
  client_id uuid,
  authorized_by uuid,
  max_claims integer,
  consumed_claims integer,
  max_cost_usd numeric,
  expires_at timestamptz,
  status text,
  created_at timestamptz,
  consumed_at timestamptz,
  reason text
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or not private.is_platform_owner() then
    raise sqlstate 'PT403' using message='Acesso negado.';
  end if;
  return query
  select a.id,a.queue_id,a.client_id,a.authorized_by,a.max_claims,a.consumed_claims,a.max_cost_usd,a.expires_at,
         case when a.status='released' and a.expires_at<=now() then 'expired' else a.status end,
         a.created_at,a.consumed_at,a.reason
  from private.ai_execution_authorizations a
  where a.queue_id=p_queue_id
  order by a.created_at desc
  limit 1;
end;
$function$;

revoke all on function public.get_ai_execution_authorization(uuid) from public,anon;
grant execute on function public.get_ai_execution_authorization(uuid) to authenticated;

create or replace function public.claim_opportunity_ai_analysis_job_service(
  p_queue_id uuid,
  p_client_id uuid,
  p_worker_id text
)
returns setof public.opportunity_ai_analysis_queue
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_auth private.ai_execution_authorizations%rowtype;
  v_job public.opportunity_ai_analysis_queue%rowtype;
begin
  if p_queue_id is null or p_client_id is null or nullif(btrim(coalesce(p_worker_id,'')),'') is null then
    return;
  end if;

  select * into v_auth
  from private.ai_execution_authorizations a
  where a.queue_id=p_queue_id
    and a.client_id=p_client_id
    and a.worker_scope=p_worker_id
    and a.status='released'
    and a.expires_at>now()
    and a.consumed_claims<a.max_claims
  order by a.created_at desc
  limit 1
  for update;

  if not found then
    return;
  end if;

  select * into v_job
  from private.claim_opportunity_ai_analysis_job_for_client(p_queue_id,p_client_id,p_worker_id)
  limit 1;

  if v_job.id is null then
    return;
  end if;

  update private.ai_execution_authorizations a
  set consumed_claims=a.consumed_claims+1,
      status=case when a.consumed_claims+1>=a.max_claims then 'consumed' else 'released' end,
      consumed_at=case when a.consumed_claims+1>=a.max_claims then now() else a.consumed_at end
  where a.id=v_auth.id;

  return next v_job;
end;
$function$;

revoke all on function public.claim_opportunity_ai_analysis_job_service(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_opportunity_ai_analysis_job_service(uuid,uuid,text) to service_role;
