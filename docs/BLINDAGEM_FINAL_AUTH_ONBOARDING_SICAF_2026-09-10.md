# Blindagem Final — Autenticação, Onboarding CNPJ e SICAF

Data: 10/09/2026

## Escopo
Fechamento integrado do bloco anterior ao Gate de Participação: autenticação UNI, cadastro empresarial por CNPJ, Cartão CNPJ, revisão UNI-OWNER e habilitação SICAF.

## Controles consolidados
- Login UNI e papel PLATFORM_OWNER preservados.
- Cadastro empresarial iniciado por CNPJ, com validação de formato/dígitos e unicidade.
- Dados empresariais versionados e separados da validação documental.
- Cartão CNPJ em armazenamento privado e revisão explícita pelo UNI-OWNER.
- Divergências não são corrigidas silenciosamente; bloqueiam o checkpoint cadastral.
- Funções privilegiadas permanecem privadas e são chamadas por Edge Functions autenticadas.
- RLS ativo nas tabelas críticas de tenant, documentos, cadastro, validação e SICAF.
- SICAF bloqueado enquanto a empresa não estiver validada.
- Seis níveis SICAF respeitam o contrato persistido: nao_iniciado, em_preparacao, pendente, atende, impeditivo.
- Evidência documental SICAF deve pertencer ao mesmo tenant.
- Checkpoint de habilitação só conclui com os seis níveis em atende.
- Alterações relevantes geram audit_events.
- Label visual legado Preview removido do shell antes da promoção.

## Validações
- Testes transacionais de onboarding, aprovação/divergência do Cartão CNPJ e SICAF executados com rollback e sem resíduos artificiais.
- Tentativa de avanço SICAF sem validação empresarial bloqueada.
- Happy path SICAF validado até 100% em transação de teste.
- RLS confirmado ativo nas tabelas críticas.
- Security Advisor sem novo achado relacionado a onboarding/SICAF. Permanecem avisos preexistentes: RPC SECURITY DEFINER do dashboard executável por authenticated de forma intencional e proteção de senha vazada desabilitada.
- Branch de desenvolvimento validada em Vercel com build Next.js e TypeScript aprovados.
- Conteúdo funcional promovido para main para validação final de produção.

## Estado de dados reais
A empresa Luvi permanece em onboarding/pending validation. Nenhum teste alterou esse estado real. Os seis níveis SICAF permanecem sem registros reais até a validação cadastral efetiva.

## Resultado
Bloco tecnicamente consolidado para produção. O Gate de Participação não deve avançar até a verificação do deployment de produção e do runtime pós-promoção.
