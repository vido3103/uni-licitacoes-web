# Blindagem Final — UNI Licitações Web — 11/09/2026

## Escopo
Auditoria integral do projeto após a blindagem página a página e a inclusão do Gemini como primeiro `AiProvider` de validação.

## Resultado executivo
**STATUS: APROVADO COM RESSALVAS PARA BLINDAGEM FINAL.**

A arquitetura principal, isolamento por tenant, persistência, fila de análise, controles de concorrência e cadeia CFP → Gate → Disputa estão consistentes. O motor Gemini foi incluído no backend e endurecido para operar somente sobre uma fila específica pertencente ao tenant autenticado. Ainda restam pontos de fechamento antes de considerar o sistema 100% encerrado para promoção.

## Correções aplicadas nesta auditoria
- Criada função `private.claim_opportunity_ai_analysis_job_for_client(queue_id, client_id, worker_id)` com `SECURITY DEFINER`, `search_path=''`, revogação para `anon/authenticated` e execução apenas por `service_role`.
- Worker Gemini atualizado para v2.
- Worker passa a usar claim atômico específico por fila e tenant, evitando corrida e apropriação de job incorreto.
- Worker Gemini passa a ler PDFs reais do bucket privado e enviá-los ao modelo por `inlineData`, com limites de 8 MB por PDF e 16 MB no conjunto.
- Documentos não suportados ou excedentes são explicitamente marcados como omitidos; o modelo é instruído a não tratá-los como lidos.
- Resultado da análise é persistido via `complete_opportunity_ai_analysis_job`.
- Falha passa por `fail_opportunity_ai_analysis_job`, preservando retry/backoff.
- Execuções e falhas registram trilha em `ai_executions` e `audit_events`.
- RLS confirmada ativa nas tabelas críticas: CFP, Gate, Disputa, documentos, fila e resultados de IA, gates estruturados e decisões de participação.
- Índices adicionados para as FKs críticas do fluxo CFP → Gate → Disputa → Documentos → IA.
- Índices duplicados removidos em `opportunity_ai_analysis_results` e `client_sicaf_status`.

## Estado das páginas
Dashboard, Radar, Editais, CFP, Gate Econômico, Disputa, Relatórios, Documentos, Fornecedores e Configurações permanecem consolidados no branch `interface-profissional-v1`.

O último deploy Vercel auditado desse branch está em estado `READY`. A branch `main` não foi alterada por esta etapa.

## Auditoria de segurança
O advisor de segurança do Supabase reportou dois avisos remanescentes:
1. `get_client_dashboard_backend(uuid)` continua `SECURITY DEFINER` executável por `authenticated`. O risco é mitigado pela checagem explícita de autenticação e `private.is_client_member(p_client_id)`, mas o linter recomenda roteamento integral pelo backend/Edge ou conversão para `SECURITY INVOKER` quando a compatibilidade permitir.
2. Proteção contra senhas vazadas (HaveIBeenPwned) está desativada no Supabase Auth. É uma configuração do ambiente, não um defeito de código.

## Auditoria de performance
- FKs críticas do fluxo operacional foram indexadas nesta rodada.
- Os avisos de índices duplicados foram eliminados.
- Permanecem avisos de performance não bloqueantes em tabelas auxiliares e em políticas RLS com `auth.*` reavaliado por linha. Esses pontos entram como otimização posterior e não comprometem isolamento ou correção funcional.

## Gemini / Análise Detalhada
A Edge Function `uni-analysis-worker-gemini` está ACTIVE, `verify_jwt=true`, versão 2.

Cadeia backend blindada:
`fila específica → autenticação → membership → claim atômico → contexto versionado → PDFs reais → Gemini → JSON estruturado → persistência → retry/falha → auditoria`.

## Ressalvas finais antes do 100%
### R1 — Gatilho da interface para o worker
A página Radar atualmente registra a análise na fila, porém a versão auditada ainda apresenta a mensagem “aguardando o executor do UNI”; o acionamento direto do `uni-analysis-worker-gemini` ainda precisa ser ligado ao fluxo da interface ou a um executor interno seguro.

### R2 — Teste E2E autenticado real
Ainda falta prova final em sessão autenticada do fluxo completo:
`Radar → fila → worker Gemini → leitura de PDF → resultado → persistência → atualização de gates → retorno visual`.

### R3 — Proteção de senha vazada
Ativar no Supabase Auth a proteção de senha comprometida quando disponível no plano/configuração atual.

### R4 — Dashboard SECURITY DEFINER
Não é falha explorável identificada nesta auditoria, pois há autenticação e checagem de membership, mas deve ser eliminado do advisor numa rodada futura quando a rota Edge puder substituir completamente o RPC direto sem regressão.

## Decisão
O projeto está tecnicamente apto para entrar na **Blindagem Final de Fechamento**, mas ainda não deve ser declarado `100% BLINDADO` nem promovido para `main` até R1 e R2 serem encerrados. R3 e R4 são endurecimentos de ambiente/arquitetura e podem ser fechados na mesma rodada final.

**Classificação atual: APROVADO COM RESSALVAS.**
