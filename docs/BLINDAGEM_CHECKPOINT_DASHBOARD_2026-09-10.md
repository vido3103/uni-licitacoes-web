# Blindagem — Checkpoint Dashboard — 2026-09-10

## Status

**DASHBOARD CONSOLIDADO PARA A FASE ATUAL**

Este checkpoint registra a validação do Dashboard antes do avanço para o próximo módulo, conforme a regra de desenvolvimento página a página.

## Cadeia validada

Dashboard → autenticação Supabase → associação em `client_members` → RPC `get_client_dashboard_backend(uuid)` → views/tabelas do tenant → retorno para interface.

## Segurança e tenant

A RPC `public.get_client_dashboard_backend(uuid)` é `SECURITY DEFINER`, usa `search_path` explícito, exige `auth.uid()` e valida associação do usuário ao `client_id` informado antes de retornar qualquer dado. O frontend resolve o `client_id` a partir do usuário autenticado e não utiliza um tenant fixo.

## Dados exibidos

O Dashboard utiliza somente dados persistidos do backend para:

- oportunidades ativas e históricas;
- oportunidades liberadas para participação;
- pendências abertas e bloqueadoras;
- evolução de oportunidades dos últimos seis meses;
- próximos prazos;
- últimas oportunidades;
- estado do monitoramento e última sincronização.

Nenhum número demonstrativo é usado para preencher a interface.

## Interações consolidadas

- botão **Atualizar** recarrega o backend e informa o horário da atualização;
- falha inicial apresenta estado de erro e botão **Tentar novamente**;
- falha de atualização preserva os dados anteriores e informa a falha;
- cards de KPI navegam para os módulos correspondentes;
- próximos prazos navegam para o Radar;
- oportunidades possuem ação **Abrir**;
- atalhos de acesso rápido são funcionais;
- estados vazios são apresentados sem fabricar conteúdo.

## Build e execução

Commit de implementação: `64acc019d702215fba5faa5dd022027a0b8f2f54`.

Deploy de Preview: `dpl_A5R8bzdCfM9bYp7wQPgCHoP4Vtho` — estado **READY**.

A consulta de logs de runtime do Preview não apresentou erros/falhas no intervalo verificado após o deploy.

## Limites conhecidos fora do Dashboard

A busca global do cabeçalho e o menu mobile pertencem ao shell da aplicação e serão tratados na blindagem geral após a consolidação dos módulos. O worker de Análise Detalhada também não faz parte do Dashboard e permanece como dependência futura do fluxo de análise.

## Decisão

O Dashboard está apto a ser considerado consolidado para a fase atual. O desenvolvimento pode avançar para **Radar de Licitações**, mantendo a branch `interface-profissional-v1` e sem promoção para `main` nesta etapa.
