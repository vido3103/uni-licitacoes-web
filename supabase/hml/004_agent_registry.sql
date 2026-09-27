-- VEENCE-HML only. Agent definitions are configuration, not execution triggers.
create table if not exists hml.agent_registry (
  id uuid primary key default gen_random_uuid(),
  agent_code text not null unique check (agent_code ~ '^[a-z_]+$'),
  version text not null default 'draft',
  enabled boolean not null default false,
  instructions text not null default '',
  skills jsonb not null default '[]'::jsonb check (jsonb_typeof(skills) = 'array'),
  allowed_tools jsonb not null default '[]'::jsonb check (jsonb_typeof(allowed_tools) = 'array'),
  permissions jsonb not null default '{}'::jsonb check (jsonb_typeof(permissions) = 'object'),
  provider text not null default 'gateway' check (provider = 'gateway'),
  model text,
  max_output_tokens integer not null default 600 check (max_output_tokens between 1 and 4096),
  timeout_ms integer not null default 45000 check (timeout_ms between 1000 and 120000),
  max_cost_usd numeric(12,6) not null default 0 check (max_cost_usd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enabled_agent_configured check (
    not enabled or (length(trim(instructions)) > 0 and length(trim(coalesce(model,''))) > 0 and max_cost_usd > 0)
  )
);
alter table hml.agent_registry enable row level security;
revoke all on hml.agent_registry from public, anon, authenticated;
grant select, insert, update on hml.agent_registry to service_role;

insert into hml.agent_registry(agent_code) values
 ('orchestracao_veence'), ('radar'), ('triagem'), ('habilitacao'),
 ('produtos'), ('suprimentos'), ('logistica'), ('economico'),
 ('auditoria'), ('relatorios')
on conflict (agent_code) do nothing;

-- One ledger row per invocation key; reservations survive upstream failures/timeouts.
create table if not exists hml.agent_invocations (
  id uuid primary key default gen_random_uuid(),
  invocation_key uuid not null unique,
  agent_id uuid not null references hml.agent_registry(id),
  client_id uuid,
  queue_id uuid,
  model text not null,
  provider text not null check (provider = 'gateway'),
  reserved_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'reserved' check (status in ('reserved','completed','failed','ambiguous')),
  provider_request_id text,
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  reported_cost_usd numeric(12,6) check (reported_cost_usd >= 0),
  estimated_cost_usd numeric(12,6) check (estimated_cost_usd >= 0),
  audit jsonb not null default '{}'::jsonb
);
alter table hml.agent_invocations enable row level security;
revoke all on hml.agent_invocations from public, anon, authenticated;
grant select, insert, update on hml.agent_invocations to service_role;

create or replace function hml.reserve_agent_invocation(
 p_invocation_key uuid, p_agent_code text, p_client_id uuid, p_queue_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare a hml.agent_registry; reserved_id uuid;
begin
 select * into a from hml.agent_registry where agent_code = p_agent_code and enabled for update;
 if not found then return null; end if;
 insert into hml.agent_invocations(invocation_key,agent_id,client_id,queue_id,model,provider)
 values(p_invocation_key,a.id,p_client_id,p_queue_id,a.model,a.provider)
 on conflict(invocation_key) do nothing returning id into reserved_id;
 return reserved_id;
end $$;
revoke all on function hml.reserve_agent_invocation(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function hml.reserve_agent_invocation(uuid,text,uuid,uuid) to service_role;
