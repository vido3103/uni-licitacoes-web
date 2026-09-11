-- C6 — Document and Storage hardening
-- 2026-09-11
-- Preserve client-document history and prevent in-place replacement of physical files.

-- Client document files are immutable physical versions. A new version must use a new path.
drop policy if exists client_documents_storage_update on storage.objects;

-- Client document metadata is retained. Supersession uses is_current/replaced_document_id.
drop policy if exists docs_admin_write_delete on public.client_documents;
revoke delete on table public.client_documents from authenticated;

comment on table public.client_documents is
  'Client document metadata is retained and versioned. Authenticated users cannot hard-delete records; supersession uses is_current/replaced_document_id.';
