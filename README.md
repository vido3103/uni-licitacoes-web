# UNI Licitações Web — MVP

## OD-009 — Dashboard e Interface Operacional do Radar

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → VALIDADA → FECHADA.**

Entregas: interface responsiva publicada no GitHub Pages, Radar com filtros por ciclo de vida, indicadores operacionais, Mercado Público Demandante, Central de Pendências, modo demonstração e views de backend preparadas.

## OD-010 — Integração Autenticada do Front-end com Supabase

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → VALIDADA → FECHADA.**

### Entregas concluídas

- Primeiro cliente real criado: **Luvi Empilhadeiras**.
- Primeiro usuário real vinculado à Luvi com perfil administrativo.
- Edge Function `od010-auth` implantada para autenticação por e-mail e senha sem publicar chave administrativa no front-end.
- Edge Function `od010-dashboard` implantada para validar a sessão, resolver o cliente pelo vínculo do usuário e entregar somente o painel correspondente.
- O `client_id` não é aceito do navegador: ele é derivado no servidor a partir do usuário autenticado.
- Leitura integrada de `client_radar_summary`, `client_pending_dashboard`, `client_radar_dashboard` e `market_demand_12m`.
- Front-end atualizado para autenticação real, sessão temporária em `sessionStorage`, modo demonstração preservado e carregamento do ambiente real após login.
- Nenhuma `service_role`, senha de banco ou segredo administrativo foi publicada no GitHub.

### Validação real

O smoke test ao vivo foi executado no navegador com o usuário real da **Luvi Empilhadeiras** e o login foi confirmado como bem-sucedido. O ambiente real da Luvi foi carregado corretamente, validando a cadeia prática de autenticação → sessão → vínculo usuário/cliente → resolução do cliente → carregamento do dashboard.

### Segurança

O endpoint do dashboard valida o token do usuário antes de consultar dados. Em seguida resolve a associação em `client_members` e usa exclusivamente o cliente encontrado para consultar as views do painel. O navegador não escolhe arbitrariamente outro cliente.

A auditoria de segurança do Supabase continua mostrando apenas os avisos já conhecidos de tabelas backend-only com RLS sem policies, duas funções `SECURITY DEFINER` intencionais e o aviso de proteção contra senhas vazadas ainda desativada. Não foi identificada nova vulnerabilidade crítica introduzida pela OD-010.

### Limites preservados

A carga histórica real completa de 12 meses do PNCP ainda não foi executada. O painel deve continuar exibindo essa condição como pendente e não pode tratar o histórico incompleto como base integral de mercado.

## OD-011 — Configuração Operacional Real da Luvi e Liberação do Radar em Monitoramento

**Status: IMPLEMENTADA → TESTADA → REVISADA → VALIDADA → FECHADA.**

### Entregas concluídas

- Prompt Mestre **v1.17** registrado como método oficial vigente no banco.
- Perfil empresarial versionado da **Luvi Empilhadeiras** criado sem inventar dados societários ainda não validados.
- Playbook Luvi **v1.2** registrado de forma versionada e separado das regras universais do Prompt Mestre.
- Interesses operacionais configurados: **Produto = selecionado**, **Locação = selecionado**, **Prestação de Serviço = não selecionado**.
- Capacidades genéricas de Produto e Locação criadas como **EM PREPARAÇÃO**, preservando a regra de que seleção não equivale a habilitação.
- Termos de Radar configurados para peças de empilhadeiras, peças e componentes automotivos, filtros, lubrificantes, baterias, linha elétrica, hidráulica, empilhadeiras e paleteiras.
- Termos de manutenção e prestação de serviços de manutenção configurados como exclusões.
- Locação de empilhadeiras configurada como capacidade monitorada separadamente.
- Filtro geográfico inicial definido para **SP**, conforme Playbook Luvi; oportunidades fora de SP permanecem sujeitas a autorização específica.
- Radar habilitado em **monitor_only** para Produto e Locação, com histórico inicial de 12 meses marcado como `pending`.
- Participação permanece **não liberada** enquanto o acervo documental/habilitação não for migrado e validado no UNI Web.
- Pendências de habilitação foram registradas por capacidade com impacto `bloqueia_participacao`, evitando que o percentual visual de prontidão substitua bloqueadores reais.
- Checkpoints do onboarding real foram registrados e o GPHC ordinário foi agendado usando a cadência específica de 30 dias do Playbook Luvi v1.2, sem universalizar essa regra para outros clientes.
- Evento de auditoria da OD-011 registrado.

### Validação

Foram confirmados no banco:

- Produto e Locação selecionados; Serviço não selecionado.
- Duas capacidades reais em `em_preparacao`.
- As duas capacidades com `radar_status = monitor_only` e `participation_released = false`.
- As duas inscrições no Radar com monitoramento ativo, participação desativada e carga histórica de 12 meses pendente.
- Um único Perfil atual, um único Playbook atual e um único registro empresarial atual para a Luvi.

### Limites preservados

A OD-011 não promoveu a Luvi para `ready` e não liberou participação em licitações. O cadastro empresarial ainda precisa receber e validar CNPJ, CNAEs, objeto social e inscrições aplicáveis, e o acervo documental precisa ser migrado para o Cofre Documental. A carga PNCP real completa de 12 meses continua pendente e deverá ser tratada em etapa própria de operação do coletor.