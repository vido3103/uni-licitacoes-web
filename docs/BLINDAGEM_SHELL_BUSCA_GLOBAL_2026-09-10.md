# Blindagem — Busca Global do Shell

Data: 2026-09-10
Branch: `interface-profissional-v1`

## Escopo

Correção da integração entre a busca global do cabeçalho e a página Editais.

## Problema identificado

O shell gravava o termo em `sessionStorage` usando a chave `uni-global-search` e navegava para Editais, porém a página Editais não consumia esse valor. A navegação ocorria, mas a pesquisa não era aplicada automaticamente.

## Correção aplicada

A página `src/modules/editais/Editais.tsx` passou a:

- ler `uni-global-search` ao montar;
- normalizar o valor com `trim()`;
- remover a chave de `sessionStorage` após o consumo para evitar repetição involuntária;
- preencher o campo de pesquisa;
- aplicar imediatamente o termo em `appliedQuery`;
- reiniciar a paginação na página 1;
- ignorar valores vazios.

Commit funcional: `efd29684469cbc80ac3111a40b2e1ef55455ec29` — `fix(search): apply global query in Editais`.

## Validação

- Deploy de preview disparado automaticamente pelo GitHub/Vercel.
- Deployment: `dpl_CSuL5iW7TXNWVyF1A2astMfBhj1K`.
- Branch: `interface-profissional-v1`.
- Commit validado: `efd29684469cbc80ac3111a40b2e1ef55455ec29`.
- Estado final do deployment: `READY`.
- Next.js: 16.3.4.
- Build otimizado: compilado com sucesso.
- TypeScript: concluído sem erro.
- Logs de runtime consultados para o preview: nenhum erro/fatal encontrado no período verificado.
- O warning conhecido de `unrs-resolver@1.12.2` em `allowScripts` permanece apenas como aviso de instalação, sem falha de build.

## Resultado da blindagem

A integração shell → Editais deixa de ter a pendência de propagação do termo de busca. A busca local da página continua preservada e o mecanismo global agora entrega o termo para o módulo de destino de forma consumível e descartável.

## Segurança e isolamento

A alteração é exclusivamente de estado de interface no navegador. Não altera autenticação, RLS, tenant, banco de dados, RPCs, storage ou regras de permissão. A consulta continua operando sobre os dados do tenant autenticado carregados pelo backend já consolidado.

## Produção

Nenhuma alteração foi promovida para `main` nesta blindagem. A produção permanece no checkpoint estável anterior até Gate explícito de promoção.

## Pendência deliberadamente fora do escopo

O motor/worker da Análise Detalhada continua pendente por decisão arquitetural. Não foi ativado provedor de IA pago nem realizada integração do Prompt Mestre. Antes dessa integração permanece obrigatório o Gate de atualização, testes, reauditoria e blindagem da nova baseline do Prompt Mestre/Playbook.

**Status:** BLINDAGEM CONCLUÍDA NO AMBIENTE DE DESENVOLVIMENTO.
