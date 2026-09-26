-- VEENCE-HML only: minimal independent contract for the v14 worker.
-- No production data, schedules, triggers, or client-facing mutations.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null, display_name text not null, status text not null default 'active'
);
create table public.client_members (
  client_id uuid not null references public.clients(id),
  user_id uuid not null,
  role text not null default 'owner',
  primary key(client_id,user_id)
);
create table public.platform_user_roles (
  user_id uuid primary key, role text not null, active boolean not null default true
);
create table public.public_opportunities (
  id uuid primary key default gen_random_uuid(),
  source_id uuid, buyer_name text, buyer_document text, process_number text,
  modality text, title text, object_text text, publication_date date,
  proposal_deadline timestamptz, estimated_value numeric, state text, city text,
  lifecycle text
);
create table public.public_opportunity_items (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.public_opportunities(id),
  item_number integer not null, description text not null, quantity numeric,
  unit text, estimated_unit_value numeric, estimated_total_value numeric
);
create table public.client_opportunity_item_selections (
  client_id uuid not null references public.clients(id),
  opportunity_id uuid not null references public.public_opportunities(id),
  item_id uuid not null references public.public_opportunity_items(id),
  selected boolean not null default true,
  primary key(client_id,opportunity_id,item_id)
);
create table public.opportunity_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  opportunity_id uuid not null references public.public_opportunities(id),
  storage_bucket text not null, storage_path text not null, original_filename text not null,
  mime_type text not null, file_size_bytes bigint not null,
  source_kind text, validation_status text not null default 'available',
  uploaded_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);
create table public.playbooks (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id),
  version_no integer not null, payload jsonb not null, is_current boolean not null default true,
  unique(client_id,version_no)
);
create table public.client_profiles (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id),
  version_no integer not null, payload jsonb not null, is_current boolean not null default true,
  unique(client_id,version_no)
);
create table public.method_versions (
  id uuid primary key default gen_random_uuid(), method_name text not null,
  version text not null unique, status text not null, content text not null,
  metadata jsonb not null default '{}'::jsonb, checksum text
);
create table public.opportunity_ai_analysis_queue (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  capability_id uuid not null, opportunity_id uuid not null references public.public_opportunities(id),
  triage_run_id uuid not null, status text not null default 'pending',
  prompt_master_version text not null, profile_version text not null, playbook_version text not null,
  model_provider text, model_name text, attempt_count integer not null default 0,
  max_attempts integer not null default 1 check (max_attempts=1),
  locked_by text, locked_at timestamptz, heartbeat_at timestamptz,
  next_attempt_at timestamptz, context_snapshot jsonb not null default '{}'::jsonb,
  context_hash text, provider_request_id text, error_detail text,
  updated_at timestamptz not null default now(),
  unique(client_id,capability_id,opportunity_id,triage_run_id)
);
create table public.opportunity_ai_analysis_results (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null unique references public.opportunity_ai_analysis_queue(id),
  client_id uuid not null, capability_id uuid not null, opportunity_id uuid not null,
  recommendation text not null check (recommendation='revisao_manual'),
  gate_results jsonb not null default '{}'::jsonb, evidence jsonb not null default '[]'::jsonb,
  analysis_payload jsonb not null, prompt_master_version text not null,
  profile_version text not null, playbook_version text not null,
  model_provider text, model_name text, created_at timestamptz not null default now()
);
create table public.ai_executions (
  id uuid primary key default gen_random_uuid(), client_id uuid not null,
  playbook_id uuid, model_name text, execution_type text, created_by uuid,
  result jsonb, evidence jsonb, created_at timestamptz not null default now()
);
create table public.audit_events (
  id bigint generated always as identity primary key, client_id uuid,
  actor_user_id uuid, event_type text not null, entity_type text, entity_id text,
  after_data jsonb, created_at timestamptz not null default now()
);

-- The Edge Function uses service_role. No application role may mutate or read this fixture.
do $$
declare t text;
begin
  foreach t in array array['clients','client_members','platform_user_roles',
    'public_opportunities','public_opportunity_items','client_opportunity_item_selections',
    'opportunity_documents','playbooks','client_profiles','method_versions',
    'opportunity_ai_analysis_queue','opportunity_ai_analysis_results','ai_executions','audit_events']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant usage, select on sequence public.audit_events_id_seq to service_role;

create function public.claim_opportunity_ai_analysis_job_service(
  p_queue_id uuid,p_client_id uuid,p_worker_id text
) returns setof public.opportunity_ai_analysis_queue
language plpgsql security definer set search_path='' as $$
begin
  return query
  update public.opportunity_ai_analysis_queue q
  set status='processing',attempt_count=q.attempt_count+1,locked_by=p_worker_id,
      locked_at=now(),heartbeat_at=now(),updated_at=now()
  where q.id=p_queue_id and q.client_id=p_client_id
    and q.status='pending' and q.attempt_count=0 and q.max_attempts=1
  returning q.*;
end $$;
create function public.complete_opportunity_ai_analysis_job_service(
  p_queue_id uuid,p_worker_id text,p_recommendation text,p_gate_results jsonb,
  p_evidence jsonb,p_analysis_payload jsonb,p_model_provider text,p_model_name text,
  p_provider_request_id text
) returns uuid language plpgsql security definer set search_path='' as $$
declare q public.opportunity_ai_analysis_queue; result_id uuid;
begin
  if p_recommendation<>'revisao_manual' then raise exception 'human_review_required'; end if;
  select * into q from public.opportunity_ai_analysis_queue
    where id=p_queue_id and status='processing' and locked_by=p_worker_id for update;
  if not found then raise exception 'job_not_owned'; end if;
  insert into public.opportunity_ai_analysis_results
    (queue_id,client_id,capability_id,opportunity_id,recommendation,gate_results,
     evidence,analysis_payload,prompt_master_version,profile_version,playbook_version,
     model_provider,model_name)
  values(q.id,q.client_id,q.capability_id,q.opportunity_id,'revisao_manual',
    p_gate_results,p_evidence,p_analysis_payload,q.prompt_master_version,
    q.profile_version,q.playbook_version,p_model_provider,p_model_name)
  returning id into result_id;
  update public.opportunity_ai_analysis_queue set status='completed',
    provider_request_id=p_provider_request_id,locked_by=null,locked_at=null,
    updated_at=now() where id=q.id;
  return result_id;
end $$;
create function public.fail_opportunity_ai_analysis_job_service(
  p_queue_id uuid,p_worker_id text,p_error text,p_retry_delay_seconds integer
) returns text language plpgsql security definer set search_path='' as $$
begin
  update public.opportunity_ai_analysis_queue set status='failed',
    error_detail=left(p_error,4000),next_attempt_at=null,locked_by=null,
    locked_at=null,updated_at=now()
  where id=p_queue_id and status='processing' and locked_by=p_worker_id;
  if not found then raise exception 'job_not_owned'; end if;
  return 'failed';
end $$;
revoke all on function public.claim_opportunity_ai_analysis_job_service(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.complete_opportunity_ai_analysis_job_service(uuid,text,text,jsonb,jsonb,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.fail_opportunity_ai_analysis_job_service(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.claim_opportunity_ai_analysis_job_service(uuid,uuid,text) to service_role;
grant execute on function public.complete_opportunity_ai_analysis_job_service(uuid,text,text,jsonb,jsonb,jsonb,text,text,text) to service_role;
grant execute on function public.fail_opportunity_ai_analysis_job_service(uuid,text,text,integer) to service_role;
