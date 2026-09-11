-- I8-I10 — attachment lifecycle, permanent preservation and physical deduplication
alter table public.opportunity_documents
  add column if not exists content_sha256 text,
  add column if not exists retention_class text not null default 'active_12m',
  add column if not exists archive_tier text not null default 'active',
  add column if not exists preserve_permanently boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.opportunity_documents drop constraint if exists opportunity_documents_retention_class_check;
alter table public.opportunity_documents add constraint opportunity_documents_retention_class_check check (retention_class in ('active_12m','cold_archive','permanent'));
alter table public.opportunity_documents drop constraint if exists opportunity_documents_archive_tier_check;
alter table public.opportunity_documents add constraint opportunity_documents_archive_tier_check check (archive_tier in ('active','cold'));

create index if not exists idx_opportunity_documents_sha256 on public.opportunity_documents(client_id,content_sha256) where content_sha256 is not null;
create index if not exists idx_opportunity_documents_retention on public.opportunity_documents(client_id,retention_class,uploaded_at);

comment on column public.opportunity_documents.content_sha256 is 'Physical-content fingerprint used to deduplicate attachments while preserving logical references.';
comment on column public.opportunity_documents.preserve_permanently is 'True for participated/won/lost/proposal/appeal/defense/diligence evidence that must not be automatically removed.';

create table if not exists public.opportunity_document_references (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  document_id uuid not null references public.opportunity_documents(id) on delete cascade,
  opportunity_id uuid not null references public.public_opportunities(id) on delete cascade,
  reference_kind text not null default 'source',
  source_url text,
  created_at timestamptz not null default now(),
  unique(client_id,document_id,opportunity_id,reference_kind)
);
alter table public.opportunity_document_references enable row level security;
grant select,insert on public.opportunity_document_references to authenticated;
create policy opportunity_document_refs_select_member on public.opportunity_document_references for select to authenticated using (private.is_client_member(client_id));
create policy opportunity_document_refs_insert_member on public.opportunity_document_references for insert to authenticated with check (private.is_client_member(client_id));
create index if not exists idx_opportunity_document_refs_client_opp on public.opportunity_document_references(client_id,opportunity_id);
