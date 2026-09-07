# UNI Licitações Web — MVP

## OD-009 — Dashboard e Interface Operacional do Radar

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → VALIDADA → FECHADA.**

## Entregas concluídas

- Interface responsiva publicada no GitHub Pages.
- Radar com filtros por ciclo de vida: ativa, histórica, indeterminada e todas.
- Indicadores de oportunidades ativas, liberadas para participação, histórico e pendências bloqueadoras.
- Mercado Público Demandante — 12 meses.
- Central de Pendências.
- Estrutura visual de login e modo demonstração.
- Backend Supabase preparado com as views `client_radar_dashboard`, `client_radar_summary`, `market_demand_12m` e `client_pending_dashboard`.
- Nenhuma chave, token ou credencial está embutida no front-end.

## Limites preservados

Os dados exibidos no modo demonstração são fictícios e não podem ser usados para decisões reais. A carga histórica real completa de 12 meses do PNCP ainda não foi executada; portanto o painel não deve sugerir que essa base já esteja integralmente carregada.

O histórico serve para inteligência do Mercado Público Demandante e não deve ser tratado como oportunidade ativa. A liberação para participação depende da prontidão do cliente, do Radar e da decisão final aplicável; resultado favorável isolado de IA não libera participação.

## Segurança e integração

A tentativa de incorporar diretamente a chave pública do Supabase no front-end foi interrompida pela camada de segurança da ferramenta de desenvolvimento. Nenhum contorno foi aplicado e nenhum segredo foi publicado. A integração autenticada de produção deve ser concluída em etapa própria, utilizando um método de configuração aceito e auditável.

## Próxima etapa

A evolução seguinte deve tratar a integração autenticada do front-end com o Supabase, seleção do cliente por usuário, carregamento real das quatro views e testes de isolamento entre clientes antes de qualquer uso operacional real.
