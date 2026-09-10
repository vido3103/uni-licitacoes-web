# UNI LICITAÇÕES — Execução da Lista de 23 Itens Aprovados

Data: 10/09/2026
Status: EM EXECUÇÃO / BLINDAGEM
Baseline metodológica preservada: Prompt Mestre v1.17 + Playbook Operacional Luvi v1.2.

## Deliberação

Os 23 itens da lista atualizada foram aprovados pelo usuário para execução. Esta implementação não altera silenciosamente o Prompt Mestre nem o Playbook; mudanças metodológicas continuam sujeitas a propagação, auditoria e promoção explícita.

## Complementações vinculantes

- Item 5 — PNCP e Compras.gov.br são as fontes oficiais principais do Radar.
- Item 7 — ao abrir uma oportunidade, o UNI deve localizar os anexos oficiais do PNCP, tentar baixá-los e disponibilizá-los para leitura/absorção pela Análise Detalhada.
- Item 8 — contingência obrigatória: confirmar a existência do documento → tentar acesso/download/leitura automática → quando falhar, manter o acesso à fonte oficial → permitir upload manual → incorporar o arquivo manual à análise.

## Implementação técnica desta rodada

1. `Radar.tsx` já executa triagem e sincronização documental ao abrir a oportunidade, mostra o estado da sincronização, mantém o botão de fonte oficial e oferece upload manual.
2. `opportunity-document-sync` foi incorporada ao controle de versão e publicada como Edge Function autenticada (`verify_jwt=true`).
3. A função valida usuário, membership e vínculo cliente-oportunidade antes de qualquer acesso privilegiado.
4. A função consulta a API oficial do PNCP para a lista de arquivos da contratação e tenta baixar até 25 anexos por execução.
5. Downloads são restritos a HTTPS e hosts oficiais `pncp.gov.br`/`.gov.br`, com timeout, limite de 50 MB e lista controlada de formatos.
6. Arquivos obtidos são gravados no bucket `opportunity-documents` e registrados em `opportunity_documents`, com proveniência PNCP e `absorption_state=available_for_analysis`.
7. Falha parcial ou total não é tratada como inexistência do documento: o retorno é `partial` ou `manual_required`, preservando a fonte oficial e o fluxo de upload manual.
8. O upload manual continua segregado por `client_id` e `opportunity_id` e é elegível para a Análise Detalhada.

## Gate de blindagem

A publicação da Edge Function não encerra a rodada. Antes de fechar os 23 itens como BLINDADOS, executar regressão autenticada com pelo menos: (a) oportunidade PNCP com PDF acessível; (b) oportunidade com múltiplos anexos; (c) anexo com falha de download; (d) usuário sem membership; (e) oportunidade fora do cliente; (f) upload manual após falha; (g) fila da Análise Detalhada reconhecendo os documentos disponíveis.

Resultado esperado: nenhum erro técnico pode ser interpretado como ausência documental; a participação continua subordinada aos Gates do método UNI.