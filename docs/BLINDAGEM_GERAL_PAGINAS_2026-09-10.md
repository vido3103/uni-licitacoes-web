# Blindagem Geral das Páginas — 10/09/2026

## Escopo

Validação consolidada da branch `interface-profissional-v1` após a decisão de fechar cada página antes de avançar para a seguinte.

## Status por página

### Dashboard — CONSOLIDADO
- Dados reais do tenant via `get_client_dashboard_backend`.
- Estados de carregamento, erro e retry.
- Navegação operacional dos cards/atalhos.
- KPIs e prazos sem dados demonstrativos.

### Radar — CONSOLIDADO COM PENDÊNCIA EXTERNA AUTORIZADA
- Busca e filtros operacionais.
- Triagem determinística.
- Download PNCP + contingência manual.
- Upload de documentos.
- Fila de Análise Detalhada.
- Tradução de estados e mensagens amigáveis.
- Pendência autorizada: executor/worker de IA ainda não ligado a provedor de inferência pago.

### Editais — CONSOLIDADO
- Dados reais do tenant.
- Pesquisa e filtros funcionais.
- Ordenação e paginação.
- Atualização/retry.
- Valores ausentes/zero exibidos como `Não informado`.
- Sem filtro de origem fictício quando a fonte não está materializada no payload do dashboard.

### CFP — CONSOLIDADO OPERACIONAL
- Tabelas `cfp_items` e `cfp_quotes`.
- Inclusão de itens por oportunidade.
- Registro de fornecedor, produto, custo, frete, imposto, administração, disponibilidade e fonte.
- Regra de 3 cotações para validação do item.
- Persistência por tenant.
- RLS ativa.

### Gate Econômico — CONSOLIDADO OPERACIONAL
- Tabela `gate_economic_results`.
- Consumo dos itens/cotações CFP.
- Cálculo de custo final e preço sugerido por markup.
- Classificação por referência disponível.
- Consolidação persistida.
- RLS ativa.

### Disputa — CONSOLIDADO OPERACIONAL
- Tabela `dispute_strategies`.
- Estratégia por item baseada no Gate Econômico.
- Markup alvo e piso protegido em 25%.
- Estados planejada/em disputa/retirada/vencedora/não vencedora.
- Persistência por tenant.
- RLS ativa.

### Relatórios — CONSOLIDADO OPERACIONAL
- Consolidação de oportunidades, Gate, estratégia e fila de análise.
- Filtro por oportunidade.
- Exportação CSV.
- Impressão/Salvar PDF pelo navegador.
- Sem dados demonstrativos.

### Documentos — CONSOLIDADO OPERACIONAL
- Documentos do cliente + anexos de oportunidades.
- Upload em bucket privado `client-documents`.
- Versionamento do documento do cliente.
- Expiração, órgão emissor e observações.
- Link assinado temporário para abertura.
- Políticas existentes de owner/admin preservadas.

### Fornecedores — CONSOLIDADO OPERACIONAL
- Tabela `client_suppliers`.
- Cadastro por tenant.
- Busca por nome/categoria/contato.
- Ativação/inativação.
- Links e contatos funcionais.
- RLS ativa.

### Configurações — CONSOLIDADO OPERACIONAL
- Visão de empresa, perfil e capacidades.
- Histórico de perfil.
- Controle de monitoramento e sincronização incremental do Radar.
- `participation_enabled` permanece protegido e não pode ser alterado diretamente pela interface.

## Blindagem de segurança

As novas tabelas operacionais possuem RLS baseada em associação do usuário ao `client_id`.

Foram adicionados validadores de referência cruzada para impedir vínculos inconsistentes entre tenants:
- `trg_validate_cfp_quote_tenant_reference`
- `trg_validate_gate_economic_tenant_reference`
- `trg_validate_dispute_strategy_tenant_reference`

O encadeamento CFP → Gate Econômico → Disputa exige que item, cotação, oportunidade e tenant sejam consistentes.

## Shell

- Novos módulos Documentos, Fornecedores e Configurações conectados ao menu.
- Menu mobile operacional.
- Notificações conectadas ao tenant.
- Identidade fixa de Luvi removida da sidebar para preservar a arquitetura multi-tenant.
- Logout funcional.
- Busca global encaminha o usuário à página Editais; a busca detalhada e filtros ficam concentrados nessa página.

## Validação técnica

- Builds Vercel dos módulos Dashboard, Radar, Editais, CFP, Gate Econômico, Disputa, Relatórios, Documentos, Fornecedores, Configurações e shell concluídos em estado READY.
- Consulta de erros de runtime no período de validação: nenhum erro identificado.
- RLS confirmada ativa em `cfp_items`, `cfp_quotes`, `gate_economic_results`, `dispute_strategies` e `client_suppliers`.
- Políticas de tenant confirmadas nas novas tabelas.
- Triggers de consistência cross-tenant confirmados.

## Pendência conhecida autorizada

**Executor da Análise Detalhada por IA**: a fila e o controle de versão estão implementados, porém a execução por modelo externo permanece desativada até autorização explícita para uso de provedor com possível custo.

Esta pendência não invalida o fechamento das demais páginas e deve permanecer visível como dependência externa, sem mascarar a fila como análise concluída.

## Situação

**BLINDAGEM GERAL DAS PÁGINAS: CONCLUÍDA COM 1 PENDÊNCIA EXTERNA AUTORIZADA (WORKER DE IA).**

A branch de desenvolvimento permanece `interface-profissional-v1`. Não promover para `main` sem aprovação explícita do usuário.
