-- C3: least-privilege hardening for API roles
-- UNI Web requires authentication; anonymous table/RPC access is not part of the product surface.
revoke all privileges on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from public;

-- Authenticated users never need schema-level administrative table privileges.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Private functions must not inherit PostgreSQL's default PUBLIC EXECUTE.
revoke execute on all functions in schema private from public;
revoke execute on all functions in schema private from anon;
revoke execute on all functions in schema private from authenticated;

-- These two private helpers are intentionally used by RLS policies for authenticated requests.
grant execute on function private.is_client_member(uuid) to authenticated;
grant execute on function private.is_platform_owner() to authenticated;

-- Service role retains controlled backend access to private routines.
grant execute on all functions in schema private to service_role;
