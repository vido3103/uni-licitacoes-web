# Blindagem — Checkpoint Radar / Triagem / Documentos / Análise

Data: 2026-09-10
Branch: `interface-profissional-v1`
Escopo: Radar de Licitações → abertura da oportunidade → triagem preliminar → tentativa de obtenção de documentos PNCP → upload manual → fila de Análise Detalhada.

## Objetivo
Aplicar o Método de Blindagem ao primeiro fluxo vertical funcional do sistema, revisando não apenas o erro visível, mas também todas as dependências técnicas diretamente relacionadas, persistência, segurança multi-tenant e documentação viva.

## Achados da reauditoria

### BLD-RADAR-01 — Referências residuais ao helper antigo de membership
Após a correção inicial das funções de triagem, a reauditoria encontrou outras funções PostgreSQL ainda chamando `public.is_client_member(...)`, enquanto o helper válido está no schema `private`.

Funções residuais encontradas:
- `evaluate_opportunity_participation`
- `recalculate_category_readiness`
- `record_opportunity_ai_result`
- `sync_document_pending_items`
- `sync_radar_enrollment`
- `sync_sicaf_pending_items`

Ações executadas:
- todas as referências foram migradas para `private.is_client_member(...)`;
- `search_path` das funções afetadas foi ajustado para incluir `private`;
- consulta de reauditoria confirmou `0` referências restantes a `public.is_client_member(...)` nas funções do banco.

Status: **CORRIGIDO E REAUDITADO**.

### BLD-RADAR-02 — Cadeia de triagem
Cadeia validada:
`run_deterministic_triage` → `prefilter_opportunity` → `evaluate_operational_readiness` → `match_opportunity_capability` → `opportunity_triage_runs` / `client_opportunity_matches`.

Teste autenticado já executado com oportunidade real do Radar e tenant existente:
- resultado da triagem: `queued_for_ai`;
- criação de fila de análise: concluída com sucesso em teste transacional;
- teste sem persistência artificial permanente.

Status: **VALIDADO NO BACKEND**.

### BLD-RADAR-03 — Upload de documentos
O fluxo de upload manual foi corrigido para preservar a seleção de arquivos antes da limpeza do input. A interface passou a copiar os arquivos para memória antes do envio e apresenta progresso de upload.

Evidência operacional observada em teste do usuário:
- 4 documentos anexados;
- documentos persistidos e listados na oportunidade;
- botão de Análise Detalhada liberado após disponibilidade dos documentos.

Status: **VALIDADO OPERACIONALMENTE**.

## Pontos ainda abertos antes de considerar o fluxo blindado

1. Padronizar serialização de erros no frontend para impedir mensagens como `[object Object]`.
2. Reexecutar teste completo no browser após as correções de membership.
3. Confirmar que a tentativa automática de documentos PNCP distingue corretamente `documento inexistente`, `documento disponível` e `falha técnica de download`.
4. Conectar e validar o worker que consome `opportunity_ai_analysis_queue` e grava o resultado completo da Análise Detalhada.
5. Validar retorno do resultado da análise para a interface e gates posteriores.
6. Reauditar RLS e isolamento tenant do fluxo completo após a inclusão do worker.

## Critério de fechamento
O módulo só poderá receber status **BLINDADO** quando a cadeia abaixo passar de ponta a ponta sem intervenção técnica:

`Radar → Abrir → Triagem → PNCP → Documentos → Upload de contingência → Fila → Worker IA → Resultado → Gates → Interface → Auditoria`.

Até lá, o estado oficial deste módulo é: **BLINDAGEM EM ANDAMENTO**.
