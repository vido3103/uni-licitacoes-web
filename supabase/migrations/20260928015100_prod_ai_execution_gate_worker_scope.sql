-- Alinha o escopo do gate ao identificador efetivamente usado pelo worker de produção.
alter table private.ai_execution_authorizations
  alter column worker_scope set default 'uni-analysis-worker-veence-v7';

update private.ai_execution_authorizations
set worker_scope='uni-analysis-worker-veence-v7'
where worker_scope='uni-analysis-worker-gemini'
  and consumed_claims=0
  and status='released';
