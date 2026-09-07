# UNI Licitações Web — MVP

## OD-009 — Dashboard e Interface Operacional do Radar

**Status: IMPLEMENTADA → TESTADA → REVISADA → AUDITADA → VALIDADA → FECHADA.**

Entregas: interface responsiva publicada no GitHub Pages, Radar com filtros por ciclo de vida, indicadores operacionais, Mercado Público Demandante, Central de Pendências, modo demonstração e views de backend preparadas.

## OD-010 — Integração Autenticada do Front-end com Supabase

**Status atual: IMPLEMENTADA → REVISADA → AUDITADA INTERNAMENTE → AGUARDANDO TESTE DE LOGIN AO VIVO NO NAVEGADOR PARA FECHAMENTO FORMAL.**

### Entregas implementadas

- Primeiro cliente real criado: **Luvi Empilhadeiras**.
- Primeiro usuário real vinculado à Luvi com perfil administrativo.
- Edge Function `od010-auth` implantada para autenticação por e-mail e senha sem publicar chave administrativa no front-end.
- Edge Function `od010-dashboard` implantada para validar a sessão, resolver o cliente pelo vínculo do usuário e entregar somente o painel correspondente.
- O `client_id` não é aceito do navegador: ele é derivado no servidor a partir do usuário autenticado.
- Leitura integrada de `client_radar_summary`, `client_pending_dashboard`, `client_radar_dashboard` e `market_demand_12m`.
- Front-end atualizado para autenticação real, sessão temporária em `sessionStorage`, modo demonstração preservado e carregamento do ambiente real após login.
- Nenhuma `service_role`, senha de banco ou segredo administrativo foi publicada no GitHub.

### Segurança

O endpoint do dashboard valida o token do usuário antes de consultar dados. Em seguida resolve a associação em `client_members` e usa exclusivamente o cliente encontrado para consultar as views do painel. O navegador não escolhe arbitrariamente outro cliente.

A auditoria de segurança do Supabase continua mostrando apenas os avisos já conhecidos de tabelas backend-only com RLS sem policies, duas funções `SECURITY DEFINER` intencionais e o aviso de proteção contra senhas vazadas ainda desativada. Não foi identificada nova vulnerabilidade crítica introduzida pela OD-010.

### Testes e limitação de fechamento

A implantação das funções foi confirmada como `ACTIVE`, o vínculo Luvi ↔ usuário foi validado no banco e o código publicado foi revisado. O ambiente de execução das ferramentas desta sessão não permitiu realizar uma requisição HTTP POST externa até a Edge Function para simular o login completo. Por isso, falta apenas o smoke test real no navegador com o usuário da Luvi antes do fechamento formal da OD-010.

### Limites preservados

A carga histórica real completa de 12 meses do PNCP ainda não foi executada. O painel deve continuar exibindo essa condição como pendente e não pode tratar o histórico incompleto como base integral de mercado.
