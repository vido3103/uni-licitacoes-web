"use client";

import { useEffect, useMemo, useState } from "react";
import { BackendDashboard, loadCurrentClientDashboard } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";

type Opportunity = Record<string, unknown>;
type Item = {id:string;opportunity_id:string;item_number:number|null;description:string;quantity:number;unit:string|null;estimated_unit_value:number|null;status:string};
type Quote = {id:string;item_id:string;supplier_name:string;unit_cost:number;freight_cost:number;tax_percent:number;admin_percent:number;brand_model:string|null};
type GateResult = {id:string;cfp_item_id:string;quote_id:string;final_unit_cost:number;suggested_unit_price:number;estimated_unit_value:number|null;viability_status:string;target_markup_percent:number;updated_at:string};

function text(v:unknown,f="—"){return v===null||v===undefined||v===""?f:String(v)}
function money(v:unknown){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n):"—"}
function errorMessage(v:unknown){if(v instanceof Error)return v.message;if(v&&typeof v==="object"){const o=v as Record<string,unknown>;return [o.message,o.details,o.hint,o.code].filter(Boolean).map(String).join(" · ")||"Erro não identificado."}return String(v)}
function viabilityLabel(v:string){return v==="viable"?"VIÁVEL":v==="not_viable"?"INVIÁVEL":"REFERÊNCIA AUSENTE"}

