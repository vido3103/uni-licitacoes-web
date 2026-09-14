"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveCurrentClientId } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";

type Row=Record<string,unknown>;
type Stage="Oportunidade"|"Análise"|"Cotação"|"Disputa"|"Resultado";
const stages:Stage[]=["Oportunidade","Análise","Cotação","Disputa","Resultado"];
const txt=(v:unknown,f="—")=>v===null||v===undefined||String(v).trim()===""?f:String(v);
const date=(v:unknown)=>{if(!v)return"—";const d=new Date(String(v));return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("pt-BR").format(d)};
const money=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>0?new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n):"—"};
const lower=(v:unknown)=>String(v??"").toLowerCase();

type PipelineMeta={hasRequirements:boolean;hasAnalysis:boolean;cfpCount:number;validatedCfp:number;economicCount:number;viableCount:number;strategyCount:number;activeCount:number;wonCount:number;lostCount:number};
const emptyMeta=():PipelineMeta=>({hasRequirements:false,hasAnalysis:false,cfpCount:0,validatedCfp:0,economicCount:0,viableCount:0,strategyCount:0,activeCount:0,wonCount:0,lostCount:0});

function stageOf(r:Row,m:PipelineMeta):Stage{
 if(m.wonCount>0||m.lostCount>0)return"Resultado";
 if(m.activeCount>0||m.strategyCount>0)return"Disputa";
 if(m.economicCount>0||m.cfpCount>0)return"Cotação";
 if(m.hasRequirements||m.hasAnalysis)return"Análise";
 const deadline=r.proposal_deadline?new Date(String(r.proposal_deadline)).getTime():0;
 if(deadline>0&&deadline<Date.now())return"Resultado";
 return"Oportunidade";
}
function stageHint(stage:Stage,m:PipelineMeta){
 if(stage==="Resultado")return m.wonCount>0?"Vencido":m.lostCount>0?"Não vencido":"Prazo encerrado";
 if(stage==="Disputa")return m.activeCount>0?"Em disputa":`${m.strategyCount} estratégia(s)`;
 if(stage==="Cotação")return m.economicCount>0?`${m.viableCount}/${m.economicCount} item(ns) viáveis`:m.validatedCfp>0?`${m.validatedCfp} item(ns) validados`:`${m.cfpCount} item(ns) em cotação`;
 if(stage==="Análise")return m.hasAnalysis?"Análise detalhada disponível":"Exigências em análise";
 return"Aguardando análise";
}
function tabForStage(stage:Stage){return stage==="Análise"?"Análise":stage==="Cotação"?"Cotação":stage==="Disputa"?"Disputa":stage==="Resultado"?"Histórico":"Resumo"}

