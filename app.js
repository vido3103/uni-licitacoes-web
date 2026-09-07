const AUTH_ENDPOINT='https://oaakuckvzxeekyqmvsza.supabase.co/functions/v1/od010-auth';
const DASHBOARD_ENDPOINT='https://oaakuckvzxeekyqmvsza.supabase.co/functions/v1/od010-dashboard';
const q=s=>document.querySelector(s);
const labels={live:'ATIVA',historical:'HISTÓRICA',unknown:'INDETERMINADA'};
let currentOpportunities=[];

function esc(value=''){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function fmtDate(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});}
function fmtMoney(value){const n=Number(value);return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';}
function showAuthMessage(text,isError=false){q('#authStatus').className='status-line'+(isError?' error':'');q('#authStatus').textContent=text;}

function renderOpportunities(filter='live'){
 const data=filter==='all'?currentOpportunities:currentOpportunities.filter(x=>(x.lifecycle||'unknown')===filter);
 q('#rows').innerHTML=data.map(x=>`<tr><td><strong>${esc(x.process_number||'—')}</strong></td><td>${esc(x.object_text||x.title||'—')}</td><td>${esc(x.buyer_name||'—')}</td><td>${esc(x.state||'—')}</td><td>${fmtDate(x.proposal_deadline)}</td><td><span class="badge">${labels[x.lifecycle]||'INDETERMINADA'}</span></td><td>${x.participation_allowed?'Liberada':'Monitoramento'}</td></tr>`).join('')||'<tr><td colspan="7">Nenhum registro para este filtro.</td></tr>';
}

function renderMarket(rows,caveat){
 const total=rows.reduce((s,x)=>s+Number(x.opportunity_count||0),0);
 const buyers=new Set(rows.map(x=>x.buyer_name).filter(Boolean)).size;
 const states=new Set(rows.map(x=>x.state).filter(Boolean)).size;
 const value=rows.reduce((s,x)=>s+Number(x.total_estimated_value||0),0);
 const items=[['Oportunidades agregadas nas linhas disponíveis',String(total)],['Órgãos compradores',String(buyers)],['Estados com demanda',String(states)],['Valor estimado agregado',fmtMoney(value)],['Carga histórica completa PNCP',caveat?.pncp_full_12m_loaded?'CONCLUÍDA':'PENDENTE']];
 q('#market').innerHTML=items.map(x=>`<div class="market-row"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong></div>`).join('');
}

function showDashboard(){q('#authPanel').hidden=true;q('#dashboard').hidden=false;}
function resetToLogin(){sessionStorage.removeItem('uni_access_token');q('#dashboard').hidden=true;q('#authPanel').hidden=false;q('#clientLabel').textContent='AMBIENTE NÃO AUTENTICADO';q('#password').value='';}

function openDemo(){
 currentOpportunities=[
  {process_number:'PNCP-2026-001',object_text:'Fornecimento de componentes para equipamentos',buyer_name:'Autarquia Municipal',state:'SP',proposal_deadline:'2026-09-12T18:00:00-03:00',lifecycle:'live',participation_allowed:true},
  {process_number:'PNCP-2026-002',object_text:'Aquisição de filtros e materiais automotivos',buyer_name:'Prefeitura Municipal',state:'SP',proposal_deadline:'2026-09-15T18:00:00-03:00',lifecycle:'live',participation_allowed:false},
  {process_number:'PNCP-2025-063',object_text:'Materiais para manutenção de veículos',buyer_name:'Comando do Exército',state:'RS',proposal_deadline:'2025-11-25T08:00:00-03:00',lifecycle:'historical',participation_allowed:false}
 ];
 showDashboard();q('#clientLabel').textContent='CLIENTE TESTE — EMPRESA DEMONSTRAÇÃO';q('#modeTitle').textContent='Modo demonstração';q('#modeText').textContent='Dados fictícios. Nenhuma informação deste modo deve ser usada para decisão de participação.';
 q('#liveCount').textContent='2';q('#releasedCount').textContent='1';q('#historicalCount').textContent='1';q('#blockingCount').textContent='1';
 q('#pendingBox').innerHTML='<strong>4 pendências abertas</strong><p>1 bloqueadora. Dados exclusivamente demonstrativos.</p>';
 renderOpportunities(q('#filter').value);renderMarket([{state:'SP',buyer_name:'Prefeitura Municipal',opportunity_count:12,total_estimated_value:250000},{state:'RS',buyer_name:'Comando do Exército',opportunity_count:9,total_estimated_value:175000}],{pncp_full_12m_loaded:false});
}

async function loadRealDashboard(token){
 const r=await fetch(DASHBOARD_ENDPOINT,{headers:{Authorization:`Bearer ${token}`}});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.error==='invalid_session'?'Sessão expirada. Entre novamente.':data.error==='no_client_membership'?'Usuário sem vínculo com cliente.':'Não foi possível carregar o painel.');
 currentOpportunities=data.opportunities||[];showDashboard();
 q('#clientLabel').textContent=(data.client?.display_name||data.client?.legal_name||'CLIENTE').toUpperCase();q('#modeTitle').textContent='Ambiente real';q('#modeText').textContent=`Usuário autenticado: ${data.user?.email||'—'} · Perfil: ${data.membership?.role||'—'}`;
 const s=data.summary||{};const p=data.pending||{};
 q('#liveCount').textContent=s.live_count??0;q('#releasedCount').textContent=s.released_for_participation_count??0;q('#historicalCount').textContent=s.historical_count??0;q('#blockingCount').textContent=p.blocking_pending_count??0;
 q('#pendingBox').innerHTML=`<strong>${Number(p.open_pending_count||0)} pendências abertas</strong><p>${Number(p.blocking_pending_count||0)} bloqueadora(s). Bloqueadores prevalecem sobre qualquer percentual visual de prontidão.</p>`;
 renderOpportunities(q('#filter').value);renderMarket(data.market||[],data.caveats||{});
}

q('#filter').addEventListener('change',e=>renderOpportunities(e.target.value));
q('#demoBtn').addEventListener('click',openDemo);
q('#loginForm').addEventListener('submit',async e=>{
 e.preventDefault();showAuthMessage('Autenticando...');
 try{
  const r=await fetch(AUTH_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:q('#email').value.trim(),password:q('#password').value})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.access_token)throw new Error('E-mail ou senha inválidos.');
  sessionStorage.setItem('uni_access_token',data.access_token);q('#password').value='';await loadRealDashboard(data.access_token);showAuthMessage('');
 }catch(err){sessionStorage.removeItem('uni_access_token');showAuthMessage(err.message||'Falha de autenticação.',true);}
});
q('#logoutBtn').addEventListener('click',resetToLogin);

(async()=>{const token=sessionStorage.getItem('uni_access_token');if(token){try{await loadRealDashboard(token);}catch{resetToLogin();showAuthMessage('Sessão anterior expirada. Entre novamente.');}}})();
