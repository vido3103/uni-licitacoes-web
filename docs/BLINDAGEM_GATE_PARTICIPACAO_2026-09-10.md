# Blindagem — Gate de Participação

Data: 10/09/2026
Branch: `feature/gate-participacao-v1`

## Escopo
Gate anterior à participação efetiva, consolidando cadastro empresarial, SICAF, capacidade comercial, habilitação de participação no Radar e pendências impeditivas.

## Regras blindadas
- A empresa precisa estar com `client_enterprise_data.validation_status = validated`.
- Os seis níveis de `client_sicaf_status` precisam estar em `atende`.
- A capacidade precisa pertencer ao mesmo tenant, estar selecionada e com status `habilitada`.
- `client_radar_enrollments.participation_enabled` precisa estar ativo para a capacidade.
- Pendências abertas com impacto `bloqueia_categoria` ou `bloqueia_participacao` impedem a aprovação.
- Pendências não impeditivas geram ressalva sem liberar silenciosamente bloqueadores.
- Resultados possíveis: `aprovado`, `aprovado_com_ressalva`, `nao_aprovado`.
- Toda avaliação é histórica e gera `audit_events`.
- Função de avaliação está no schema `private`, SECURITY DEFINER, revogada de `anon` e `authenticated`, executável por `service_role` via Edge Function autenticada.
- A tabela de avaliações usa RLS para leitura por tenant e não permite escrita direta por usuário autenticado.

## Validação executada
1. Estado real da Luvi: Gate retornou `nao_aprovado`, identificando cadastro empresarial não validado, SICAF incompleto, capacidade em preparação, participação no Radar desabilitada e pendência impeditiva aberta.
2. Happy path transacional: cadastro empresarial temporariamente validado, seis níveis SICAF em `atende`, capacidade `habilitada`, participação habilitada e pendências impeditivas resolvidas; Gate retornou `aprovado` com zero bloqueadores.
3. Teste de isolamento: identidade sem membership/PLATFORM_OWNER não conseguiu executar avaliação de outro tenant.
4. Todos os testes mutáveis foram executados dentro de transações com rollback; nenhuma avaliação artificial permaneceu persistida.
5. Edge Function `participation-gate` está ACTIVE v1 e exige JWT válido.
6. Interface adicionada ao shell com execução explícita do Gate, evidências por requisito, bloqueadores, ressalvas e histórico.
7. Build Next.js e TypeScript aprovados no preview final da branch; deployment `dpl_3kkMHsRpKEbEU6Hu1PpCNrdV7Q5h` em READY.
8. Comparação com `main`: branch somente à frente, sem commits divergentes; alterações limitadas ao módulo do Gate, integração de navegação e este registro de blindagem.

## Revisão de segurança
Security Advisor não apontou alerta novo criado pelo Gate. Permanecem somente avisos anteriores: `get_client_dashboard_backend` autenticado como SECURITY DEFINER e proteção de senhas vazadas desabilitada no Auth.

## Revisão comprobatória
- Fluxo bloqueado real confirmado para cliente sem cadastro/SICAF completos.
- Fluxo aprovado controlado confirmado somente quando todos os requisitos obrigatórios foram satisfeitos.
- Isolamento de tenant confirmado por teste negativo.
- Persistência artificial após rollback: zero.
- Edge Function autenticada e função privilegiada privada confirmadas.
- Preview final READY e sem erro de compilação/TypeScript.

## Resultado
**APROVADO, VALIDADO, BLINDADO E LIBERADO PARA PROMOÇÃO À PRODUÇÃO.**