export default function Negocios({onNavigate}:{onNavigate?:(module:string)=>void}){
 const[rows,setRows]=useState<Row[]>([]),[meta,setMeta]=useState<Record<string,PipelineMeta>>({}),[loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState("");
 async function load(){
  if(!supabase)return;setLoading(true);setError("");
  try{
   const clientId=await resolveCurrentClientId();if(!clientId)throw new Error("Cliente não associado.");
   const{data:radar,error:re}=await supabase.from("client_radar_dashboard").select("*").eq("client_id",clientId).order("publication_date",{ascending:false}).limit(500);if(re)throw re;
   const base=(radar??[])as Row[];setRows(base);const ids=[...new Set(base.map(r=>String(r.opportunity_id||"")).filter(Boolean))];if(!ids.length){setMeta({});return}
   const[req,ana,cfp,econ,disp]=await Promise.all([
    supabase.from("opportunity_requirements").select("opportunity_id").eq("client_id",clientId).in("opportunity_id",ids),
    supabase.from("opportunity_ai_analysis_queue").select("opportunity_id,status").eq("client_id",clientId).in("opportunity_id",ids),
    supabase.from("cfp_items").select("id,opportunity_id,status").eq("client_id",clientId).in("opportunity_id",ids),
    supabase.from("gate_economic_results").select("opportunity_id,viability_status").eq("client_id",clientId).in("opportunity_id",ids),
    supabase.from("dispute_strategies").select("opportunity_id,status").eq("client_id",clientId).in("opportunity_id",ids)
   ]);
   for(const x of[req,ana,cfp,econ,disp])if(x.error)throw x.error;
   const next:Record<string,PipelineMeta>={};for(const id of ids)next[id]=emptyMeta();
   for(const x of req.data??[]){const id=String(x.opportunity_id);if(next[id])next[id].hasRequirements=true}
   for(const x of ana.data??[]){const id=String(x.opportunity_id),s=lower(x.status);if(next[id]&&["completed","processing","pending","retry_wait"].includes(s))next[id].hasAnalysis=true}
   for(const x of cfp.data??[]){const id=String(x.opportunity_id);if(next[id]){next[id].cfpCount++;if(lower(x.status)==="validated")next[id].validatedCfp++}}
   for(const x of econ.data??[]){const id=String(x.opportunity_id);if(next[id]){next[id].economicCount++;if(lower(x.viability_status)==="viable")next[id].viableCount++}}
   for(const x of disp.data??[]){const id=String(x.opportunity_id),s=lower(x.status);if(next[id]){next[id].strategyCount++;if(s==="active")next[id].activeCount++;if(s==="won")next[id].wonCount++;if(s==="lost")next[id].lostCount++}}
   setMeta(next);
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar os negócios.")}finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[]);
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?rows.filter(r=>[r.process_number,r.buyer_name,r.object_text,r.title,r.modality].some(v=>String(v??"").toLowerCase().includes(q))):rows},[rows,query]);
 const grouped=useMemo(()=>Object.fromEntries(stages.map(s=>[s,filtered.filter(r=>stageOf(r,meta[String(r.opportunity_id)]??emptyMeta())===s)]))as Record<Stage,Row[]>,[filtered,meta]);
 const active=filtered.filter(r=>stageOf(r,meta[String(r.opportunity_id)]??emptyMeta())!=="Resultado").length,dispute=grouped["Disputa"].length,result=grouped["Resultado"].length,totalValue=filtered.reduce((a,r)=>a+Number(r.estimated_total_value??r.estimated_value??0),0);
 function openOpportunity(r:Row,stage:Stage){const oid=String(r.opportunity_id||"");if(oid){sessionStorage.setItem("uni-opportunity-open",oid);sessionStorage.setItem("uni-opportunity-tab",tabForStage(stage))}onNavigate?.("Oportunidades")}
 if(loading)return <div className="p-8 text-sm text-slate-500">Carregando negócios...</div>;
 return <div className="mx-auto max-w-[1600px] p-5 sm:p-7 xl:p-8">
  <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Jornada UNI</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Negócios</h1><p className="mt-2 text-sm text-slate-500">O estágio é atualizado automaticamente conforme análise, cotação, Gate Econômico e disputa evoluem.</p></div><div className="flex gap-2"><button onClick={()=>onNavigate?.("Oportunidades")} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm">Buscar oportunidades</button><button onClick={()=>void load()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white">Atualizar</button></div></div>
  {error&&<div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
  <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Negócios ativos",active,"text-slate-900"],["Em disputa",dispute,"text-blue-600"],["Resultados",result,"text-violet-600"],["Valor mapeado",money(totalValue),"text-emerald-600"]].map(([l,v,c])=><div key={String(l)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold text-slate-500">{l}</p><p className={`mt-2 text-2xl font-black ${c}`}>{String(v)}</p></div>)}</div>
  <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por órgão, número, objeto ou modalidade..." className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400"/></div>
  <div className="overflow-x-auto pb-3"><div className="grid min-w-[1380px] grid-cols-5 gap-4">{stages.map(stage=><section key={stage} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><div className="mb-3 flex items-center justify-between px-1"><div><h2 className="text-sm font-black text-slate-800">{stage}</h2><p className="mt-0.5 text-[10px] text-slate-400">{stage==="Oportunidade"?"Encontrar":stage==="Análise"?"Analisar":stage==="Cotação"?"Precificar":stage==="Disputa"?"Disputar":"Acompanhar"}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-600 shadow-sm">{grouped[stage].length}</span></div><div className="space-y-3">{grouped[stage].slice(0,30).map((r,i)=>{const m=meta[String(r.opportunity_id)]??emptyMeta();return <article key={`${String(r.opportunity_id??r.process_number)}-${i}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-md"><div className="flex items-start justify-between gap-2"><span className="rounded-md bg-blue-50 px-2 py-1 text-[9px] font-black uppercase text-blue-700">{txt(r.modality,"Licitação")}</span><span className="text-[9px] font-semibold text-slate-400">{date(r.proposal_deadline)}</span></div><h3 className="mt-2 line-clamp-2 text-xs font-black leading-5 text-slate-800">{txt(r.process_number,"Sem número")}</h3><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{txt(r.buyer_name)}</p><p className="mt-2 line-clamp-3 text-[10px] leading-4 text-slate-500">{txt(r.object_text,txt(r.title,"Objeto não informado"))}</p><div className="mt-3 rounded-lg bg-slate-50 px-2 py-2 text-[10px] font-semibold text-slate-600">{stageHint(stage,m)}</div><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2"><span className="text-[10px] font-bold text-emerald-700">{money(r.estimated_total_value??r.estimated_value)}</span><button onClick={()=>openOpportunity(r,stage)} className="text-[10px] font-black text-blue-600">Abrir etapa →</button></div></article>})}{grouped[stage].length===0&&<div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-5 text-center text-[11px] text-slate-400">Nenhum negócio nesta etapa.</div>}</div></section>)}</div></div>
 </div>
}
