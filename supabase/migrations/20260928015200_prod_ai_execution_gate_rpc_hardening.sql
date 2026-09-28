-- Mantém os wrappers públicos como SECURITY INVOKER e move privilégios elevados para o schema private.

create or replace function private.authorize_ai_execution_internal(
  p_queue_id uuid,p_max_claims integer,p_max_cost_usd numeric,p_valid_for_minutes integer,p_idempotency_key text,p_reason text default null
)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  v_user uuid := auth.uid();
  v_client uuid;
  v_existing private.ai_execution_authorizations%rowtype;
  v_id uuid;
begin
  if v_user is null or not private.is_platform_owner() then raise sqlstate 'PT403' using message='Somente o platform owner pode liberar execução de IA em produção.'; end if;
  if p_queue_id is null or coalesce(p_max_claims,0) not between 1 and 8 then raise sqlstate 'PT400' using message='Parâmetros de autorização inválidos.'; end if;
  if coalesce(p_max_cost_usd,0) <= 0 or p_max_cost_usd > 5 then raise sqlstate 'PT400' using message='Teto de custo inválido.'; end if;
  if coalesce(p_valid_for_minutes,0) not between 1 and 60 then raise sqlstate 'PT400' using message='Validade deve estar entre 1 e 60 minutos.'; end if;
  if nullif(btrim(coalesce(p_idempotency_key,'')),'') is null then raise sqlstate 'PT400' using message='Chave de idempotência obrigatória.'; end if;

  select q.client_id into v_client from public.opportunity_ai_analysis_queue q where q.id=p_queue_id and q.status in ('pending','retry_wait');
  if v_client is null then raise sqlstate 'PT409' using message='Fila inexistente ou não liberável no estado atual.'; end if;

  select * into v_existing from private.ai_execution_authorizations a where a.idempotency_key=p_idempotency_key;
  if found then
    if v_existing.queue_id<>p_queue_id or v_existing.client_id<>v_client or v_existing.authorized_by<>v_user then raise sqlstate 'PT409' using message='Chave de idempotência já usada em outra autorização.'; end if;
    return v_existing.id;
  end if;

  update private.ai_execution_authorizations set status='revoked',revoked_at=now() where queue_id=p_queue_id and client_id=v_client and status='released';
  insert into private.ai_execution_authorizations(queue_id,client_id,authorized_by,max_claims,max_cost_usd,expires_at,idempotency_key,reason)
  values(p_queue_id,v_client,v_user,p_max_claims,p_max_cost_usd,now()+make_interval(mins=>p_valid_for_minutes),p_idempotency_key,p_reason)
  returning id into v_id;
  insert into public.audit_events(client_id,actor_user_id,event_type,entity_type,entity_id,after_data)
  values(v_client,v_user,'ai_execution_authorized','opportunity_ai_analysis_queue',p_queue_id,jsonb_build_object('authorization_id',v_id,'max_claims',p_max_claims,'max_cost_usd',p_max_cost_usd,'valid_for_minutes',p_valid_for_minutes,'reason',p_reason));
  return v_id;
end;$function$;

revoke all on function private.authorize_ai_execution_internal(uuid,integer,numeric,integer,text,text) from public,anon;
grant execute on function private.authorize_ai_execution_internal(uuid,integer,numeric,integer,text,text) to authenticated;

create or replace function public.authorize_ai_execution(
  p_queue_id uuid,p_max_claims integer,p_max_cost_usd numeric,p_valid_for_minutes integer,p_idempotency_key text,p_reason text default null
)
returns uuid language sql security invoker set search_path to '' as $function$
  select private.authorize_ai_execution_internal(p_queue_id,p_max_claims,p_max_cost_usd,p_valid_for_minutes,p_idempotency_key,p_reason);
$function$;
revoke all on function public.authorize_ai_execution(uuid,integer,numeric,integer,text,text) from public,anon;
grant execute on function public.authorize_ai_execution(uuid,integer,numeric,integer,text,text) to authenticated;

create or replace function private.revoke_ai_execution_authorization_internal(p_authorization_id uuid)
returns boolean language plpgsql security definer set search_path to '' as $function$
declare v_user uuid := auth.uid(); v_client uuid;
begin
  if v_user is null or not private.is_platform_owner() then raise sqlstate 'PT403' using message='Somente o platform owner pode revogar autorização de IA em produção.'; end if;
  update private.ai_execution_authorizations set status='revoked',revoked_at=now() where id=p_authorization_id and status='released' returning client_id into v_client;
  if v_client is null then return false; end if;
  insert into public.audit_events(client_id,actor_user_id,event_type,entity_type,entity_id,after_data)
  values(v_client,v_user,'ai_execution_authorization_revoked','ai_execution_authorization',p_authorization_id,jsonb_build_object('revoked',true));
  return true;
end;$function$;
revoke all on function private.revoke_ai_execution_authorization_internal(uuid) from public,anon;
grant execute on function private.revoke_ai_execution_authorization_internal(uuid) to authenticated;

create or replace function public.revoke_ai_execution_authorization(p_authorization_id uuid)
returns boolean language sql security invoker set search_path to '' as $function$
  select private.revoke_ai_execution_authorization_internal(p_authorization_id);
$function$;
revoke all on function public.revoke_ai_execution_authorization(uuid) from public,anon;
grant execute on function public.revoke_ai_execution_authorization(uuid) to authenticated;

create or replace function private.get_ai_execution_authorization_internal(p_queue_id uuid)
returns table(authorization_id uuid,queue_id uuid,client_id uuid,authorized_by uuid,max_claims integer,consumed_claims integer,max_cost_usd numeric,expires_at timestamptz,status text,created_at timestamptz,consumed_at timestamptz,reason text)
language plpgsql security definer set search_path to '' as $function$
begin
  if auth.uid() is null or not private.is_platform_owner() then raise sqlstate 'PT403' using message='Acesso negado.'; end if;
  return query select a.id,a.queue_id,a.client_id,a.authorized_by,a.max_claims,a.consumed_claims,a.max_cost_usd,a.expires_at,case when a.status='released' and a.expires_at<=now() then 'expired' else a.status end,a.created_at,a.consumed_at,a.reason from private.ai_execution_authorizations a where a.queue_id=p_queue_id order by a.created_at desc limit 1;
end;$function$;
revoke all on function private.get_ai_execution_authorization_internal(uuid) from public,anon;
grant execute on function private.get_ai_execution_authorization_internal(uuid) to authenticated;

create or replace function public.get_ai_execution_authorization(p_queue_id uuid)
returns table(authorization_id uuid,queue_id uuid,client_id uuid,authorized_by uuid,max_claims integer,consumed_claims integer,max_cost_usd numeric,expires_at timestamptz,status text,created_at timestamptz,consumed_at timestamptz,reason text)
language sql security invoker set search_path to '' as $function$
  select * from private.get_ai_execution_authorization_internal(p_queue_id);
$function$;
revoke all on function public.get_ai_execution_authorization(uuid) from public,anon;
grant execute on function public.get_ai_execution_authorization(uuid) to authenticated;
