-- VEENCE-HML only. Remove the legacy single-invocation-per-queue constraint.
-- Multi-agent workflows intentionally persist multiple agent invocations for the
-- same queue, while invocation_key and the workflow authorization keep each
-- individual reservation idempotent and budget-gated.
-- This migration does not execute inference and does not change PROD.

drop index if exists hml.hml_agent_invocations_one_per_queue;

create index if not exists hml_agent_invocations_queue_idx
  on hml.agent_invocations(queue_id)
  where queue_id is not null;
