# Auditoria Visual — Dashboard UNI WEB

Data: 14/09/2026
Escopo: somente auditoria visual/UX do Dashboard e shell principal. Nenhuma alteração funcional aplicada.

## 1. Resumo executivo

O Dashboard atual é funcional e já apresenta dados reais, porém ainda transmite sensação de produto em fase de desenvolvimento. Os principais problemas são excesso de informação técnica, hierarquia visual pouco orientada à decisão, navegação com sobreposição de conceitos, estados de Owner e Cliente visualmente próximos demais e alguns elementos que competem por atenção.

Conclusão: manter a base estrutural, mas simplificar a superfície, reforçar a jornada operacional e separar claramente o contexto de plataforma (Owner) do contexto de cliente.

## 2. Pontos positivos a preservar

- Sidebar fixa com identidade UNI e navegação persistente.
- Cabeçalho com busca global, acesso à IA, notificações e conta.
- KPIs clicáveis que levam ao módulo relacionado.
- Uso de dados reais do tenant, sem cards demonstrativos.
- Agrupamento em blocos visuais consistentes e responsivos.
- Tratamento de loading e falhas de carregamento.
- Alternância Owner/Cliente já existente.
- Dashboard com próximos prazos e últimas oportunidades, úteis operacionalmente.

## 3. Achados críticos

### AV-01 — Excesso de linguagem técnica para o usuário final
Elementos como “BACKEND REAL”, “tenant validado”, “dados reais do ambiente autenticado”, “Sistema operacional” e mensagens de infraestrutura aparecem na interface principal. São úteis para desenvolvimento, mas não para a operação diária.

Recomendação: remover do fluxo normal e reservar informações técnicas para área de diagnóstico/administração.

### AV-02 — BackendStatus cria uma faixa adicional permanente
O componente BackendStatus ocupa espaço abaixo do cabeçalho e repete informações que já aparecem no Dashboard. Também reforça linguagem técnica.

Recomendação: retirar da interface normal. Em falha real, usar alerta contextual; em sucesso, não mostrar faixa persistente.

### AV-03 — Hierarquia de navegação ainda confusa
No cliente, “Oportunidades” representa Radar/Editais; “Negócios” representa CFP/Gate Econômico/Disputa; “Inteligência” representa Relatórios; “Empresa” agrupa Empresa/SICAF/Documentos/Fornecedores/Configurações/Gate de Participação.

Problema: a sidebar parece simples, mas esconde muitos módulos heterogêneos sob poucos rótulos, dificultando previsibilidade.

Recomendação: manter menu principal curto, mas criar subtítulo/breadcrumb e subnavegação contextual no conteúdo.

### AV-04 — Dashboard orientado a contagem, não a decisão
Os quatro KPIs principais mostram volume, mas não deixam claro “o que exige ação agora”. Pendências, prazos e oportunidades liberadas deveriam ter prioridade operacional maior que histórico.

Recomendação: priorizar “Ações necessárias”, “Prazos próximos”, “Oportunidades liberadas” e “Em análise”; mover históricos para nível secundário.

### AV-05 — Gráfico de evolução tem baixo valor decisório
O gráfico de seis meses mostra apenas contagem de oportunidades publicadas. É visualmente correto, porém não responde às perguntas mais importantes: quantas foram relevantes, aprovadas, participadas e ganhas.

Recomendação: substituir por funil/tendência operacional do método UNI ou manter apenas em área de Inteligência.

### AV-06 — Status do Radar mistura dimensões diferentes
Ativas/Históricas/Sem classificação/Liberadas/Pendências bloqueadoras não são categorias mutuamente exclusivas. O gráfico circular induz leitura de composição percentual mesmo quando os conjuntos se sobrepõem.

Recomendação: não usar donut para métricas que não formam 100% do mesmo universo. Usar cards, barras independentes ou funil.

### AV-07 — “Últimas oportunidades” repete função do módulo Oportunidades
A tabela é útil, mas ocupa grande área e repete o módulo principal. No Dashboard ela deve servir como atalho, não como mini-Radar.

Recomendação: reduzir para 3–5 linhas com foco em status, prazo e ação; remover colunas secundárias.

### AV-08 — Ações críticas não estão suficientemente destacadas
Pendências bloqueadoras e prazos aparecem, mas disputam atenção com gráficos e histórico.

Recomendação: criar bloco superior “Prioridades de hoje” com alertas acionáveis.

