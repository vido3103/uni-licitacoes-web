# Homologação Profunda — Owner / Oportunidades

Data: 16/09/2026
Status: APROVADO E BLINDADO

## Escopo concluído
A homologação verificou o encadeamento Habilitação → capacidades → matrícula no Radar → matching → visão Owner → abertura no contexto do cliente.

## Correções e blindagens aplicadas
- cadastradas as 6 capacidades aprovadas para a Luvi: peças para empilhadeiras, peças/produtos automotivos, aquisição de empilhadeiras/paleteiras, locação de empilhadeiras sem operador, lubrificantes e filtros;
- matrículas do Radar ativadas somente para cliente habilitado/ready;
- carga histórica inicial de 12 meses executada sobre a base pública real;
- match determinístico passa a significar `queued_for_analysis` e NÃO libera participação automaticamente;
- oportunidades vencidas foram marcadas `filtered_out` e removidas da visão operacional;
- objetos de prestação de serviço de manutenção foram excluídos do Radar da Luvi, preservando aquisições de materiais cujo texto apenas menciona uso em manutenção;
- `client_radar_dashboard` mantém `security_invoker=true` e não exibe `filtered_out`;
- página Owner deduplica oportunidade por cliente para impedir dupla contagem quando um edital corresponde a mais de uma capacidade;
- status visual diferencia `Em análise` de participação efetivamente liberada;
- filtros, ordenação, pesquisa global e deep-link para a oportunidade do cliente permanecem funcionais.

## Estado de produção validado
- base pública: 126.324 oportunidades;
- Radar Luvi após saneamento: 569 linhas de capacidade, correspondentes a 527 oportunidades únicas;
- oportunidades vencidas expostas no Radar: 0;
- objetos explícitos de prestação de serviços de manutenção segundo os padrões bloqueados: 0;
- participações liberadas automaticamente pelo matching: 0;
- 6 capacidades selecionadas e 6 matrículas ativas no Radar.

## Qualidade e deploy
- commit funcional principal: `fdc63dd22c8ac3584ad4be5f6356ffccae7585f1`;
- commit final de rastreabilidade/migração: `ccfadaaf893d5efbd6a969b6429e61b2bfdef658`;
- Quality Gate run 215: SUCCESS (`npm run check` concluído);
- deployment de produção `dpl_JBNj7u5zxRCGGQwHi9SfursyRDGc`: READY;
- build Vercel concluído sem erro.

## Segurança
O advisor de segurança foi reexecutado. A advertência anterior de `security_definer_view` foi eliminada ao confirmar a view com `security_invoker=true` e tornar o wrapper público de habilitação `SECURITY INVOKER`. Permanecem apenas achados conhecidos fora desta página: tabelas deliberadamente fechadas por RLS sem policy direta e proteção de senha vazada desativada no Auth.

## Regra de blindagem
Oportunidades não pode voltar a:
1. liberar participação apenas por match textual;
2. exibir oportunidades vencidas como acionáveis;
3. incluir prestação de serviço de manutenção no portfólio Luvi;
4. duplicar KPIs/valor por múltiplas capacidades;
5. perder isolamento por cliente;
6. quebrar o deep-link Owner → perfil do cliente → oportunidade;
7. substituir dados reais por métricas demonstrativas.

Com a aprovação expressa do usuário para avançar até a conclusão, **Owner / Oportunidades fica APROVADO E BLINDADO**. A próxima etapa operacional é a validação profunda do fluxo da oportunidade aberta no perfil do cliente.
