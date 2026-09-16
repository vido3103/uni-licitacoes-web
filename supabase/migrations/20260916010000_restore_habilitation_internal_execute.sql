-- The public RPC is SECURITY INVOKER and delegates to this private function.
-- The private function performs its own auth.uid() and platform Owner checks.
revoke all on function private.set_client_habilitation_status_internal(uuid, boolean, text)
  from public, anon;

grant execute on function private.set_client_habilitation_status_internal(uuid, boolean, text)
  to authenticated;
