# Radar — Filtros oficiais Compras.gov.br

Status: APROVADO PARA IMPLEMENTAÇÃO
Data: 2026-09-10

## Objetivo

O módulo Radar deve oferecer pesquisa apurada utilizando os parâmetros oficiais expostos pela API de Dados Abertos do Compras.gov.br para contratações sob a Lei 14.133/2021, sem substituir os filtros inteligentes do perfil/capacidade do cliente.

## Filtros de contratação

Parâmetros oficiais do endpoint `1_consultarContratacoes_PNCP_14133`:

- Período de publicação PNCP — data inicial e final (`dataPublicacaoPncpInicial`, `dataPublicacaoPncpFinal`).
- Modalidade (`codigoModalidade`).
- Unidade/UASG (`unidadeOrgaoCodigoUnidade`).
- Órgão (`codigoOrgao`).
- CNPJ do órgão/entidade (`orgaoEntidadeCnpj`).
- Município por código IBGE (`unidadeOrgaoCodigoIbge`).
- UF (`unidadeOrgaoUfSigla`).
- Data de atualização no PNCP (`dataAtualizacaoPncp`).
- Amparo legal PNCP (`amparoLegalCodigoPncp`).
- Contratação excluída (`contratacaoExcluida`).
- Paginação (`pagina`).
- Quantidade por página (`tamanhoPagina`, respeitando o limite oficial).

## Filtros complementares do UNI

A interface do Radar também deve permitir, sobre a base normalizada já coletada:

- Palavra-chave / objeto / descrição.
- Número do processo.
- Órgão/comprador por nome.
- Cidade.
- Situação/prazo da oportunidade.
- Fonte: PNCP, Compras.gov.br ou CPTM.
- Compatibilidade com capacidade/categoria do cliente.
- Resultado da triagem determinística.
- Participação liberada/bloqueada.
- Faixa de valor estimado quando disponível.

Esses filtros são internos do UNI e não devem ser enviados como parâmetros oficiais quando a API de origem não os suportar.

## Pesquisa de itens

Para pesquisa mais precisa de produtos, o UNI deve suportar também os filtros disponibilizados pelo endpoint de itens `2_consultarItensContratacoes_PNCP_14133`, incluindo os identificadores de órgão/unidade e a situação do item quando suportados pela API, além de paginação. O resultado deve ser associado à oportunidade canônica, e não criar uma oportunidade duplicada.

## Regras de blindagem

1. Nunca inventar parâmetro não documentado como se fosse filtro oficial do Compras.gov.br.
2. Separar visualmente filtros da fonte oficial e filtros inteligentes do UNI.
3. Combinações de filtros devem ser persistíveis como configuração do Radar do cliente futuramente.
4. PNCP, Compras.gov.br e CPTM alimentam uma oportunidade canônica única; múltiplas fontes devem ser preservadas como evidência/origem, sem duplicação no Radar.
5. Filtros de paginação são operacionais e não precisam ocupar o painel principal; a UI pode tratar paginação automaticamente.
6. O backend deve respeitar limites de janela, paginação e tamanho de página das APIs oficiais.
7. Falha de uma fonte não elimina oportunidade obtida por outra fonte oficial.

## Referência oficial

Validado contra a documentação oficial da API de Dados Abertos do Compras.gov.br, Manual da API v2.0 (2026) e documentação interativa oficial.