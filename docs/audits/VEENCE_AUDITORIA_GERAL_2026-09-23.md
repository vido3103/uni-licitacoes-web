# Veence — Auditoria Geral e Baseline

Data: 2026-09-23
Status: AUDITORIA GERAL CONCLUÍDA — baseline registrada; correções estruturais seguem por ondas controladas.

## Baseline de produção

- Repositório: `vido3103/uni-licitacoes-web`
- Branch de produção: `main`
- Commit de produção auditado: `e950c4c0d77db3fcade4733203870231a5c23e56`
- Deployment Vercel: `dpl_42FtxyxN2o1daD2MjihgxrDsF4xF`
- Estado do deployment: `READY`
- Branch de preservação: `audit/veence-baseline-2026-09-23`
- Supabase project ref: `oaakuckvzxeekyqmvsza`

## Conclusão arquitetural

O Veence não deve ser reconstruído do zero. A fundação existente é aproveitável e deve ser modernizada de forma incremental, preservando Auth, multi-tenant, RLS, coletores, cadeia de documentos, readiness, workers e gates já válidos.

## Achados confirmados

### Segurança

- Todas as tabelas de negócio do schema `public` auditadas estão com RLS habilitada.
- Todas as views públicas auditadas usam `security_invoker=true`.
- Funções `SECURITY DEFINER` públicas auditadas não concedem EXECUTE a `anon` nem `authenticated`.
- `company_access_requests` e `tenant_reset_append_only_archive` têm RLS habilitada sem policy. Isso funciona como deny-by-default para Data API e não deve ser tratado automaticamente como falha sem revisar os fluxos service-role.
- Supabase Auth está com leaked-password protection desabilitada. Recomendação: habilitar no painel/configuração Auth assim que disponível no fluxo de implementação.
- A autorização intra-CNPJ ainda precisa ser granularizada por capabilities; membership isoladamente não deve autorizar ações críticas.

### Multi-CNPJ

- `client_members` é base adequada e deve ser preservada.
- Há fluxos que escolhem implicitamente a primeira membership. Devem migrar para Active Organization Context explícito.
- `sessionStorage` pode manter contexto visual, nunca autoridade de acesso.

### IA

- Fila, snapshot e worker existentes são aproveitáveis.
- Solicitar análise e gravar resultado oficial devem ser permissões distintas.
- Resultado oficial deve ser escrito somente por backend/worker confiável.
- O acoplamento direto a Gemini deve evoluir para AI Gateway/Orchestrator.

### Econômico e participação

- Entrada econômica, cálculo, política econômica e decisão final devem ser capacidades separadas.
- SPT permanece determinístico.
- Recomendação automática, liberação operacional e decisão humana final são estados distintos.

### Radar

- PNCP e Compras.gov.br já possuem coletores próprios.
- A regra alvo aprovada é atualização ordinária a cada 2 horas; cron atual identificado em auditoria deve ser alinhado na Onda 2, sem misturar essa alteração com a baseline.
- Deduplicação, normalização e matching existentes devem ser preservados e evoluídos.

### GitHub / Supabase / Vercel

- Produção contém Edge Functions não integralmente representadas no repositório; sincronização é prioridade da Onda 1.
- Histórico recente da Vercel contém deployments `ERROR` intercalados com `READY`; o deployment atual está `READY`.
- Não foram encontrados erros/fatals nos runtime logs de produção disponíveis na janela de retenção consultada.
- `package.json` contém quality gate composto por lint, typecheck, testes e build (`npm run check`).

### Performance

- Supabase Advisor reporta índices ainda não utilizados. Não remover automaticamente: baixo uso pode refletir juventude do sistema ou caminhos ainda pouco exercitados. Revisar com métricas após estabilização.

## Decisão por ondas

1. Fundação e Segurança: sincronização produção↔GitHub, Active Organization, capabilities, RLS granular, validação backend, onboarding e auditoria.
2. Radar e Ingestão: Event/Policy Engine, frequência 2h, fontes e deduplicação.
3. Processo e Evidências: oportunidades, itens, documentos, requirements, readiness e evidências.
4. Inteligência: Orchestrator, AI Gateway, snapshots e versionamento.
5. Econômico e Participação: formação de custos configurável, SPT, gates e decisão humana.
6. Pós-disputa e Retenção: PEC, EDC, AAF, resultados e política documental.
7. Experiência Veence: frontend, dashboards, Owner/Cliente, assistente e alerta D-1 para fechamento de análise/proposta.
8. Hardening: E2E, observabilidade, CI/CD, remoção comprovada de legado e promoção segura.

## Regras de implementação

- Nunca apagar dados operacionais para realizar rollback de código/schema.
- Mudanças destrutivas exigem prova de não uso e ponto de recuperação.
- Interface não é autoridade de segurança; autorização deve existir no backend/RLS quando aplicável.
- Secrets nunca entram no repositório.
- Mudanças Supabase devem ser verificadas após aplicação e passar por advisors.
- Deploy em produção somente após quality gate e smoke tests.
- Nomenclatura UNI→Veence deve migrar por compatibilidade, sem quebra abrupta de consumidores existentes.

## Gate final da auditoria

Resultado: **APROVADO PARA IMPLEMENTAÇÃO CONTROLADA**.

A baseline foi preservada em branch própria antes de refatorações. Os achados acima constituem a referência para execução das ondas e para impedir regressões arquiteturais.