export default function GateEconomico(){
  const [dashboard,setDashboard]=useState<BackendDashboard|null>(null);
  const [items,setItems]=useState<Item[]>([]);
  const [quotes,setQuotes]=useState<Quote[]>([]);
  const [results,setResults]=useState<GateResult[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [opportunityId,setOpportunityId]=useState("");
  const [markup,setMarkup]=useState("30");

  async function boot(){
    setLoading(true);setError("");
    try{const d=await loadCurrentClientDashboard();if(!d?.client?.id)throw new Error("Tenant não associado.");setDashboard(d);if(!opportunityId&&d.opportunities.length)setOpportunityId(String(d.opportunities[0].opportunity_id));}
    catch(e){setError(errorMessage(e))}finally{setLoading(false)}
  }
  useEffect(()=>{void boot()},[]);

  async function loadData(){
    if(!supabase||!dashboard?.client?.id||!opportunityId){setItems([]);setQuotes([]);setResults([]);return}
    setError("");
    const {data:ir,error:ie}=await supabase.from("cfp_items").select("id,opportunity_id,item_number,description,quantity,unit,estimated_unit_value,status").eq("client_id",dashboard.client.id).eq("opportunity_id",opportunityId).order("item_number",{ascending:true,nullsFirst:false});
    if(ie){setError(errorMessage(ie));return}const typed=(ir??[]) as Item[];setItems(typed);
    const ids=typed.map(i=>i.id);if(!ids.length){setQuotes([]);setResults([]);return}
    const [qr,gr]=await Promise.all([
      supabase.from("cfp_quotes").select("id,item_id,supplier_name,unit_cost,freight_cost,tax_percent,admin_percent,brand_model").eq("client_id",dashboard.client.id).in("item_id",ids),
      supabase.from("gate_economic_results").select("id,cfp_item_id,quote_id,final_unit_cost,suggested_unit_price,estimated_unit_value,viability_status,target_markup_percent,updated_at").eq("client_id",dashboard.client.id).eq("opportunity_id",opportunityId)
    ]);
    if(qr.error){setError(errorMessage(qr.error));return}if(gr.error){setError(errorMessage(gr.error));return}
    setQuotes((qr.data??[]) as Quote[]);setResults((gr.data??[]) as GateResult[]);
  }
  useEffect(()=>{void loadData()},[dashboard?.client?.id,opportunityId]);

  const opportunities=(dashboard?.opportunities??[]) as Opportunity[];
  const rows=useMemo(()=>items.map(item=>{
    const qs=quotes.filter(q=>q.item_id===item.id);
    const best=qs.length?[...qs].sort((a,b)=>(Number(a.unit_cost)+Number(a.freight_cost))-(Number(b.unit_cost)+Number(b.freight_cost)))[0]:null;
    const m=Number(markup||30);let finalCost:number|null=null,price:number|null=null,status="reference_missing";
    if(best){const base=Number(best.unit_cost)+Number(best.freight_cost);finalCost=base*(1+(Number(best.tax_percent||0)+Number(best.admin_percent||0))/100);price=finalCost*(1+m/100);if(item.estimated_unit_value&&Number(item.estimated_unit_value)>0)status=price<=Number(item.estimated_unit_value)?"viable":"not_viable";}
    return{item,quotes:qs,best,finalCost,price,status,saved:results.find(r=>r.cfp_item_id===item.id)};
  }),[items,quotes,results,markup]);

  async function consolidate(){
    if(!supabase||!dashboard?.client?.id||!opportunityId)return;const ready=rows.filter(r=>r.item.status==="validated"&&r.best&&r.finalCost!==null&&r.price!==null);if(!ready.length){setMessage("Nenhum item CFP validado com cotação disponível para consolidar.");return}
    setBusy(true);setMessage("");
    try{const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw new Error("Sessão não autenticada.");for(const r of ready){const payload={client_id:dashboard.client.id,opportunity_id:opportunityId,cfp_item_id:r.item.id,quote_id:r.best!.id,quantity:Number(r.item.quantity),unit_cost:Number(r.best!.unit_cost),freight_cost:Number(r.best!.freight_cost||0),tax_percent:Number(r.best!.tax_percent||0),admin_percent:Number(r.best!.admin_percent||0),target_markup_percent:Number(markup||30),final_unit_cost:r.finalCost!,suggested_unit_price:r.price!,estimated_unit_value:r.item.estimated_unit_value?Number(r.item.estimated_unit_value):null,viability_status:r.status,created_by:auth.user.id,updated_at:new Date().toISOString()};const {error:e}=await supabase.from("gate_economic_results").upsert(payload,{onConflict:"client_id,cfp_item_id"});if(e)throw e}setMessage(`Gate Econômico consolidado para ${ready.length} item(ns).`);await loadData();}
    catch(e){setMessage(`Não foi possível consolidar o Gate: ${errorMessage(e)}`)}finally{setBusy(false)}
  }

  const totals=useMemo(()=>rows.reduce((a,r)=>{if(r.price!==null){a.cost+=Number(r.finalCost)*Number(r.item.quantity);a.revenue+=Number(r.price)*Number(r.item.quantity);if(r.status==="viable")a.viable++;if(r.status==="not_viable")a.notViable++;}return a},{cost:0,revenue:0,viable:0,notViable:0}),[rows]);

  if(loading)return <div className="p-8"><div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Carregando Gate Econômico...</div></div>;
  return <div className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Gate Econômico</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Viabilidade Econômica</h1><p className="mt-2 text-sm text-slate-500">Cálculo a partir das cotações validadas no CFP, com markup ajustável e persistência por item.</p></div><button onClick={()=>void loadData()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold">Atualizar</button></div>
    {error&&<div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3 lg:grid-cols-[1fr_180px_auto]"><select value={opportunityId} onChange={e=>setOpportunityId(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="">Selecione uma oportunidade</option>{opportunities.map(o=><option key={String(o.opportunity_id)} value={String(o.opportunity_id)}>{text(o.process_number)} · {text(o.buyer_name)}</option>)}</select><label className="text-xs font-semibold text-slate-500">Markup alvo %<input value={markup} onChange={e=>setMarkup(e.target.value)} type="number" min="0" step="0.1" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/></label><button onClick={()=>void consolidate()} disabled={busy||!opportunityId} className="self-end rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy?"Consolidando...":"Consolidar Gate"}</button></div></section>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Custo total",money(totals.cost)],["Faturamento sugerido",money(totals.revenue)],["Itens viáveis",totals.viable],["Itens inviáveis",totals.notViable]].map(([l,v])=><div key={String(l)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{l}</p><p className="mt-2 text-2xl font-bold text-slate-900">{v}</p></div>)}</div>
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold">Itens e cálculo</h2><p className="mt-1 text-xs text-slate-500">Custo final = (produto + frete) × (1 + imposto + administração). Preço sugerido = custo final × (1 + markup).</p></div><div className="overflow-x-auto"><table className="min-w-[1150px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{["Item","Status CFP","Cotações","Fornecedor base","Custo produto","Frete","Imposto","Admin.","Custo final","Preço sugerido","Referência","Viabilidade","Persistência"].map(h=><th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map(r=><tr key={r.item.id}><td className="max-w-[280px] px-4 py-3 font-semibold">{r.item.item_number?`${r.item.item_number} · `:""}{r.item.description}</td><td className="px-4 py-3">{r.item.status==="validated"?"Validado":"Pendente"}</td><td className="px-4 py-3">{r.quotes.length}</td><td className="px-4 py-3">{r.best?.supplier_name??"—"}</td><td className="px-4 py-3">{r.best?money(r.best.unit_cost):"—"}</td><td className="px-4 py-3">{r.best?money(r.best.freight_cost):"—"}</td><td className="px-4 py-3">{r.best?`${r.best.tax_percent}%`:"—"}</td><td className="px-4 py-3">{r.best?`${r.best.admin_percent}%`:"—"}</td><td className="px-4 py-3 font-semibold">{r.finalCost===null?"—":money(r.finalCost)}</td><td className="px-4 py-3 font-semibold">{r.price===null?"—":money(r.price)}</td><td className="px-4 py-3">{r.item.estimated_unit_value&&Number(r.item.estimated_unit_value)>0?money(r.item.estimated_unit_value):"Não informada"}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${r.status==="viable"?"bg-emerald-50 text-emerald-700":r.status==="not_viable"?"bg-rose-50 text-rose-700":"bg-amber-50 text-amber-700"}`}>{r.best?viabilityLabel(r.status):"SEM COTAÇÃO"}</span></td><td className="px-4 py-3">{r.saved?"Consolidado":"Não consolidado"}</td></tr>)}{rows.length===0&&<tr><td colSpan={13} className="px-4 py-8 text-center text-slate-400">Nenhum item cadastrado no CFP para esta oportunidade.</td></tr>}</tbody></table></div></section>
    {message&&<div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{message}</div>}
  </div>;
}
