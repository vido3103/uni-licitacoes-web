"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveCurrentClientId } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";

type Row=Record<string,unknown>;
type Stage="Oportunidade"|"Análise"|"Cotação"|"Disputa"|"Resultado";
const stages:Stage[]=["Oportunidade","Análise","Cotação","Disputa","Resultado"];
const txt=(v:unknown,f="—")=>typeof v==="string"&&v.trim()?v:f;
const date=(v:unknown)=>{if(typeof v!=="string")return"—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("pt-BR").format(d)};
const money=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>0?new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n):"—"};
function stageOf(r:Row):Stage{
 const match=String(r.match_status??"");
 const triage=String(r.triage_result??r.triage_status??"");
 const gate=String(r.gate_decision??r.participation_decision??"");
 const deadline=r.proposal_deadline?new Date(String(r.proposal_deadline)).getTime():0;
 const now=Date.now();
 if(["won","lost","awarded","closed","encerrado","homologado"].some(x=>String(r.status??"").toLowerCase().includes(x)))return"Resultado";
 if(deadline>0&&deadline<now)return"Resultado";
 if(r.participation_allowed===true||gate.includes("approved")||gate.includes("aprovado"))return"Disputa";
 if(["completed","approved","queued_for_ai","analyzed"].some(x=>triage.includes(x))||match==="approved")return"Cotação";
 if(["queued_for_analysis","processing","candidate","matched"].includes(match)||triage)return"Análise";
 return"Oportunidade";
}

export default function Negocios({onNavigate}:{onNavigate?:(module:string)=>void}){
 const[rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState("");
 async function load(){if(!supabase)return;setLoading(true);setError("");try{const clientId=await resolveCurrentClientId();if(!clientId)throw new Error("Cliente não associado.");const{data,error:e}=await supabase.from("client_radar_dashboard").select("*").eq("client_id",clientId).order("publication_date",{ascending:false}).limit(500);if(e)throw e;setRows((data??[])as Row[])}catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar os negócios.")}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?rows.filter(r=>[r.process_number,r.buyer_name,r.object_text,r.title,r.modality].some(v=>String(v??"").toLowerCase().includes(q))):rows},[rows,query]);
 const grouped=useMemo(()=>Object.fromEntries(stages.map(s=>[s,filtered.filter(r=>stageOf(r)===s)]))as Record<Stage,Row[]>,[filtered]);
 const active=filtered.filter(r=>stageOf(r)!=="Resultado").length,dispute=grouped["Disputa"].length,result=grouped["Resultado"].length,totalValue=filtered.reduce((a,r)=>a+Number(r.estimated_total_value??r.estimated_value??0),0);
 if(loading)return <div className="p-8 text-sm text-slate-500">Carregando negócios...</div>;
 return <div className="mx-auto max-w-[1600px] p-5 sm:p-7 xl:p-8">
  <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Jornada UNI</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Negócios</h1><p className="mt-2 text-sm text-slate-500">Da oportunidade encontrada ao resultado da disputa, em uma única visão operacional.</p></div><div className="flex gap-2"><button onClick={()=>onNavigate?.("Oportunidades")} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm">Buscar oportunidades</button><button onClick={()=>void load()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white">Atualizar</button></div></div>
  {error&&<div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
  <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Negócios ativos",active,"text-slate-900"],["Em disputa",dispute,"text-blue-600"],["Resultados",result,"text-violet-600"],["Valor mapeado",money(totalValue),"text-emerald-600"]].map(([l,v,c])=><div key={String(l)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold text-slate-500">{l}</p><p className={`mt-2 text-2xl font-black ${c}`}>{String(v)}</p></div>)}</div>
  <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por órgão, número, objeto ou modalidade..." className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400"/></div>
  <div className="overflow-x-auto pb-3"><div className="grid min-w-[1380px] grid-cols-5 gap-4">{stages.map(stage=><section key={stage} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><div className="mb-3 flex items-center justify-between px-1"><div><h2 className="text-sm font-black text-slate-800">{stage}</h2><p className="mt-0.5 text-[10px] text-slate-400">{stage==="Oportunidade"?"Encontrar":stage==="Análise"?"Analisar":stage==="Cotação"?"Precificar":stage==="Disputa"?"Disputar":"Acompanhar"}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-600 shadow-sm">{grouped[stage].length}</span></div><div className="space-y-3">{grouped[stage].slice(0,30).map((r,i)=><article key={`${String(r.opportunity_id??r.process_number)}-${i}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-md"><div className="flex items-start justify-between gap-2"><span className="rounded-md bg-blue-50 px-2 py-1 text-[9px] font-black uppercase text-blue-700">{txt(r.modality,"Licitação")}</span><span className="text-[9px] font-semibold text-slate-400">{date(r.proposal_deadline)}</span></div><h3 className="mt-2 line-clamp-2 text-xs font-black leading-5 text-slate-800">{txt(r.process_number,"Sem número")}</h3><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{txt(r.buyer_name)}</p><p className="mt-2 line-clamp-3 text-[10px] leading-4 text-slate-500">{txt(r.object_text,txt(r.title,"Objeto não informado"))}</p><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2"><span className="text-[10px] font-bold text-emerald-700">{money(r.estimated_total_value??r.estimated_value)}</span><button onClick={()=>onNavigate?.("Oportunidades")} className="text-[10px] font-black text-blue-600">Abrir →</button></div></article>)}{grouped[stage].length===0&&<div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-5 text-center text-[11px] text-slate-400">Nenhum negócio nesta etapa.</div>}</div></section>)}</div></div>
 </div>
}
