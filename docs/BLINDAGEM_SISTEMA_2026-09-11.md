# Blindagem do sistema — 11/09/2026

## Resultado desta etapa

Esta etapa corrige bloqueios reproduzíveis do repositório e fecha a implementação da issue #1 sem declarar o sistema integralmente concluído antes da validação em produção.

### Corrigido

- instalação limpa reproduzível com `npm ci`;
- configuração ESLint compatível com a versão instalada;
- Quality Gate automatizado com lint, TypeScript, testes e build;
- serialização única de erros do Radar;
- separação visual entre monitoramento por Perfil de Capacidade e pesquisa exploratória;
- filtros principais do UNI e filtros oficiais avançados do Compras.gov.br;
- paginação limitada a 100 registros por chamada;
- RPC de pesquisa autenticada sem exposição do payload bruto oficial;
- enfileiramento idempotente e protegido por trava transacional;
- revalidação, no banco, da triagem vigente, compatibilidade e existência de documento disponível;
- ordenação monotônica das execuções de triagem, eliminando empate de `created_at`;
- reabertura controlada de filas em `failed`/`retry_wait`;
- revogação explícita de acesso anônimo aos RPCs operacionais;
- cobertura por índice de todas as chaves estrangeiras sinalizadas pelo advisor;
- otimização das políticas RLS para resolver `auth.uid()` uma vez por comando;
- testes regressivos para erro estruturado, normalização de filtros e bloqueio da Análise Detalhada.

## Limites preservados

1. A pesquisa exploratória não altera o Perfil de Capacidade nem os enrollments automáticos do cliente.
2. Paginação é operacional e não é enviada como filtro sem limite.
3. PNCP, Compras.gov.br e CPTM continuam vinculados à oportunidade canônica existente.
4. O frontend não recebe `source_payload` bruto.
5. A fila não é apresentada como análise concluída.

## Pendência externa real

O executor/worker de IA ainda precisa de provedor, credencial, política de custo e validação do Prompt Mestre/Playbook. Essa dependência não pode ser encerrada apenas com código de interface e permanece um Gate explícito.

## Estado operacional observado

- 1 usuário autenticado, 1 cliente e 1 vínculo `owner` válido;
- 126.324 oportunidades normalizadas, sendo 124.444 do Compras.gov.br;
- nenhum Perfil de Capacidade, capacidade ou enrollment configurado ainda;
- nenhuma execução de IA ou dado sintético foi deixado pela regressão transacional.

Por isso, login e pesquisa exploratória têm base real, mas o monitoramento personalizado só produzirá matches depois que o onboarding empresarial criar o Perfil de Capacidade e os enrollments.

## Alertas residuais dos advisors

- Os três avisos de função `SECURITY DEFINER` autenticada são intencionais: os RPCs precisam ultrapassar RLS para executar a operação, revogam `anon` explicitamente e validam o vínculo do cliente dentro da função.
- A proteção contra senhas vazadas permanece desabilitada no Auth e deve ser ligada no painel do Supabase antes da promoção final.
- O aviso de índices recém-criados como “não utilizados” é esperado até haver tráfego suficiente; os alertas de chave estrangeira sem índice e de `auth.uid()` por linha foram eliminados.
- A inspeção visual local automatizada precisa ser repetida em ambiente com navegador headless disponível; o runner atual não conseguiu baixar o Chrome por falha de certificado.

## Critério de promoção

Promover somente após:

1. `npm ci` PASS;
2. `npm run check` PASS;
3. migração aplicada e testada com usuário autenticado;
4. pesquisa Compras.gov.br/PNCP/CPTM sem duplicidade;
5. tentativa de enfileiramento bloqueada para `filtered_out` e sem documento;
6. nova execução dos advisors de segurança e performance;
7. validação visual desktop e mobile.
