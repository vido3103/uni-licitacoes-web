# UNI Licitações Web — MVP

## Status consolidado

**MVP ESTRUTURAL: IMPLEMENTADO. BLINDAGEM OPERACIONAL: EM ANDAMENTO.**

A arquitetura multi-cliente, autenticação, isolamento por cliente, onboarding, documentação/habilitação, Radar, ingestão multifuente, histórico/lifecycle e módulos operacionais estão implementados. O executor real da Análise Detalhada por IA e a validação ponta a ponta até o resultado continuam pendentes; portanto, o repositório não deve ser descrito como sistema integralmente concluído.

Baseline metodológica vigente: **Prompt Mestre v1.17**. Perfil e Playbook permanecem específicos por cliente; para a Luvi, **Playbook Operacional v1.2**.

## Fluxo funcional preservado

Cadastro → Diagnóstico → Documentos/SICAF → Capacidade → Prontidão → Radar → Participação → Resultado.

## OD-009 — Dashboard e Interface Operacional do Radar

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → VALIDADA → FECHADA.**

Interface responsiva publicada no GitHub Pages, Radar com filtros por ciclo de vida, indicadores operacionais, Mercado Público Demandante, Central de Pendências, modo demonstração e views de backend preparadas.

## OD-010 — Integração Autenticada do Front-end com Supabase

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → VALIDADA → BLINDADA → FECHADA.**

- `od010-auth` realiza a autenticação inicial sem publicar chave administrativa no front-end.
- `od010-dashboard` exige JWT válido no gateway, revalida a sessão, resolve o cliente por `client_members` e não aceita `client_id` arbitrário do navegador.
- Dashboard reporta dinamicamente a meta e o estado da carga histórica.
- Segredos administrativos permanecem somente no backend.

## OD-011 — Configuração Operacional da primeira cliente

**Status: IMPLEMENTADA → TESTADA → REVISADA → VALIDADA → FECHADA.**

A configuração cliente-específica permanece segregada da arquitetura universal do UNI. Para a Luvi, Produto e Locação estão em monitoramento; Serviço permanece fora da seleção operacional vigente. A participação automática continua bloqueada enquanto os Gates aplicáveis não forem concluídos.

## OD-012 — Ingestão oficial e validação do Radar

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → BLINDADA → VALIDADA → FECHADA PARA O MVP.**

### Baseline histórica vigente

A baseline funcional original foi preservada: **carga histórica móvel inicial de 12 meses + atualização contínua e incremental + histórico permanente**.

A janela inicial comprovada cobre **01/09/2025 a 31/08/2026**. Setembro/2026 integra o fluxo incremental corrente.

Os enrollments operacionais estão configurados com `initial_history_months = 12`, `initial_load_status = completed` e `incremental_sync_enabled = true`.

### Evidência final em 08/09/2026

- Compras.gov.br: paginação terminal comprovada mês a mês de setembro/2025 a agosto/2026.
- Setembro/2025: 25 páginas concluídas.
- Outubro/2025: 28 páginas concluídas.
- Novembro/2025 a agosto/2026: todos os meses com evidência de paginação terminal registrada.
- Setembro/2026: ingestão incremental corrente validada no Compras.gov.br e no PNCP.
- PNCP em 08/09/2026, modalidade testada: páginas 1 a 13 processadas até `complete=true`.
- Acervo final desta blindagem: **126.324 oportunidades estruturais**.
- Identidades canônicas únicas: **126.324**.
- `canonical_key` nula: **0**.
- Duplicações canônicas: **0**.
- Cobertura de publicação armazenada: **01/09/2025 a 08/09/2026**.
- Fontes oficiais/estruturadas cadastradas: PNCP, Compras.gov.br e portal CPTM.
- Logs de ingestão em estado `running` após o fechamento: **0**.

### Identidade e proveniência

A identidade canônica é soberana entre fontes. Sobreposições multifuente não geram oportunidades duplicadas; a proveniência de cada origem permanece registrada por snapshots. Foi criado índice único sobre `canonical_key` e a função de upsert foi blindada para reutilizar a identidade canônica existente antes de criar nova oportunidade.

## Blindagem de segurança

Resultado da regressão final:

- **42/42 tabelas públicas com RLS habilitado.**
- Teste autenticado do proprietário: acesso somente ao próprio cliente e seus registros.
- Teste autenticado com UUID externo sem vínculo: `clients = 0`, `profiles = 0`, `enterprise = 0`, matches = 0.
- Helper de membership foi removido do schema público e mantido em schema privado.
- Funções `SECURITY DEFINER` críticas foram endurecidas com `search_path` controlado.
- O bootstrap de cliente possui trava para impedir criação/vínculo múltiplo do mesmo usuário e índice único para evitar condição de corrida.
- Tabelas privadas de cliente não concedem privilégios anônimos.
- Views operacionais sensíveis usam o modelo de segurança compatível com RLS.

### Avisos conhecidos não bloqueadores

1. `opportunity_ingestion_log`, `opportunity_source_snapshots` e `radar_ingestion_cursors` permanecem com RLS e sem policy de usuário por desenho: são tabelas backend-only e operam em deny-by-default para usuários comuns.
2. `create_client_with_owner` permanece `SECURITY DEFINER` e executável por usuário autenticado porque é o RPC de bootstrap; a função exige `auth.uid()`, cria somente o próprio vínculo como owner e possui trava de unicidade de membership.
3. A proteção de senhas vazadas do Supabase Auth permanece desativada e deve ser habilitada quando disponível/adequada ao plano antes de uma abertura pública de produção.
4. Avisos de performance referentes a FKs menos críticas e índices ainda sem uso não são Gate de integridade; os índices críticos do fluxo Radar/IA/Gates/Participação já foram adicionados e o uso real deve orientar otimizações futuras.

## Gates preservados

A primeira cliente permanece em **`monitor_only`**, com `participation_released = false` e nenhum enrollment com `participation_enabled = true`.

Nenhuma porcentagem visual de prontidão pode superar requisito impeditivo. O Radar pode localizar e analisar oportunidades, mas participação depende dos Gates do Prompt Mestre, do Perfil e do Playbook aplicáveis.

## Compatibilidade Supabase

A arquitetura diferencia explicitamente **GRANT** de **RLS**. Objetos destinados à Data API recebem somente os privilégios necessários; objetos privados permanecem sem exposição indevida. Essa regra é obrigatória para novas migrações.

## Fechamento

**BLINDAGEM ESTRUTURAL DO MVP: PASS. BLINDAGEM OPERACIONAL PONTA A PONTA: PENDENTE.**

A fundação, onboarding, documentação/SICAF, capacidade, prontidão, Radar, histórico de 12 meses, ingestão incremental, identidade multifuente, integração autenticada e isolamento multi-cliente possuem implementação e evidências registradas. A conclusão operacional depende do worker de IA, do retorno dos resultados aos Gates e de nova validação autenticada de toda a cadeia.

O fechamento técnico não revoga nem flexibiliza Gates de participação de clientes. Mudanças futuras deverão gerar nova versão/migração e não podem reescrever silenciosamente esta baseline.