### AV-09 — Contexto Owner x Cliente precisa de diferenciação visual mais forte
A troca de contexto funciona, porém o shell permanece parecido. Um Owner operando dentro de um cliente pode perder a percepção de que está atuando por representação.

Recomendação: quando Owner estiver dentro de cliente, mostrar banner compacto persistente “Você está operando como Owner no ambiente X” com botão de saída.

### AV-10 — Cabeçalho concentra ações demais
Busca global, IA, notificações, avatar, sair do cliente e logout competem na mesma linha. Em resoluções menores há compressão.

Recomendação: agrupar conta/saída em menu de usuário e manter IA + busca como ações principais.

## 4. Achados médios

### AV-11 — Tipografia excessivamente pequena em áreas importantes
Há muitos textos em 9–11 px, especialmente sidebar, status e helpers. Isso reduz legibilidade e passa sensação de painel técnico.

### AV-12 — Ícones por caracteres Unicode são inconsistentes
Símbolos como “⌕”, “▥”, “◆”, “▣” e “◉” não têm consistência visual entre plataformas.

### AV-13 — Cores sem semântica global consolidada
Azul, verde, âmbar, violeta e rosa aparecem em vários contextos. Falta uma convenção única para sucesso, atenção, risco, processo e informação.

### AV-14 — Datas e atualização ocupam espaço desproporcional
O bloco de data + botão Atualizar é útil, mas visualmente pesado para algo secundário.

### AV-15 — Responsividade existe, mas mobile ainda é adaptação, não experiência dedicada
O menu móvel vira grade de botões; tabelas continuam dependentes de scroll horizontal. Isso será tratado na etapa específica de responsividade, não nesta auditoria.

## 5. Auditoria do Dashboard Owner

O OwnerAdmin cumpre a função administrativa, porém hoje parece uma coleção de tabelas e contadores.

Principais achados:
- “Clientes ativos”, “Oportunidades”, “Itens viáveis” e “Valor mapeado” são métricas úteis, mas faltam saúde operacional e alertas.
- Tabelas de usuários mostram UUIDs brutos, inadequados para uso normal.
- Habilitação e Documentos aparecem praticamente como a mesma tabela.
- Configurações contém placeholders visuais ainda sem funções concretas.
- A ação destrutiva de reset da LUVI está exposta em Configurações; funcionou para manutenção, mas não deve permanecer como elemento de produto após esta fase.
- Falta visão por cliente: status de onboarding, habilitação, Radar, pendências, última atividade e risco.

Recomendação: transformar o Owner Dashboard em centro de supervisão da plataforma, não em cópia agregada dos módulos do cliente.

## 6. Estrutura visual recomendada para o Dashboard do Cliente

Ordem sugerida:
1. Cabeçalho compacto: empresa + contexto + última atualização.
2. Prioridades de hoje: pendências bloqueadoras, prazos e análises que exigem decisão.
3. KPIs operacionais: candidatas relevantes, aprovadas, liberadas para participação, em disputa/resultado.
4. Próximos prazos.
5. Pipeline do método UNI: Triagem → CFP → Gate Econômico → Participação → Disputa → Resultado.
6. Oportunidades recentes em versão compacta.
7. Insights/IA como bloco opcional, não dominante.

## 7. Estrutura visual recomendada para Dashboard Owner

Ordem sugerida:
1. Saúde da plataforma.
2. Clientes ativos / em onboarding / com bloqueios.
3. Alertas críticos por cliente.
4. Atividade recente consolidada.
5. Indicadores agregados de oportunidades e participação.
6. Lista de clientes com status resumido e ação “Acessar ambiente”.

## 8. Decisões para aprovação do usuário antes de alteração de código

- Remover BackendStatus da navegação normal.
- Remover linguagem técnica do Dashboard do cliente.
- Trocar donut “Status do Radar” por visual que não misture conjuntos sobrepostos.
- Rebaixar gráfico de evolução ou substituí-lo por pipeline/funil UNI.
- Criar bloco “Prioridades de hoje” no topo.
- Compactar “Últimas oportunidades”.
- Reforçar indicação visual quando Owner estiver dentro de um cliente.
- Reorganizar header para reduzir competição de ações.
- Não tratar responsividade mobile nesta etapa.
- Não iniciar reestruturação de outros módulos antes da aprovação desta auditoria.

## 9. Status

Auditoria visual concluída.
Nenhuma modificação funcional realizada.
Aguardando avaliação/aprovação do usuário para iniciar a reestruturação do Dashboard.
