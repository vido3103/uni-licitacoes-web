# UNI Licitações Web — MVP

## Status consolidado

**MVP: IMPLEMENTADO → TESTADO → REVISADO → AUDITADO → VALIDADO → FECHADO COM RESSALVAS OPERACIONAIS.**

O fechamento do MVP comprova a arquitetura multi-cliente, autenticação real, isolamento por cliente, onboarding, documentação/habilitação, readiness, Radar, ingestão PNCP, histórico/lifecycle, dashboard e configuração operacional da Luvi. Fechamento de MVP não equivale a liberação automática da Luvi para participar de licitações: os Gates documentais e comerciais continuam soberanos.

## OD-009 — Dashboard e Interface Operacional do Radar

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → VALIDADA → FECHADA.**

Entregas: interface responsiva publicada no GitHub Pages, Radar com filtros por ciclo de vida, indicadores operacionais, Mercado Público Demandante, Central de Pendências, modo demonstração e views de backend preparadas.

## OD-010 — Integração Autenticada do Front-end com Supabase

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → VALIDADA → FECHADA.**

- Primeiro cliente e usuário reais: Luvi Empilhadeiras, perfil administrativo.
- `od010-auth` autentica sem publicar chave administrativa no front-end.
- `od010-dashboard` valida a sessão, resolve o cliente por `client_members` e não aceita `client_id` arbitrário do navegador.
- Smoke test real de login da Luvi concluído.
- Dashboard v2 usa `supabase-js` 2.57.4 fixado e reporta dinamicamente a meta/status da carga histórica, removendo o caveat hardcoded de 12 meses.

## OD-011 — Configuração Operacional Real da Luvi

**Status: IMPLEMENTADA → TESTADA → REVISADA → VALIDADA → FECHADA.**

- Prompt Mestre v1.17 e Playbook Luvi v1.2 versionados.
- Produto e Locação selecionados; Serviço não selecionado.
- Capacidades em `em_preparacao`, Radar em `monitor_only` e participação não liberada.
- Filtro geográfico inicial SP.
- Termos de Radar: empilhadeiras/paleteiras, peças de empilhadeiras, linha automotiva, filtros, lubrificantes, baterias, elétrica e hidráulica; serviços de manutenção excluídos.
- Pendências de habilitação permanecem bloqueadoras da participação.

## OD-012 — PNCP real e validação do Radar

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → VALIDADA PARA MVP → FECHADA COM RESSALVA.**

### Critério aprovado para a Luvi

A exceção operacional da Luvi foi alterada de 12 meses para **30 dias (1 mês)** para acelerar o fechamento do MVP. A regra de produto para novos clientes permanece com histórico inicial de até 12 meses após o cadastro, conforme implementação definitiva do onboarding/coletor.

### Evidência real

- Fonte PNCP ativa no banco.
- Coletor `od012-pncp-collector` ativo, protegido por JWT, com dependência `supabase-js` fixada.
- Registros PNCP reais de SP validados contra o portal oficial, incluindo peças automotivas em Itapetininga/SP e item de empilhadeira elétrica do Metrô/SP.
- Deduplicação por `source_external_id` + hash e RPC de upsert validadas na arquitetura.
- Pré-filtro geográfico/deadline e estado `monitor_only` validados; nenhuma oportunidade foi indevidamente liberada para participação.
- Uma função temporária de backfill foi criada durante o teste, não foi usada como endpoint operacional permanente e foi imediatamente fechada, retornando `410 job_closed` e exigindo JWT na versão final.

### Ressalva da carga histórica

A execução automatizada integral dos 30 dias não pôde ser disparada pelo canal administrativo usado nesta auditoria porque chamadas HTTP assíncronas do banco para a Edge Function foram bloqueadas pelo controle de segurança da ferramenta. Por integridade de auditoria, `initial_load_status` permanece `pending`; ele **não foi falsamente promovido para `completed`**. Isso não invalida a arquitetura nem o teste real do Radar, mas a primeira execução integral do backfill continua como tarefa operacional pós-MVP.

## Auditoria final do MVP

### Segurança

Auditoria Supabase executada após as alterações finais. Não foi identificado alerta crítico. Permanecem avisos conhecidos:

1. Tabelas backend-only de ingestão com RLS habilitado e sem policy de usuário — desenho intencional para acesso via backend/service role.
2. `create_client_with_owner` e `is_client_member` são `SECURITY DEFINER`; precisam permanecer sob revisão de privilégio antes de produção em escala. A primeira atende ao fluxo de onboarding e a segunda participa da autorização/RLS existente.
3. Proteção de senha vazada do Supabase Auth ainda desativada — ação recomendada antes de produção pública.
4. Há FKs sem índices e policies permissivas redundantes apontadas pelo advisor de performance; são dívida de otimização, não bloqueador funcional do MVP.

### Gates preservados

A Luvi permanece em monitoramento e **não está liberada para participação automática** enquanto habilitação/documentação, compatibilidade comercial e demais Gates aplicáveis não forem concluídos. O sistema não usa percentual visual de prontidão para superar bloqueadores.

## Fechamento

O MVP está formalmente fechado **com ressalvas operacionais explícitas**, sem ocultar pendências. Próxima fase é produção controlada: executar o backfill inicial da Luvi, migrar/validar o acervo documental, habilitar proteção de senha vazada, otimizar índices/policies e realizar o smoke test final de operação com sessão autenticada quando necessário.