-- VEENCE-HML only. Technical activation of the agents authorized by the prepared workflow gate.
-- This migration does NOT release human execution, does NOT alter VEENCE_AI_ENABLED,
-- does NOT consume an authorization, and does NOT call any AI provider.

update hml.agent_registry ar
set enabled = true,
    updated_at = now()
where ar.agent_code in (
  'orchestracao_veence',
  'triagem',
  'habilitacao',
  'produtos',
  'suprimentos',
  'logistica',
  'economico',
  'auditoria'
)
and ar.provider = 'gateway'
and ar.model is not null
and length(trim(ar.instructions)) > 0
and ar.max_cost_usd > 0;

-- relatorios remains local and is intentionally not activated as a Gateway agent.
