# Veence — Onda 1: Fundação e Segurança

Data: 2026-09-23

## Baseline
- Produção auditada a partir do commit `e950c4c0d77db3fcade4733203870231a5c23e56`.
- Branch de implementação: `feat/veence-wave1-foundation`.
- A baseline deve permanecer recuperável durante a onda.

## Alterações aplicadas nesta etapa
1. Criada `private.has_client_role(uuid,text[])` para autorização por papel no tenant.
2. `client_settings`: escrita limitada a owner/admin ou Platform Owner.
3. `client_suppliers`: escrita limitada a owner/admin ou Platform Owner; leitura explicitamente `authenticated`.
4. `opportunity_ai_analysis_queue`: usuários autorizados podem solicitar; atualização direta por usuário foi removida para reservar processamento ao backend/worker.
5. `opportunity_ai_analysis_results`: gravação direta por usuário autenticado removida; leitura do tenant preservada. Resultado oficial deve ser gravado por backend/worker confiável.
6. `gate_economic_results`: escrita limitada a owner/admin ou Platform Owner; leitura explicitamente `authenticated`.
7. `opportunity_participation_decisions`: decisão humana limitada a owner/admin ou Platform Owner.

## Compatibilidade
No momento da implantação, os registros existentes de `client_members` utilizavam o papel `owner`. Assim, a restrição de escrita preserva o comportamento do usuário atual e prepara os papéis futuros sem conceder permissões amplas por padrão.

## Próximas etapas da Onda 1
- Active Organization explícita para multi-CNPJ.
- Consolidar capabilities além do primeiro mapeamento por papel.
- Sincronizar Edge Functions de produção com GitHub.
- Consolidar onboarding e remover seleção implícita da primeira membership.
- Testes de regressão e Preview antes de alterações amplas de frontend.

## Regra de segurança
Mudanças destrutivas, exclusões de dados e remoção de legado só devem ocorrer após prova de não uso e rollback validado.
