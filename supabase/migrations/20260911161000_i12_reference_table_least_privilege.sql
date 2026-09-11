-- I12 — restore least privilege after creating attachment reference table
revoke all privileges on table public.opportunity_document_references from anon;
revoke truncate,references,trigger,update,delete on table public.opportunity_document_references from authenticated;
grant select,insert on table public.opportunity_document_references to authenticated;
