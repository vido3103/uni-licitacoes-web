# Escopo de Integrações Oficiais

Status: APROVADO
Data: 2026-09-10

## Fontes oficiais ativas

A plataforma deverá integrar, neste estágio, exclusivamente com:

1. PNCP — Portal Nacional de Contratações Públicas
2. Compras.gov.br — API/Dados Abertos oficiais

## Regra operacional

- Novas coletas automáticas deverão utilizar apenas essas duas fontes.
- Outras fontes ficam fora do escopo ativo até nova aprovação.
- Fontes anteriormente cadastradas podem permanecer no histórico técnico, porém desativadas para novas integrações/coletas.
- Dados históricos já ingeridos não devem ser apagados apenas por mudança de escopo.
- O Radar deve continuar aplicando normalização, deduplicação, filtros por cliente e matching independentemente da fonte de origem.
- PNCP e Compras.gov.br devem ser tratados como fontes complementares, com deduplicação entre registros equivalentes.
- Falha de download documental no PNCP não implica inexistência do documento; mantém-se a contingência de acesso à fonte oficial e upload manual.

## Situação atual

- `pncp`: ativo
- `compras_gov_br`: ativo
- `cptm_portal`: desativado

## Blindagem

Qualquer alteração futura na lista de fontes oficiais deverá atualizar simultaneamente:

1. configuração do banco;
2. coletores/Edge Functions;
3. regras de deduplicação;
4. interface do Radar;
5. documentação operacional.

Nenhuma nova fonte deve ser ativada silenciosamente.
