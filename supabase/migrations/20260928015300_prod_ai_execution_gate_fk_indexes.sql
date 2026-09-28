create index if not exists ai_execution_authorizations_client_idx
  on private.ai_execution_authorizations(client_id);

create index if not exists ai_execution_authorizations_authorized_by_idx
  on private.ai_execution_authorizations(authorized_by);
