const opportunities=[
{p:'PNCP-2026-001',o:'Fornecimento de componentes para equipamentos',org:'Autarquia Municipal',uf:'SP',d:'12/09/2026',life:'live',part:'Liberada'},
{p:'PNCP-2026-002',o:'Aquisição de filtros e materiais automotivos',org:'Prefeitura Municipal',uf:'SP',d:'15/09/2026',life:'live',part:'Monitoramento'},
{p:'PNCP-2026-003',o:'Locação de equipamento de movimentação',org:'Empresa Pública',uf:'MG',d:'18/09/2026',life:'live',part:'Monitoramento'},
{p:'PNCP-2025-063',o:'Materiais para manutenção de veículos',org:'Comando do Exército',uf:'RS',d:'25/11/2025',life:'historical',part:'Histórico'},
{p:'PNCP-2025-041',o:'Aquisição de peças automotivas',org:'Órgão Estadual',uf:'PR',d:'04/10/2025',life:'historical',part:'Histórico'},
{p:'PNCP-SEM-PRAZO',o:'Registro sem prazo validado',org:'Órgão Público',uf:'SP',d:'—',life:'unknown',part:'Não liberada'}
];
const labels={live:'ATIVA',historical:'HISTÓRICA',unknown:'INDETERMINADA'};
const q=s=>document.querySelector(s);
function render(filter='live'){
 const data=filter==='all'?opportunities:opportunities.filter(x=>x.life===filter);
 q('#rows').innerHTML=data.map(x=>`<tr><td><strong>${x.p}</strong></td><td>${x.o}</td><td>${x.org}</td><td>${x.uf}</td><td>${x.d}</td><td><span class="badge">${labels[x.life]}</span></td><td>${x.part}</td></tr>`).join('')||'<tr><td colspan="7">Nenhum registro para este filtro.</td></tr>';
}
function openDemo(){
 q('#authPanel').hidden=true;q('#dashboard').hidden=false;q('#clientLabel').textContent='CLIENTE TESTE — EMPRESA DEMONSTRAÇÃO';
 q('#modeTitle').textContent='Modo demonstração';q('#modeText').textContent='Dados fictícios. Nenhuma informação deste modo deve ser usada para decisão de participação.';
 q('#liveCount').textContent='3';q('#releasedCount').textContent='1';q('#historicalCount').textContent='2';q('#blockingCount').textContent='1';
 q('#pendingBox').innerHTML='<strong>4 pendências abertas</strong><p>1 bloqueadora. Dados exclusivamente demonstrativos.</p>';
 render(q('#filter').value);
 const market=[['Oportunidades identificadas','21'],['Órgãos compradores','12'],['Estados com demanda','6'],['Janela analítica','12 meses'],['Carga histórica completa PNCP','PENDENTE']];
 q('#market').innerHTML=market.map(x=>`<div class="market-row"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
}
q('#filter').addEventListener('change',e=>render(e.target.value));
q('#demoBtn').addEventListener('click',openDemo);
q('#loginForm').addEventListener('submit',e=>{e.preventDefault();q('#authStatus').className='status-line';q('#authStatus').textContent='Integração autenticada com o Supabase em preparação. Use “Ver demonstração” nesta versão publicada.';});
q('#logoutBtn').addEventListener('click',()=>{q('#dashboard').hidden=true;q('#authPanel').hidden=false;q('#clientLabel').textContent='AMBIENTE NÃO AUTENTICADO';});
