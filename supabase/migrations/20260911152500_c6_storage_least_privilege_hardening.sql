-- C6 — Storage/document access hardening.
-- Supabase Storage keeps managed base grants for anon/authenticated; RLS remains the enforcement layer.
-- These revokes/grants document the UNI least-privilege intent without altering the storage schema.

revoke all privileges on table storage.objects from anon;
revoke all privileges on table storage.buckets from anon;

revoke truncate, references, trigger on table storage.objects from authenticated;
revoke truncate, references, trigger on table storage.buckets from authenticated;
revoke insert, update, delete on table storage.buckets from authenticated;

grant select on table storage.buckets to authenticated;
grant select, insert, update, delete on table storage.objects to authenticated;
