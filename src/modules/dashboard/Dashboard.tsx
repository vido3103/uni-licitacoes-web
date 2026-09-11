"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BackendDashboard, loadCurrentClientDashboard } from "@/lib/dashboard";

interface DashboardProps { onNavigate?: (module: string) => void; }
type Opportunity = Record<string, unknown>;
type Tone = "blue" | "green" | "amber" | "violet" | "rose";

const dot: Record<Tone, string> = { blue:"bg-blue-500", green:"bg-emerald-500", amber:"bg-amber-500", violet:"bg-violet-500", rose:"bg-rose-500" };
const badge: Record<Tone, string> = { blue:"bg-blue-50 text-blue-700", green:"bg-emerald-50 text-emerald-700", amber:"bg-amber-50 text-amber-700", violet:"bg-violet-50 text-violet-700", rose:"bg-rose-50 text-rose-700" };

function n(v: unknown) { const x=Number(v??0); return Number.isFinite(x)?x:0; }
function t(v: unknown,fallback="—") { return typeof v==="string"&&v.trim()?v:fallback; }
function formatDate(v: unknown) { if(typeof v!=="string") return "—"; const d=new Date(v); return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("pt-BR").format(d); }
function status(o: Opportunity): {label:string;tone:Tone} { if(o.participation_allowed===true)return{label:"Liberada",tone:"green"}; const m=t(o.match_status,"candidate"); if(m==="approved")return{label:"Aprovada",tone:"green"}; if(m==="rejected"||m==="filtered_out")return{label:"Não aprovada",tone:"rose"}; if(m==="analyzed")return{label:"Analisada",tone:"violet"}; if(m==="queued_for_analysis")return{label:"Em análise",tone:"blue"}; return{label:"Candidata",tone:"amber"}; }
function errorMessage(error: unknown) { if(error instanceof Error)return error.message; if(typeof error==="string")return error; try{return JSON.stringify(error);}catch{return "Falha inesperada ao carregar o painel.";} }

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [data,setData]=useState<BackendDashboard|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");
  const [updatedAt,setUpdatedAt]=useState<Date|null>(null);
  const [referenceNow]=useState(Date.now);

  const load=useCallback(async(initial=false)=>{
    if(initial)setLoading(true);else setRefreshing(true); setError("");
    try { const payload=await loadCurrentClientDashboard(); if(!payload) throw new Error("Nenhum ambiente empresarial foi associado a este usuário."); setData(payload); setUpdatedAt(new Date()); }
    catch(e){ setError(errorMessage(e)); }
    finally { setLoading(false); setRefreshing(false); }
  },[]);

  useEffect(()=>{ void load(true); },[load]);

  const opportunities=useMemo(()=>data?.opportunities??[],[data?.opportunities]);
  const live=n(data?.summary?.live_count), historical=n(data?.summary?.historical_count), released=n(data?.summary?.released_for_participation_count), pending=n(data?.pending?.open_pending_count), blocking=n(data?.pending?.blocking_pending_count), unknown=n(data?.summary?.unknown_count);
  const deadlines=useMemo(()=>opportunities.filter(o=>typeof o.proposal_deadline==="string"&&new Date(o.proposal_deadline as string).getTime()>=referenceNow).sort((a,b)=>new Date(a.proposal_deadline as string).getTime()-new Date(b.proposal_deadline as string).getTime()).slice(0,4),[opportunities,referenceNow]);
  const monthly=useMemo(()=>{const now=new Date(referenceNow);return Array.from({length:6},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-5+i,1);const count=opportunities.filter(o=>{if(typeof o.publication_date!=="string")return false;const p=new Date(o.publication_date);return p.getFullYear()===d.getFullYear()&&p.getMonth()===d.getMonth();}).length;return{label:new Intl.DateTimeFormat("pt-BR",{month:"short"}).format(d).replace(".",""),count};});},[opportunities,referenceNow]);
  const max=Math.max(1,...monthly.map(x=>x.count));
  const points=monthly.map((x,i)=>`${20+i*112},${155-(x.count/max)*100}`).join(" ");
  const client=data?.client?.display_name||data?.client?.legal_name||"Cliente";
  const today=new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date());
  const total=live+historical+unknown, lp=total?(live/total)*100:0, hp=total?(historical/total)*100:0;
  const sync=data?.enrollments?.[0]??{};

  if(loading)return <div className="px-4 py-6 sm:px-6 xl:px-8"><div className="mx-auto max-w-[1540px] rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><div className="h-2 w-40 animate-pulse rounded bg-slate-200"/><p className="mt-4 text-sm text-slate-500">Carregando painel operacional...</p></div></div>;
  if(error&&!data)return <div className="px-4 py-6 sm:px-6 xl:px-8"><div className="mx-auto max-w-[1540px] rounded-2xl border border-rose-200 bg-rose-50 p-8"><h2 className="font-bold text-rose-800">Não foi possível carregar o Dashboard</h2><p className="mt-2 text-sm text-rose-700">{error}</p><button type="button" onClick={()=>void load(true)} className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white">Tentar novamente</button></div></div>;
  if(!data)return null;

  const kpis=[
    {icon:"⌕",value:live,title:"Oportunidades Ativas",helper:"Abrir Radar",gradient:"from-blue-500 to-blue-600",target:"Radar"},
    {icon:"!",value:pending,title:"Pendências Abertas",helper:`${blocking} bloqueadoras`,gradient:"from-orange-500 to-amber-500",target:"Configurações"},
    {icon:"✓",value:released,title:"Liberadas p/ Participação",helper:"Abrir Gate Econômico",gradient:"from-emerald-500 to-green-600",target:"Gate Econômico"},
    {icon:"▥",value:historical,title:"Oportunidades Históricas",helper:"Abrir Editais",gradient:"from-violet-500 to-purple-600",target:"Editais"},
  ];

  return <div className="px-4 py-6 sm:px-6 xl:px-8"><div className="mx-auto max-w-[1540px]">
    {error&&<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><span>Última atualização falhou: {error}</span><button onClick={()=>void load()} className="font-semibold underline">Tentar novamente</button></div>}
    <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-start"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Dashboard operacional</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{client}</h1><p className="mt-1 text-base text-slate-500">Visão consolidada com dados reais do ambiente autenticado.</p></div><div className="flex flex-wrap items-center gap-3"><div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500"><p className="font-semibold capitalize text-slate-800">{today}</p><p>{updatedAt?`Atualizado às ${updatedAt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`:"Aguardando atualização"}</p></div><button type="button" onClick={()=>void load()} disabled={refreshing} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{refreshing?"Atualizando...":"Atualizar"}</button></div></div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(k=><button type="button" key={k.title} onClick={()=>onNavigate?.(k.target)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><div className="flex items-start gap-4"><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${k.gradient} text-lg font-bold text-white shadow-sm`}>{k.icon}</div><div><div className="text-2xl font-bold text-slate-900">{k.value}</div><div className="text-sm text-slate-600">{k.title}</div></div></div><div className="mt-4 text-xs font-medium text-slate-400">{k.helper} →</div></button>)}</div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_1fr_0.72fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Evolução de oportunidades</h2><span className="text-xs text-slate-400">Últimos 6 meses</span></div><div className="mt-5 h-[190px] rounded-xl bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:20%_25%] p-4"><svg viewBox="0 0 600 180" className="h-full w-full" role="img" aria-label="Evolução mensal de oportunidades"><polyline points={points} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.split(" ").map(p=>{const[cx,cy]=p.split(",");return <circle key={p} cx={cx} cy={cy} r="5" fill="#3b82f6" stroke="white" strokeWidth="2"/>})}</svg></div><div className="mt-2 flex justify-between px-3 text-[11px] text-slate-400">{monthly.map(x=><span key={x.label}>{x.label} <strong className="text-slate-600">{x.count}</strong></span>)}</div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Status do Radar</h2><div className="mt-5 flex items-center gap-6"><div className="relative h-36 w-36 shrink-0 rounded-full" style={{background:total?`conic-gradient(#3b82f6 0 ${lp}%,#8b5cf6 ${lp}% ${lp+hp}%,#f59e0b ${lp+hp}% 100%)`:"#e2e8f0"}}><div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-bold">{total}</span><span className="text-xs text-slate-500">Total</span></div></div><div className="min-w-0 flex-1 space-y-2.5 text-xs">{[["blue","Ativas",live],["violet","Históricas",historical],["amber","Sem classificação",unknown],["green","Liberadas",released],["rose","Pendências bloqueadoras",blocking]].map(([c,l,v])=><div key={String(l)} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${dot[c as Tone]}`}/>{l}</span><strong>{v}</strong></div>)}</div></div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">Próximos prazos</h2><button type="button" onClick={()=>onNavigate?.("Radar")} className="text-xs font-semibold text-blue-600">Ver todos</button></div><div className="space-y-2">{deadlines.length===0&&<p className="py-6 text-center text-xs text-slate-400">Nenhum prazo futuro no Radar.</p>}{deadlines.map((o,i)=><button type="button" onClick={()=>onNavigate?.("Radar")} key={`${t(o.opportunity_id)}-${i}`} className="block w-full rounded-xl border border-slate-100 p-3 text-left hover:border-blue-200 hover:bg-blue-50/30"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{t(o.process_number)}</p><p className="mt-1 truncate text-[11px] text-slate-500">{t(o.buyer_name)}</p></div><span className="shrink-0 text-[11px] font-semibold text-rose-600">{formatDate(o.proposal_deadline)}</span></div></button>)}</div></section>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_0.8fr]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between px-5 py-4"><div><h2 className="font-bold">Últimas oportunidades</h2><p className="mt-1 text-xs text-slate-400">Dados do tenant, sem registros demonstrativos.</p></div><button type="button" onClick={()=>onNavigate?.("Editais")} className="text-xs font-semibold text-blue-600">Abrir Editais</button></div><div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{["Órgão","Modalidade","Número","Objeto","Prazo","Status",""].map((h,i)=><th key={`${h}-${i}`} className="px-5 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{opportunities.slice(0,6).map((o,i)=>{const s=status(o);return <tr key={`${t(o.opportunity_id)}-${i}`} className="hover:bg-slate-50/70"><td className="px-5 py-3 font-semibold">{t(o.buyer_name)}</td><td className="px-5 py-3 text-slate-500">{t(o.modality)}</td><td className="px-5 py-3">{t(o.process_number)}</td><td className="max-w-[280px] truncate px-5 py-3">{t(o.object_text,t(o.title))}</td><td className="px-5 py-3">{formatDate(o.proposal_deadline)}</td><td className="px-5 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${badge[s.tone]}`}>{s.label}</span></td><td className="px-5 py-3"><button type="button" onClick={()=>onNavigate?.("Radar")} className="font-semibold text-blue-600">Abrir</button></td></tr>})}{opportunities.length===0&&<tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">Nenhuma oportunidade disponível para este ambiente.</td></tr>}</tbody></table></div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Estado operacional</h2><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">BACKEND REAL</span></div><div className="space-y-4 text-xs"><div className="flex gap-3"><span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500"/><div><p className="font-semibold">Tenant autenticado</p><p className="text-slate-500">{client}</p></div></div><div className="flex gap-3"><span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-blue-500"/><div><p className="font-semibold">Monitoramento</p><p className="text-slate-500">{sync.monitoring_enabled===false?"Desativado":"Ativo"} · última sincronização {formatDate(sync.last_sync_at)}</p></div></div><div className="flex gap-3"><span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${blocking?"bg-rose-500":"bg-emerald-500"}`}/><div><p className="font-semibold">Pendências</p><p className="text-slate-500">{pending} abertas, {blocking} bloqueadoras</p></div></div><div className="rounded-xl bg-slate-50 p-3 text-slate-500">O Dashboard somente resume informações persistidas. Ações operacionais permanecem nos respectivos módulos.</div></div></section>
    </div>

    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold">Acesso rápido</h2><span className="text-xs text-slate-400">Atalhos funcionais</span></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{[["Radar","⌕","Radar"],["Editais","▣","Editais"],["CFP","🛒","CFP"],["Gate Econômico","▥","Gate Econômico"],["Documentos","□","Documentos"],["Configurações","⚙","Configurações"]].map(([m,i,l])=><button type="button" key={l} onClick={()=>onNavigate?.(m)} className="rounded-xl border border-slate-200 bg-white p-4 text-center hover:border-blue-200 hover:bg-blue-50/20"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-600">{i}</span><span className="mt-2 block text-xs font-semibold">{l}</span></button>)}</div></section>
  </div></div>;
}
