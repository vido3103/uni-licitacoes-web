# Blindagem — Habilitação SICAF

Data: 10/09/2026

## Escopo
Implementação e validação do workspace de Habilitação SICAF após o gate cadastral da empresa.

## Arquitetura validada
- 6 níveis SICAF carregados de `sicaf_levels`.
- Seleção de empresa respeitando PLATFORM_OWNER ou vínculo do usuário ao tenant.
- Backend sensível no schema `private`, com execução somente por `service_role` via Edge Function autenticada.
- Bloqueio obrigatório quando `client_enterprise_data.validation_status` não for `validated`.
- Atualização rastreável em `client_sicaf_status`.
- Evidência documental, quando informada, precisa pertencer ao mesmo tenant e ser versão atual.
- Checkpoint `documentacao_habilitacao` recalculado a cada atualização.
- Conclusão somente quando todos os 6 níveis estiverem com status `atende`.
- Registro de auditoria em `audit_events`.

## Contrato de status
Durante a validação foi detectada divergência entre a primeira implementação e o constraint legado de `client_sicaf_status`. A implementação foi corrigida para preservar o contrato persistido:
- `nao_iniciado`
- `em_preparacao`
- `pendente`
- `atende`
- `impeditivo`

A UI e as funções privadas foram alinhadas ao mesmo contrato.

## Testes executados
1. Gate cadastral: tentativa de alterar nível SICAF com empresa não validada foi bloqueada com `company_validation_required`.
2. Happy path: empresa validada transacionalmente, seis níveis marcados `atende`, checkpoint recalculado para `completed` e 100%.
3. Rollback: teste completo revertido; nenhum registro artificial persistiu (`persisted_test_rows = 0`).
4. Build Next.js concluído com sucesso.
5. TypeScript concluído sem erro.
6. Preview Vercel final `dpl_AeBRpb8pYJGJLd7wpg6qAGDp2Whv` em estado READY, commit `97b9ba50e79da0bead1649923d4b5f51795e871e`.

## Segurança
As funções novas de SICAF permanecem no schema privado e não são executáveis diretamente por `authenticated`/`anon`. O Security Advisor não apontou alerta novo relacionado ao SICAF. Permanecem dois avisos preexistentes fora deste escopo: execução autenticada intencional do RPC de dashboard e proteção contra senhas vazadas desabilitada no Supabase Auth.

## Resultado
**APROVADO E BLINDADO EM DESENVOLVIMENTO.**

A promoção para produção permanece separada do fechamento técnico desta etapa.
