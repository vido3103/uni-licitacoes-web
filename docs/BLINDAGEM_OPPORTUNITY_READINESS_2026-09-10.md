# Blindagem — Opportunity Readiness / Gate do Edital

Data: 10/09/2026
Branch: `feature/opportunity-readiness-v1`

## Regra de fechamento
A etapa só pode ser promovida após validação integral. Qualquer falha reinicia revisão → correção → validação integral → blindagem → revisão comprobatória.

## Implementação
- `opportunity_readiness_evaluations`: histórico versionado da decisão por empresa + oportunidade + capacidade.
- `opportunity_requirements`: requisitos específicos técnicos, documentais, comerciais, entrega, habilitação e legais.
- Resultado oficial: `APROVADO`, `APROVADO COM RESSALVA`, `NÃO APROVADO`.
- Cada avaliação reexecuta o Gate de Participação para evitar decisão baseada em estado antigo.
- CFP, cotações CFP, Gate Econômico e Disputa são protegidos no banco e exigem prontidão `APROVADO` atual (máximo 15 minutos), prazo aberto, matching liberado, empresa/capacidade/SICAF válidos, ausência de pendência impeditiva e requisitos sem bloqueio.
- Alteração posterior em requisitos, documentos, matching ou Gate invalida o avanço até nova avaliação.
- Referências cross-tenant de capacidade/oportunidade são bloqueadas por trigger.
- Edge Function `opportunity-readiness` usa JWT e autorização explícita; funções privilegiadas são `service_role` only e recebem ator validado por wrapper interno.

## Correções encontradas durante a validação
1. Contrato incorreto de auditoria (`event_data` inexistente) → corrigido para `before_data`/`after_data`.
2. Comparação incorreta do status do Gate de Participação (backend usa `aprovado`, `aprovado_com_ressalva`, `nao_aprovado`) → corrigida.
3. CFP inicialmente protegido apenas na criação do item → ampliado para item, cotação, Gate Econômico e Disputa, inclusive atualizações.
4. Avaliações no mesmo ciclo podiam empatar por `now()` → defaults alterados para `clock_timestamp()`.
5. Edge Functions privilegiadas dependiam de combinação service-role + JWT de usuário incompatível com ACL service-role-only → criados wrappers internos com `p_actor_user_id` e Edge Functions corrigidas.
6. `sicaf-workspace` e `company-onboarding-start` foram revalidados como dependências e corrigidos para o mesmo contrato seguro; erros internos deixaram de ser expostos no onboarding/SICAF.
7. RPC legado do Dashboard gerava alerta `authenticated SECURITY DEFINER`. Foi retirado da execução direta de `authenticated`, colocado atrás de `dashboard-backend` e o frontend passou a usar a Edge Function.
8. Tentativa intermediária de `SECURITY INVOKER` exigiu acesso ao materialized view de mercado e criou novo alerta. A alteração foi revertida arquiteturalmente: materialized view voltou a não ser selecionável por `authenticated` e o Dashboard privilegiado ficou backend-only.
9. Primeiro build do workspace falhou por fechamento JSX ausente → componente refeito e build integral repetido.

## Testes transacionais com rollback
- Estado real da Luvi: corretamente `NÃO APROVADO`.
- Gate de Participação não aprovado: bloqueio comprovado.
- Requisito impeditivo pendente: `APROVADO COM RESSALVA`.
- Requisito impeditivo `nao_atende`: `NÃO APROVADO`.
- Documento do edital em erro: `NÃO APROVADO`.
- Prazo encerrado: `NÃO APROVADO`.
- Happy path completo: `APROVADO`.
- CFP permitido somente no happy path.
- Alteração de requisito após aprovação: CFP, cotação, Gate Econômico e Disputa bloqueados (4/4).
- Usuário sem vínculo: acesso negado.
- Usuário membro com papel global temporariamente desativado: acesso ao próprio tenant preservado.
- Evidência documental de outra oportunidade: rejeitada.
- Referência de capacidade de outro tenant: rejeitada.
- RLS com segundo tenant sintético: linha do outro tenant invisível ao usuário autenticado; rollback confirmado.
- Wrapper service-role/ator: readiness, SICAF e onboarding testados; CNPJ sintético revertido e zero persistência.
- Todos os registros sintéticos usados nos testes foram revertidos; contagens pós-rollback = 0.

## Frontend / Preview
- Next.js 16.3.4: compilação aprovada.
- TypeScript: aprovado.
- Geração estática: aprovada.
- Preview Vercel: `READY`.
- Preview HTTP: 200.
- Runtime error/fatal no preview anterior da mesma etapa: nenhum; novo preview compilado sem erro.

## Security Advisor
Após as correções de DDL, não restou alerta criado pela etapa nem o antigo alerta de `authenticated SECURITY DEFINER` do Dashboard.

Resta 1 alerta de conta/plano: `auth_leaked_password_protection`.
A proteção contra senhas vazadas está desabilitada e, segundo a documentação oficial do Supabase, o recurso é disponível no plano Pro ou superior. A organização atual está no plano `free`.

## Status da blindagem
**NÃO PROMOVER AINDA COMO BLINDAGEM 100%.**

Motivo único remanescente: Security Advisor ainda possui `auth_leaked_password_protection`. Corrigir esse item exigiria recurso do plano Supabase Pro, portanto implica custo e não pode ser ativado sem autorização explícita do responsável.

Até a decisão sobre esse custo, a implementação permanece validada tecnicamente em preview, mas a regra de fechamento 100% impede promoção final para produção e impede declarar a etapa como `APROVADO E BLINDADO`.
