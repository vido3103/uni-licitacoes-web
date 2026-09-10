# UNI Licitações — Blindagem do Onboarding por CNPJ

Data: 10/09/2026
Escopo: cadastro inicial da empresa por CNPJ, antes do SICAF e do Gate de Participação.
Branch: `feature/onboarding-cnpj-v1`

## Arquitetura validada

Fluxo: usuário autenticado → módulo Empresas → consulta CNPJ → Edge Function autenticada `cnpj-lookup` → conferência visual → Edge Function autenticada `company-onboarding-start` → RPC interno restrito ao `service_role` → criação do tenant em onboarding → dados empresariais versionados → checkpoints → auditoria.

## Regras de segurança

- CNPJ validado por tamanho, repetição e dígitos verificadores antes da consulta e novamente no banco.
- CNPJ atual não pode existir em mais de um tenant.
- Usuário cliente comum só pode ser vinculado a uma empresa.
- `PLATFORM_OWNER` não é inserido como membro de cada cliente; o acesso global é reconhecido separadamente por `platform_user_roles`.
- `private.is_client_member` passa a reconhecer o `PLATFORM_OWNER` como acesso administrativo global, preservando membership normal para clientes.
- `UNI-OWNER` não é substituído por login de cliente durante criação de empresas.
- Para cliente comum, o login é gerado no padrão `UNI-<NOME FANTASIA>`, com normalização e tratamento de colisão.
- O RPC de criação deixou de ser executável por `authenticated`; somente `service_role` pode chamá-lo, por trás da Edge Function autenticada.
- Nenhum cadastro é marcado como validado nesta etapa: `validation_status = pending_validation`.
- A habilitação SICAF e o Gate de Participação permanecem posteriores e bloqueados.

## Testes executados

1. CNPJs com dígitos verificadores válidos foram reconhecidos pela função de validação.
2. Teste transacional do onboarding com `UNI-OWNER`: criação de tenant, versão empresarial, três checkpoints e trilha de acesso; transação revertida ao final para não deixar empresa fictícia.
3. Achado durante teste: constraint histórica de um cliente por usuário bloqueava o OWNER. Correção aplicada: OWNER opera globalmente sem membership artificial por tenant.
4. Reteste transacional: `status=onboarding`, `validation_status=pending_validation`, três checkpoints, zero memberships artificiais para OWNER, `owner_can_access=true` e login preservado `UNI-OWNER`.
5. Edge Function `cnpj-lookup` publicada ACTIVE v1 com `verify_jwt=true`.
6. Edge Function `company-onboarding-start` publicada ACTIVE v1 com `verify_jwt=true`.
7. Interface adicionada ao módulo Empresas e redirecionamento automático preparado para cliente autenticado sem empresa.
8. Vercel Preview `dpl_83bVAEy1FFZMTJtLLXTMMXfPtRa7`: build Next.js e TypeScript PASS, deployment READY.
9. Preview HTTP respondeu 200.

## Fonte cadastral desta fase

A consulta utiliza BrasilAPI como provedor técnico de dados cadastrais públicos para o onboarding. A resposta é tratada como fonte de preenchimento inicial, não como validação documental definitiva. O Cartão CNPJ continuará obrigatório para a próxima subetapa de conferência e validação.

## Pendência para fechamento integral da etapa

Executar teste funcional autenticado no navegador com um CNPJ real, sem confirmar a criação de uma empresa indevida, e em seguida implementar/analisar o upload do Cartão CNPJ e confronto dos dados. Até esse teste e a conferência documental, o cadastro permanece `pending_validation` por desenho.

Resultado técnico desta rodada: **APROVADO COM RESSALVA CONTROLADA** — fundação, segurança, persistência transacional e interface validadas; validação documental pelo Cartão CNPJ ainda é a próxima subetapa obrigatória antes do SICAF.
