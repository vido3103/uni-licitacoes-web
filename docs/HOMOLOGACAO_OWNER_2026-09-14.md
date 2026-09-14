# Homologação do Fluxo Owner — UNI WEB

Data: 14/09/2026
Escopo: ambiente Owner da plataforma UNI WEB.
Status geral: APROVADO PARA BLINDAGEM.

## Critério

Cada página foi revisada quanto a: carregamento de dados reais, navegação, filtros, ações, acesso ao cliente correto, estado vazio/erro, atualização manual, integração com Supabase, persistência de contexto Owner/Cliente e build de produção.

## 1. Painel Owner

Status: APROVADO.

- KPIs ligados a dados reais de clientes, oportunidades e Gate Econômico.
- Cards de clientes, pendências e prazos com navegação funcional.
- Acesso ao cliente preserva contexto Owner e abre o módulo correto.
- Removidos percentuais ilustrativos e dados fictícios da operação.

## 2. Clientes

Status: APROVADO.

- Busca e filtro por status funcionais.
- Solicitações de acesso integradas à Edge Function `company-access-requests`.
- Aprovar/Rejeitar operacionais com confirmação.
- Acesso ao ambiente e ao cadastro do cliente operacionais.

## 3. Oportunidades

Status: APROVADO.

- Página dedicada `OwnerOportunidades` ligada à view `client_radar_dashboard`.
- Filtros por cliente, modalidade, participação, UF, cidade, lifecycle, match status, período, valor e ordenação.
- Busca global integrada ao campo de filtro.
- Contadores e valor total recalculados sobre o conjunto filtrado.
- Ação Abrir entra no cliente correto e carrega a oportunidade selecionada.

## 4. Negócios

Status: APROVADO.

- Dados reais de `gate_economic_results`.
- Busca e filtros por cliente e status.
- Métricas recalculadas sobre o resultado filtrado.
- Ação de abertura direciona ao módulo Negócios do cliente correto.

## 5. Inteligência

Status: APROVADO.

- Indicadores derivados das oportunidades reais.
- Top órgãos e distribuição por UF calculados dinamicamente.
- Cliques nos agrupamentos encaminham para Oportunidades com busca pré-aplicada.

## 6. Habilitação

Status: APROVADO.

- Consolidação de `client_habilitation_reviews`, documentos e pendências.
- Filtro por situação: habilitado, não habilitado e em análise.
- Contadores de vencidos e vencimentos em 15 dias.
- Ação Revisar abre Habilitação no cliente correto.

## 7. Documentos

Status: APROVADO.

- Busca por arquivo, cliente e status.
- Filtro de validação e validade.
- Acesso à central documental do cliente correto.
- Datas de upload e validade derivadas do backend.

## 8. Usuários

Status: APROVADO.

- Vínculos derivados de `client_members`.
- Login e e-mail exibidos quando relacionados a solicitação de acesso; UUID bruto deixa de ser a identificação principal.
- Busca por cliente, login, e-mail e papel.
- Ação abre Configurações do cliente correto.

## 9. Relatórios

Status: APROVADO.

- KPIs consolidados reais.
- Exportação CSV funcional.
- Impressão/Salvar PDF via navegador funcional.
- Atividade recente ligada ao histórico de auditoria.

## 10. Configurações

Status: APROVADO.

- Atalhos administrativos navegáveis.
- Auditoria recente exibida a partir do backend.
- Aparência funcional: Claro, Escuro e Automático.
- Preferência persistida em `localStorage` e aplicada imediatamente.

## Shell Owner homologado

- Logo UNI retorna ao Painel Owner.
- Menu recolhível/expansível preserva estado.
- Ajuda abre o painel de IA.
- Sair executa logout real.
- Busca global encaminha para Oportunidades e aplica a consulta.
- Notificações Owner carregam solicitações de acesso e pendências reais.
- Ao entrar em cliente, o cabeçalho exibe o nome real do cliente selecionado.
- Voltar ao Owner limpa o contexto do cliente sem encerrar a sessão Owner.

## Verificação técnica

- Build Next.js concluído com sucesso.
- TypeScript concluído sem erro.
- Deployment Vercel em estado READY.
- URL pública respondeu HTTP 200.
- Nenhum erro de runtime encontrado na verificação pós-deploy.

## Backend e segurança

A consulta do Supabase Advisor permanece com duas ocorrências INFO de RLS sem policy em tabelas deliberadamente fechadas ao cliente (`company_access_requests` e `tenant_reset_append_only_archive`), acessadas por fluxo administrativo/Service Role, e um aviso de proteção de senha vazada desativada no Auth. Esses itens não alteram a homologação funcional do Owner; a proteção de senha forte no cadastro permanece aplicada no frontend/fluxo de acesso.

## Conclusão

Fluxo Owner homologado página por página. Nenhuma nova etapa do projeto deve ser iniciada antes da revisão e blindagem registradas em documento separado.
