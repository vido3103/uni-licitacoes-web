# Blindagem — Opportunity Readiness / Gate do Edital

Data: 10/09/2026
Branch: `feature/opportunity-readiness-v1`

## Regra de fechamento
A etapa só pode ser promovida após validação integral. Qualquer falha reinicia revisão → correção → validação integral → blindagem → revisão comprobatória.

## Implementação
- `opportunity_readiness_evaluations`: histórico da decisão por empresa + oportunidade + capacidade.
- `opportunity_requirements`: requisitos técnicos, documentais, comerciais, entrega, habilitação, legais e outros.
- Resultado oficial: `APROVADO`, `APROVADO COM RESSALVA`, `NÃO APROVADO`.
- Cada avaliação reexecuta o Gate de Participação.
- CFP, cotações CFP, Gate Econômico e Disputa exigem prontidão `APROVADO` atual (máximo 15 minutos), prazo aberto, matching liberado, empresa/capacidade/SICAF válidos, ausência de pendência impeditiva e requisitos sem bloqueio.
- Alteração posterior em requisitos, documentos, matching ou Gate invalida o avanço até nova avaliação.
- Referências cross-tenant de capacidade/oportunidade são bloqueadas por trigger.
- Edge Function `opportunity-readiness` usa JWT e autorização explícita; operações privilegiadas usam wrappers `service_role` only com ator validado.

## Correções encontradas durante a validação
1. Contrato de auditoria usava `event_data` inexistente → corrigido para `before_data`/`after_data`.
2. Status do Gate de Participação era comparado com nomenclatura errada → alinhado a `aprovado`, `aprovado_com_ressalva`, `nao_aprovado`.
3. CFP inicialmente protegido apenas na criação do item → proteção ampliada para item, cotação, Gate Econômico e Disputa, inclusive atualizações.
4. Empate temporal de avaliações por `now()` → defaults alterados para `clock_timestamp()`.
5. Edge Functions privilegiadas usavam combinação service-role + JWT de usuário incompatível com ACL service-role-only → criados wrappers internos com `p_actor_user_id`.
6. `sicaf-workspace` e `company-onboarding-start` foram revalidados como dependências e corrigidos para o mesmo contrato; mensagens internas deixaram de ser expostas.
7. Dashboard: preparada migração do RPC privilegiado para Edge Function `dashboard-backend` e frontend da branch atualizado.
8. Tentativa intermediária de `SECURITY INVOKER` exigiu permissão no materialized view de mercado e criou alerta → acesso direto ao materialized view foi revogado.
9. Primeiro build do workspace falhou por fechamento JSX ausente → componente refeito e build integral repetido.
10. Como o backend Supabase é o projeto principal e o frontend novo ainda não foi promovido, revogar imediatamente o RPC antigo quebraria o frontend de produção atual. A permissão `authenticated` do RPC do Dashboard foi restaurada temporariamente para preservar produção. Ela só deve ser removida no mesmo ato da promoção do frontend `dashboard-backend`.

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
- Wrappers service-role/ator: readiness, SICAF e onboarding testados; CNPJ sintético revertido e zero persistência.
- Compatibilidade do RPC atual do Dashboard revalidada sob role `authenticated` após restauração temporária.
- Todos os registros sintéticos foram revertidos; contagens pós-rollback = 0.

## Frontend / Preview
- Next.js 16.3.4: compilação aprovada.
- TypeScript: aprovado.
- Geração estática: aprovada.
- Preview Vercel final: `READY`.
- Preview HTTP: 200.
- Branch está à frente de `main` e não está atrás; nenhuma divergência concorrente detectada na comparação.

## Security Advisor — estado atual
Existem 2 WARNs enquanto a etapa não é promovida:

1. `authenticated_security_definer_function_executable` no Dashboard — mantido temporariamente por compatibilidade com o frontend de produção atual. A correção já está pronta na branch (`dashboard-backend`) e deve ser concluída atomicamente com a promoção do frontend.
2. `auth_leaked_password_protection` — proteção contra senhas vazadas desabilitada. A documentação oficial do Supabase informa que o recurso exige plano Pro ou superior. A organização `VridoCorp` está atualmente no plano `free`.

## Status da blindagem
**NÃO PROMOVER AINDA COMO BLINDAGEM 100%.**

O primeiro WARN é tecnicamente resolvível sem custo e já possui correção pronta, mas sua remoção antes da promoção do frontend quebraria produção. O segundo depende de recurso pago do Supabase Pro e não pode ser ativado sem autorização explícita de custo.

A implementação funcional permanece em preview. Não declarar `APROVADO E BLINDADO` nem promover a branch enquanto o critério de 100% não puder ser comprovado.
