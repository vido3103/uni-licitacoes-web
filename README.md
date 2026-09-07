# UNI Licitações Web — MVP

## Status consolidado

**MVP: IMPLEMENTADO → TESTADO → REVISADO → AUDITADO → VALIDADO → FECHADO COM RESSALVAS OPERACIONAIS.**

O fechamento do MVP comprova a arquitetura multi-cliente, autenticação real, isolamento por cliente, onboarding, documentação/habilitação, readiness, Radar, ingestão multifuente, histórico/lifecycle, dashboard e configuração operacional da Luvi. Fechamento de MVP não equivale a liberação automática da Luvi para participar de licitações: os Gates documentais e comerciais continuam soberanos.

## OD-009 — Dashboard e Interface Operacional do Radar

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → VALIDADA → FECHADA.**

Entregas: interface responsiva publicada no GitHub Pages, Radar com filtros por ciclo de vida, indicadores operacionais, Mercado Público Demandante, Central de Pendências, modo demonstração e views de backend preparadas.

## OD-010 — Integração Autenticada do Front-end com Supabase

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → VALIDADA → FECHADA.**

- Primeiro cliente e usuário reais: Luvi Empilhadeiras, perfil administrativo.
- `od010-auth` autentica sem publicar chave administrativa no front-end.
- `od010-dashboard` valida a sessão, resolve o cliente por `client_members` e não aceita `client_id` arbitrário do navegador.
- Smoke test real de login da Luvi concluído.
- Dashboard reporta dinamicamente a meta e o status da carga histórica.

## OD-011 — Configuração Operacional Real da Luvi

**Status: IMPLEMENTADA → TESTADA → REVISADA → VALIDADA → FECHADA.**

- Prompt Mestre v1.17 e Playbook Luvi v1.2 versionados.
- Produto e Locação selecionados; Serviço não selecionado.
- Capacidades em `em_preparacao`, Radar em `monitor_only` e participação não liberada.
- Filtro geográfico inicial SP.
- Termos de Radar: empilhadeiras/paleteiras, peças de empilhadeiras, linha automotiva, filtros, lubrificantes, baterias, elétrica e hidráulica; serviços de manutenção excluídos.
- Pendências de habilitação permanecem bloqueadoras da participação.

## OD-012 — Ingestão oficial e validação do Radar

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → VALIDADA PARA MVP → FECHADA COM RESSALVA DE COMPLETUDE HISTÓRICA.**

### Critério vigente

A exceção temporária de **30 dias (1 mês)** da Luvi foi **REVOGADA em 07/09/2026**. A Luvi volta a seguir a regra estrutural do UNI: **12 meses de histórico inicial**, construídos e validados mês a mês. Os dois enrollments operacionais da Luvi foram atualizados no banco para `initial_history_months = 12`.

Nenhum dado já coletado será descartado. O acervo existente passa a compor os 12 meses e a deduplicação evita regravações desnecessárias. Após a carga histórica, o modelo permanece incremental, preservando indefinidamente os registros anteriores.

### Evidência real

- Fontes PNCP, Compras.gov.br e CPTM presentes na arquitetura multifuente.
- PNCP possui dados reais persistidos e cadeia de auditoria; falhas/timeouts não são convertidos em falsa conclusão.
- Compras.gov.br possui coletor com autenticação interna pela chave moderna `uni_automation`, persistência real, hash/deduplicação e paginação controlada.
- Teste de paginação do Compras.gov.br confirmou chamadas unitárias de 500 registros com `next_page`, evitando timeout de execuções longas.
- Deduplicação por identidade oficial da fonte + hash preservada.
- Pré-filtro geográfico/deadline e estado `monitor_only` validados; nenhuma oportunidade foi indevidamente liberada para participação.

### Regra de completude

`initial_load_status` deve permanecer `pending`/`in_progress` até que a cadeia de evidências comprove a conclusão das janelas mensais exigidas. Volume de registros armazenados, isoladamente, não autoriza promoção para `completed`.

## Auditoria final do MVP

### Segurança

Auditoria Supabase executada após as alterações. Não foi identificado alerta crítico. Permanecem avisos conhecidos:

1. Tabelas backend-only de ingestão com RLS habilitado e sem policy de usuário — desenho intencional para acesso via backend/service role.
2. `create_client_with_owner` e `is_client_member` são `SECURITY DEFINER`; permanecem sob revisão de privilégio antes de produção em escala.
3. Proteção de senha vazada do Supabase Auth ainda desativada — recomendada antes de produção pública.
4. FKs sem índices e policies permissivas redundantes apontadas pelo advisor de performance permanecem como dívida de otimização.

### Gates preservados

A Luvi permanece em monitoramento e **não está liberada para participação automática** enquanto habilitação/documentação, compatibilidade comercial e demais Gates aplicáveis não forem concluídos. O sistema não usa percentual visual de prontidão para superar bloqueadores.

## Fechamento

O MVP permanece formalmente fechado **com ressalva operacional de completude histórica**, agora sob a regra definitiva de **12 meses também para a Luvi**. A produção controlada deve completar as janelas mensais com evidência, preservar a ingestão incremental e concluir as pendências documentais/Gates antes da participação.