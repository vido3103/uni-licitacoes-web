"use client";

import {useEffect,useMemo,useState} from "react";
import {loadCurrentClientDashboard,type BackendDashboard} from "@/lib/dashboard";

type Row=Record<string,unknown>;
type Group={label:string;count:number;value:number};

const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(n||0);
const txt=(v:unknown,f="—")=>v===null||v===undefined||String(v).trim()===""?f:String(v);
const valueOf=(o:Row)=>Number(o.estimated_total_value||o.estimated_value||0)||0;
const card="rounded-xl border border-[#dbe7f2] bg-white shadow-sm";

function group(rows:Row[],label:(row:Row)=>string):Group[]{
 const map=new Map<string,{count:number;value:number}>();
 for(const row of rows){
  const key=label(row).trim();
  if(!key||key==="—")continue;
  const current=map.get(key)??{count:0,value:0};
  current.count+=1;
  current.value+=valueOf(row);
  map.set(key,current);
 }
 return [...map.entries()].map(([name,data])=>({label:name,...data})).sort((a,b)=>b.value-a.value||b.count-a.count||a.label.localeCompare(b.label,"pt-BR"));
}

export default function Inteligencia(){
 const[data,setData]=useState<BackendDashboard|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{void(async()=>{try{const d=await loadCurrentClientDashboard();if(!d)throw new Error("Cliente não associado.");setData(d)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setLoading(false)}})()},[]);
 const opps=useMemo(()=>(data?.opportunities??[])as Row[],[data]);
 const total=useMemo(()=>opps.reduce((sum,row)=>sum+valueOf(row),0),[opps]);
 const buyers=useMemo(()=>group(opps,row=>txt(row.buyer_name,"")),[opps]);
 const regions=useMemo(()=>group(opps,row=>[txt(row.city,""),txt(row.state,"")].filter(Boolean).join("/")||""),[opps]);
 const categories=useMemo(()=>group(opps,row=>txt(row.object_text,txt(row.title,"")).split(/[,;\-]/)[0].trim()),[opps]);
 const withValue=useMemo(()=>opps.filter(row=>valueOf(row)>0).length,[opps]);
 const withDeadline=useMemo(()=>opps.filter(row=>Boolean(row.proposal_deadline)).length,[opps]);
 if(loading)return <div className="p-8 text-sm text-slate-500">Carregando inteligência...</div>;
 return <main className="mx-auto max-w-[1500px] p-5 text-[#08245c]">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-[26px] font-black">Inteligência</h1><p className="mt-1 text-[12px] font-medium text-[#315a92]">Leitura consolidada dos dados reais disponíveis para o cliente.</p></div><span className="rounded-lg border border-[#cfe0ef] bg-white px-3 py-2 text-[10px] font-bold text-[#315a92]">Base atual do Veence</span></div>
  {error&&<div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
  <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
   <Metric value={opps.length} label="Oportunidades na base"/>
   <Metric value={money(total)} label="Valor estimado disponível"/>
   <Metric value={buyers.length} label="Órgãos identificados"/>
   <Metric value={regions.length} label="Localidades identificadas"/>
   <Metric value={categories.length} label="Categorias derivadas do objeto"/>
  </section>
  <div className="mt-4 grid gap-4 xl:grid-cols-3">
   <GroupTable title="Principais órgãos" rows={buyers}/>
   <GroupTable title="Categorias por objeto" rows={categories}/>
   <GroupTable title="Oportunidades por localidade" rows={regions}/>
  </div>
  <section className={`${card} mt-4 p-5`}><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-[13px] font-black">Cobertura dos dados</h2><p className="mt-1 text-[10px] text-[#607a9e]">Indicadores de completude calculados diretamente sobre os registros carregados.</p></div><span className="text-[10px] font-bold text-[#315a92]">{opps.length} registro(s)</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Coverage label="Com valor estimado" count={withValue} total={opps.length}/><Coverage label="Com prazo de proposta" count={withDeadline} total={opps.length}/></div></section>
  {!opps.length&&<div className="mt-4 rounded-xl border border-dashed border-[#cfe0ef] bg-white p-8 text-center text-sm text-slate-500">Ainda não há oportunidades disponíveis para produzir indicadores de inteligência.</div>}
 </main>;
}

function Metric({value,label}:{value:string|number;label:string}){return <div className={`${card} p-4`}><b className="text-[24px]">{value}</b><p className="mt-1 text-[10px] font-semibold text-[#315a92]">{label}</p></div>}
function GroupTable({title,rows}:{title:string;rows:Group[]}){return <section className={`${card} overflow-hidden`}><div className="border-b border-[#e6eef6] p-4"><h2 className="text-[13px] font-black">{title}</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-[10px]"><thead className="bg-[#f4f8fc] text-[#31578c]"><tr><th className="p-3">Nome</th><th className="text-center">Qtd.</th><th className="pr-3 text-right">Valor estimado</th></tr></thead><tbody>{rows.slice(0,8).map(row=><tr key={row.label} className="border-t border-[#e6eef6]"><td className="p-3 font-bold">{row.label}</td><td className="text-center">{row.count}</td><td className="pr-3 text-right font-bold">{money(row.value)}</td></tr>)}{!rows.length&&<tr><td colSpan={3} className="p-6 text-center text-slate-400">Sem dados disponíveis.</td></tr>}</tbody></table></div></section>}
function Coverage({label,count,total}:{label:string;count:number;total:number}){const percent=total?Math.round(count/total*100):0;return <div className="rounded-lg bg-[#f6faff] p-4"><div className="flex items-center justify-between gap-3"><span className="text-[11px] font-bold">{label}</span><b className="text-[11px]">{count}/{total} · {percent}%</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e3edf7]"><div className="h-full rounded-full bg-[#0a66f5]" style={{width:`${percent}%`}}/></div></div>}
