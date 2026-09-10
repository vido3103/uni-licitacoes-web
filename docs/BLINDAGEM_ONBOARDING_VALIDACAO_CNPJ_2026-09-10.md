# Blindagem — Onboarding / Validação do Cartão CNPJ

Data: 2026-09-10
Status: APROVADO

## Escopo
Cadastro por CNPJ, upload do Cartão CNPJ, abertura de revisão, console UNI-OWNER, decisão aprovado/divergente, checkpoint e auditoria.

## Controles
- Documento oficial separado da consulta cadastral; consulta não valida empresa.
- Cartão CNPJ versionado em `client_documents` e tipo dedicado `cnpj_registration_card`.
- Revisão persistida em `company_registry_validations`.
- Decisão final restrita ao `platform_owner` ativo.
- Funções internas revogadas de `anon` e `authenticated`; execução por `service_role` atrás de Edge Functions autenticadas.
- Edge Functions validam JWT e identificam o ator antes da operação privilegiada.
- Aprovação atualiza documento, dados empresariais e checkpoint `cadastro_empresarial` para 100%/completed.
- Divergência marca documento impeditivo, dados empresariais divergent e checkpoint blocked, com justificativa.
- Toda abertura e decisão gera `audit_events`.
- Decisão não pode ser repetida após sair de `pending_review`.
- Console administrativo fornece link assinado temporário para o documento.

## Validação
- Build Next.js: aprovado.
- TypeScript: aprovado.
- Vercel preview do commit b996729: READY.
- Teste transacional de aprovação: aprovado, incluindo auditoria e checkpoint; rollback confirmou zero resíduos.
- Teste transacional de divergência: aprovado, incluindo bloqueio do checkpoint; rollback confirmou zero resíduos.
- Shell original foi restaurado/preservado após detecção preventiva de regressão durante a integração do console.

## Resultado
Bloco de validação cadastral por Cartão CNPJ aprovado e blindado para a branch `feature/onboarding-cnpj-v1`. Próxima etapa funcional: Habilitação SICAF. A promoção para produção permanece separada da blindagem deste bloco.
