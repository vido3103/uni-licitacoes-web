# Radar — Monitoramento orientado ao Perfil de Capacidade do CNPJ

Status: APROVADO
Data: 2026-09-10

## Regra central

O Radar não deve depender de pesquisas manuais para localizar oportunidades. Cada cliente terá um Perfil de Capacidade de Fornecimento versionado, associado ao seu CNPJ, e esse perfil orientará o monitoramento automático das fontes oficiais habilitadas.

Fluxo-base:

CNPJ → Perfil da empresa → Capacidade de fornecimento → Coleta oficial → Deduplicação → Compatibilidade → Radar → Triagem → Análise.

## Composição do perfil

O perfil não será limitado ao CNAE. CNAEs e atividades econômicas são evidências cadastrais, mas a capacidade de fornecimento deverá considerar conjuntamente, conforme disponibilidade e validação:

- dados cadastrais oficiais associados ao CNPJ;
- CNAEs/atividades;
- produtos e serviços declarados pelo cliente;
- categorias e capacidades aprovadas no onboarding;
- documentos e habilitações relevantes;
- fornecedores, catálogos e linhas efetivamente atendidas quando cadastrados;
- restrições e exclusões expressas pelo cliente;
- histórico operacional validado, quando aplicável.

Alterações do perfil devem gerar nova versão e preservar rastreabilidade. Informações operacionais internas não devem ser sobrescritas silenciosamente por atualização cadastral externa.

## Classificação de compatibilidade

O mecanismo de matching deve permitir pelo menos:

1. COMPATÍVEL — evidência suficiente de que a oportunidade pertence à capacidade cadastrada;
2. POSSIVELMENTE COMPATÍVEL — há sinais relevantes, mas faltam dados para decisão determinística;
3. INCOMPATÍVEL — objeto/item ou restrição exclui a capacidade cadastrada.

O objetivo é evitar tanto falsos positivos quanto a perda de oportunidades legítimas por dependência exclusiva de CNAE ou palavras-chave.

## Fontes

Fontes atualmente autorizadas:

- PNCP;
- Compras.gov.br;
- CPTM — sujeita à deduplicação cruzada obrigatória.

Uma contratação encontrada em múltiplas fontes deve resultar em uma única oportunidade canônica no Radar, preservando as fontes/origens como evidência e rastreabilidade.

## Filtros de pesquisa

Os filtros oficiais do Compras.gov.br e os filtros avançados do UNI permanecem disponíveis para pesquisa exploratória, refinamento e auditoria. Eles são complementares ao monitoramento automático orientado pelo perfil do cliente e não substituem o Perfil de Capacidade.

## Blindagem

Antes de liberar o monitoramento automático por CNPJ, validar ponta a ponta:

CNPJ/onboarding → versão do perfil → capacidades → coletores → normalização → deduplicação → matching → Radar → triagem.

Testar obrigatoriamente: isolamento por tenant, atualização versionada do perfil, inclusão/exclusão de capacidade, duplicidade entre fontes, oportunidade compatível, possivelmente compatível e incompatível, além de contingência para falha de uma fonte sem interromper as demais.
