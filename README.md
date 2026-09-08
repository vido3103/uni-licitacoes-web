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

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → VALIDADA PARA MVP.**

### Critério vigente

Em 08/09/2026 foi aprovada a baseline definitiva de implantação: **6 meses retroativos iniciais + acumulação permanente dos novos dados monitorados**. Não existe obrigação de executar uma expansão retroativa adicional para 12 meses. O histórico cresce organicamente com a operação normal do Radar e os dados já coletados nunca são descartados.

Os enrollments operacionais da Luvi usam `initial_history_months = 6`. A janela inicial considerada para a implantação é março a agosto de 2026; setembro/2026 passa a integrar o fluxo incremental corrente.

Dados anteriores já existentes continuam preservados como patrimônio histórico do UNI, mas não constituem requisito de fechamento da carga inicial.

### Evidência real

- Fontes PNCP, Compras.gov.br e CPTM presentes na arquitetura multifuente.
- Compras.gov.br: janela março–agosto/2026 da modalidade 6 processada até paginação terminal em todos os seis meses, sem execução pendente nessa janela.
- Totais da carga mensal validada: março 9.732; abril 9.093; maio 11.014; junho 9.803; julho 11.004; agosto 10.514 registros processados.
- Agosto reconheceu 3.461 registros previamente existentes, preservando idempotência/deduplicação.
- PNCP possui dados reais persistidos e cadeia de auditoria; falhas/timeouts não são convertidos em falsa conclusão.
- Deduplicação multifuente endurecida: `canonical_key` passou a ser gravada pela função de ingestão em INSERT e UPDATE e todo o acervo existente foi retroativamente normalizado.
- Após a correção, 99.229 registros armazenados apresentaram 0 `canonical_key` nula.
- Na janela março–agosto foram validados 62.681 registros físicos e 62.674 identidades canônicas, com 7 sobreposições multifuente preservando a proveniência de cada fonte.
- Pré-filtro geográfico/deadline e estado `monitor_only` validados; nenhuma oportunidade foi indevidamente liberada para participação.

### Regra de crescimento histórico

O UNI não executará uma segunda carga retroativa apenas para atingir 12 meses. A base inicial de 6 meses permanece armazenada e o Radar adiciona continuamente os editais atuais. Aproximadamente seis meses de operação acrescentam naturalmente mais seis meses ao acervo, formando cerca de 12 meses de histórico sem retrabalho retroativo. O mesmo princípio mantém o crescimento para 18, 24 meses e além.

## Auditoria de blindagem

### Identidade e proveniência

A função `upsert_public_opportunity_from_source` foi corrigida para persistir identidade canônica em novos registros e atualizações. Foi adicionado fallback seguro por identificador externo para fontes sem número de controle PNCP, incluindo CPTM. A view canônica mantém prioridade de proveniência PNCP → Compras.gov.br → fontes complementares sem apagar registros físicos das demais fontes.

### Segurança

Após a blindagem, as views apontadas pelo advisor como `SECURITY DEFINER` foram convertidas para `security_invoker`, incluindo as views de Radar, mercado, identidade canônica e proveniência. O `search_path` da função de identidade canônica foi fixado.

Permanecem avisos não críticos conhecidos:

1. Tabelas backend-only de ingestão com RLS habilitado e sem policy de usuário — desenho intencional para acesso via backend/service role.
2. `create_client_with_owner` é `SECURITY DEFINER` porque cria o cliente e associa exclusivamente `auth.uid()` como owner; `is_client_member` é helper `SECURITY DEFINER` que consulta associação do próprio `auth.uid()`. Ambos têm `search_path` fixo e permanecem sob controle de autenticação.
3. Proteção de senha vazada do Supabase Auth ainda desativada — recomendada antes de produção pública.

### Regressão do Radar Luvi

A regressão confirmou 3 linhas no dashboard para 3 oportunidades distintas; 2 atuais e 1 histórica. Nenhuma foi liberada para participação. A Luvi permanece corretamente em monitoramento enquanto seus Gates documentais/comerciais aplicáveis não forem concluídos.

## Gates preservados

A Luvi permanece em monitoramento e **não está liberada para participação automática** enquanto habilitação/documentação, compatibilidade comercial e demais Gates aplicáveis não forem concluídos. O sistema não usa percentual visual de prontidão para superar bloqueadores.

## Fechamento

A baseline histórica de implantação está formalmente definida em **6 meses retroativos, seguida de crescimento incremental permanente**. A antiga obrigação de 12 meses retroativos foi revogada. Dados históricos mais antigos já existentes permanecem preservados e não serão apagados.

O projeto mantém separação entre: (a) integridade técnica do MVP/Radar; e (b) liberação de cada cliente para participar de uma licitação, que continua subordinada aos Gates do Prompt Mestre e do Playbook aplicável.