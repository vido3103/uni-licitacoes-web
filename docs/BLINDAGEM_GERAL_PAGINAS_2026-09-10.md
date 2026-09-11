# Blindagem Geral das Páginas — 10/09/2026

## Escopo

Validação consolidada da branch `interface-profissional-v1` após a decisão de fechar cada página antes de avançar para a seguinte. A regra aplicada é: implementar → testar → corrigir → auditar → consolidar → avançar.

## Status por página

### Dashboard — CONSOLIDADO
- Dados reais do tenant via `get_client_dashboard_backend`.
- Estados de carregamento, erro e retry.
- Navegação operacional dos cards/atalhos.
- KPIs e prazos sem dados demonstrativos.

### Radar — CONSOLIDADO ATÉ A FRONTEIRA DE IA
- Busca e filtros operacionais.
- Triagem determinística.
- Download PNCP + contingência manual.
- Upload de documentos.
- Fila de Análise Detalhada.
- Tradução de estados e mensagens amigáveis.
- A fila não é apresentada como análise concluída enquanto não houver executor.
- Única fronteira deliberadamente diferida: worker `AiProvider` + Gemini + persistência do resultado estruturado.

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
- Não simula sessão pública nem inventa dados de lances ao vivo.
- RLS ativa.

### Relatórios — CONSOLIDADO OPERACIONAL
- Consolidação de oportunidades, Gate, estratégia e fila de análise.
- Filtro por oportunidade.
- Exportação CSV.
- Impressão/Salvar PDF pelo navegador.
- Sem dados demonstrativos.
- Correção de auditoria aplicada em 10/09/2026: custos e receitas consolidados agora multiplicam o valor unitário pela quantidade real do item armazenada em `gate_economic_results.quantity`.
- Quantidade, custo consolidado e receita sugerida ficam explicitados no relatório.

### Documentos — CONSOLIDADO OPERACIONAL
- Documentos do cliente + anexos de oportunidades.
- Upload em bucket privado `client-documents`.
- Versionamento do documento do cliente.
- Expiração, órgão emissor e observações.
- Links assinados temporários para documentos do cliente e anexos de oportunidades.
- Validação de extensão no upload: PDF, ZIP, DOC, DOCX, XLS e XLSX.
- Limite de 50 MB.
- Políticas existentes de owner/admin preservadas.

### Fornecedores — CONSOLIDADO OPERACIONAL
- Tabela `client_suppliers`.
- Cadastro por tenant.
- Busca por nome/categoria/contato.
- Ativação/inativação.
- Links e contatos funcionais.
- URLs externas limitadas a protocolos HTTP/HTTPS antes de persistir e antes de renderizar o link.
- RLS ativa.

### Configurações — CONSOLIDADO OPERACIONAL
- Visão de empresa, perfil e capacidades.
- Histórico de perfil.
- Controle de monitoramento e sincronização incremental do Radar.
- `participation_enabled` permanece protegido e não pode ser alterado diretamente pela interface.

## Blindagem de segurança

As tabelas operacionais auditadas possuem RLS baseada em associação do usuário ao `client_id`.

Os validadores de referência cruzada foram novamente confirmados no banco em 10/09/2026:
- `trg_validate_cfp_quote_tenant_reference`
- `trg_validate_gate_economic_tenant_reference`
- `trg_validate_dispute_strategy_tenant_reference`

O encadeamento CFP → Gate Econômico → Disputa exige que item, cotação, oportunidade e tenant sejam consistentes.

## Shell

- Documentos, Fornecedores e Configurações conectados ao menu.
- Menu mobile operacional.
- Notificações conectadas a `client_pending_items` e à fila de análise do tenant.
- Identidade fixa de Luvi removida da sidebar para preservar a arquitetura multi-tenant.
- Logout funcional.
- Busca global encaminha o usuário à página Editais; a busca detalhada e filtros ficam concentrados nessa página.

## Validação técnica desta rodada

- Deploy Vercel do checkpoint mais recente `3434a650e82da133464288ddaf59850b89d9f427` concluído em estado `READY`.
- Build Vercel concluído; não houve erro de compilação. O único aviso observado é de `npm allow-scripts` para dependência de instalação e não interrompeu o build.
- Consulta de runtime `error/fatal` do deploy mais recente: nenhum evento encontrado no período auditado.
- Preview da branch permanece associado a `interface-profissional-v1`.
- RLS já auditada nas tabelas críticas de CFP, Gate, Disputa, documentos, fornecedores, perfis, pendências e fila de análise.
- Triggers de consistência cross-tenant confirmados diretamente no banco.

### Limite de evidência

Os testes desta rodada cobrem código, schema, persistência, políticas, build, deploy e logs. O ambiente disponível não executa uma sessão de navegador autenticada com cliques humanos; portanto, a aceitação visual autenticada final deve ser tratada como teste de interface complementar, e não deve ser confundida com falha estrutural das páginas.

## Fronteira deliberadamente deixada para a última etapa

**Executor da Análise Detalhada por IA**: a fila, documentos, versões e controles necessários estão preparados. O usuário já definiu o Gemini como primeiro provedor de validação. A conexão do Gemini será feita somente após esta blindagem de páginas, por meio da abstração `AiProvider`, sem colocar chave no código ou no GitHub.

Fluxo final a validar depois da inclusão do motor:

`Radar → documentos → fila → AiProvider/Gemini → resultado estruturado → gates → persistência → interface → auditoria`.

## Situação

**BLINDAGEM DAS PÁGINAS: CONCLUÍDA ATÉ A FRONTEIRA QUE EXIGE MOTOR DE IA.**

A única dependência funcional deliberadamente aberta é o executor de IA e seu teste ponta a ponta. A branch de desenvolvimento permanece `interface-profissional-v1`. Não promover para `main` sem aprovação explícita do usuário.
