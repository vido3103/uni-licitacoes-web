# UNI Licitações Web — MVP

Protótipo operacional da OD-009 — Dashboard e Interface Operacional do Radar.

## Estado atual

- Interface estática responsiva publicada no repositório.
- Dados exibidos são exclusivamente demonstrativos.
- Nenhuma chave, token ou credencial está embutida no front-end.
- Backend Supabase já possui as views esperadas para a integração posterior: `client_radar_dashboard`, `client_radar_summary`, `market_demand_12m` e `client_pending_dashboard`.
- A carga histórica real completa de 12 meses do PNCP ainda não foi executada; a interface não deve sugerir que ela já esteja concluída.

## Regras preservadas

O histórico serve para inteligência do Mercado Público Demandante e não deve ser tratado como oportunidade ativa. Liberação para participação depende da prontidão do cliente, Radar e decisão final aplicável; resultado favorável isolado de IA não libera participação.

## Publicação

O projeto é um site estático (`index.html`, `styles.css`, `app.js`) preparado para hospedagem gratuita por GitHub Pages. A ativação do Pages é uma configuração administrativa do repositório e deve ser confirmada antes de considerar a URL pública operacional.
