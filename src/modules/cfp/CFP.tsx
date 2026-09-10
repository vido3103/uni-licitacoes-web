"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BackendDashboard, loadCurrentClientDashboard } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";

type Opportunity = Record<string, unknown>;
type CfpItem = { id:string; opportunity_id:string; item_number:number|null; description:string; quantity:number; unit:string|null; estimated_unit_value:number|null; status:string; created_at:string };
type Quote = { id:string; item_id:string; supplier_name:string; product_description:string|null; brand_model:string|null; unit_cost:number; freight_cost:number; tax_percent:number; admin_percent:number; availability:string|null; source_url:string|null; notes:string|null; created_at:string };

function text(v:unknown,f="—"){return v===null||v===undefined||v===""?f:String(v)}
function money(v:unknown){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n):"—"}
function err(v:unknown){if(v instanceof Error)return v.message;if(v&&typeof v==="object"){const o=v as Record<string,unknown>;return [o.message,o.details,o.hint,o.code].filter(Boolean).map(String).join(" · ")||"Erro não identificado."}return String(v)}

export default function CFP(){
  const [dashboard,setDashboard]=useState<BackendDashboard|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selectedOpportunity,setSelectedOpportunity]=useState("");
  const [items,setItems]=useState<CfpItem[]>([]);
  const [quotes,setQuotes]=useState<Quote[]>([]);
  const [selectedItem,setSelectedItem]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [itemForm,setItemForm]=useState({item_number:"",description:"",quantity:"1",unit:"UN",estimated_unit_value:""});
  const [quoteForm,setQuoteForm]=useState({supplier_name:"",product_description:"",brand_model:"",unit_cost:"",freight_cost:"0",tax_percent:"4",admin_percent:"4",availability:"",source_url:"",notes:""});

  async function boot(){
    setLoading(true);setError("");
    try{const data=await loadCurrentClientDashboard();if(!data?.client?.id)throw new Error("Tenant não associado.");setDashboard(data);if(!selectedOpportunity&&data.opportunities.length)setSelectedOpportunity(String(data.opportunities[0].opportunity_id));}
    catch(e){setError(err(e));}
    finally{setLoading(false)}
  }
  useEffect(()=>{void boot()},[]);

  async function loadCfp(){
    if(!supabase||!dashboard?.client?.id||!selectedOpportunity){setItems([]);setQuotes([]);return}
    const {data:itemRows,error:itemError}=await supabase.from("cfp_items").select("id,opportunity_id,item_number,description,quantity,unit,estimated_unit_value,status,created_at").eq("client_id",dashboard.client.id).eq("opportunity_id",selectedOpportunity).order("item_number",{ascending:true,nullsFirst:false}).order("created_at",{ascending:true});
    if(itemError){setError(err(itemError));return}
    const typed=(itemRows??[]) as CfpItem[];setItems(typed);
    if(typed.length&&!typed.some(i=>i.id===selectedItem))setSelectedItem(typed[0].id);
    if(!typed.length)setSelectedItem("");
    const ids=typed.map(i=>i.id);if(!ids.length){setQuotes([]);return}
    const {data:quoteRows,error:quoteError}=await supabase.from("cfp_quotes").select("id,item_id,supplier_name,product_description,brand_model,unit_cost,freight_cost,tax_percent,admin_percent,availability,source_url,notes,created_at").eq("client_id",dashboard.client.id).in("item_id",ids).order("created_at",{ascending:false});
    if(quoteError){setError(err(quoteError));return}setQuotes((quoteRows??[]) as Quote[]);
  }
  useEffect(()=>{void loadCfp()},[dashboard?.client?.id,selectedOpportunity]);

  const opportunities=(dashboard?.opportunities??[]) as Opportunity[];
  const currentOpportunity=opportunities.find(o=>String(o.opportunity_id)===selectedOpportunity);
  const currentItem=items.find(i=>i.id===selectedItem);
  const currentQuotes=quotes.filter(q=>q.item_id===selectedItem);
  const itemStats=useMemo(()=>items.map(item=>{const qs=quotes.filter(q=>q.item_id===item.id);const best=qs.length?Math.min(...qs.map(q=>Number(q.unit_cost)+Number(q.freight_cost))):null;return{item,count:qs.length,best}}),[items,quotes]);

  async function addItem(e:FormEvent){
    e.preventDefault();if(!supabase||!dashboard?.client?.id||!selectedOpportunity)return;
    if(!itemForm.description.trim()){setMessage("Informe a descrição do item.");return}
    setBusy(true);setMessage("");
    try{const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw new Error("Sessão não autenticada.");const {error:e2}=await supabase.from("cfp_items").insert({client_id:dashboard.client.id,opportunity_id:selectedOpportunity,item_number:itemForm.item_number?Number(itemForm.item_number):null,description:itemForm.description.trim(),quantity:Number(itemForm.quantity||1),unit:itemForm.unit||null,estimated_unit_value:itemForm.estimated_unit_value?Number(itemForm.estimated_unit_value):null,created_by:auth.user.id});if(e2)throw e2;setItemForm({item_number:"",description:"",quantity:"1",unit:"UN",estimated_unit_value:""});setMessage("Item incluído no CFP.");await loadCfp();}
    catch(e2){setMessage(`Não foi possível incluir o item: ${err(e2)}`)}finally{setBusy(false)}
  }

  async function addQuote(e:FormEvent){
    e.preventDefault();if(!supabase||!dashboard?.client?.id||!selectedItem)return;
    if(!quoteForm.supplier_name.trim()||quoteForm.unit_cost===""){setMessage("Informe fornecedor e custo unitário.");return}
    setBusy(true);setMessage("");
    try{const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw new Error("Sessão não autenticada.");const {error:e2}=await supabase.from("cfp_quotes").insert({client_id:dashboard.client.id,item_id:selectedItem,supplier_name:quoteForm.supplier_name.trim(),product_description:quoteForm.product_description||null,brand_model:quoteForm.brand_model||null,unit_cost:Number(quoteForm.unit_cost),freight_cost:Number(quoteForm.freight_cost||0),tax_percent:Number(quoteForm.tax_percent||0),admin_percent:Number(quoteForm.admin_percent||0),availability:quoteForm.availability||null,source_url:quoteForm.source_url||null,notes:quoteForm.notes||null,created_by:auth.user.id});if(e2)throw e2;setQuoteForm({supplier_name:"",product_description:"",brand_model:"",unit_cost:"",freight_cost:"0",tax_percent:"4",admin_percent:"4",availability:"",source_url:"",notes:""});setMessage("Cotação registrada.");await loadCfp();}
    catch(e2){setMessage(`Não foi possível registrar a cotação: ${err(e2)}`)}finally{setBusy(false)}
  }

  async function validateItem(item:CfpItem){
    if(!supabase)return;const count=quotes.filter(q=>q.item_id===item.id).length;if(count<3){setMessage("O item precisa de pelo menos 3 cotações para validação CFP.");return}
    setBusy(true);const {error:e2}=await supabase.from("cfp_items").update({status:"validated",updated_at:new Date().toISOString()}).eq("id",item.id);if(e2)setMessage(`Falha ao validar: ${err(e2)}`);else{setMessage("Item validado no CFP com 3 ou mais cotações.");await loadCfp()}setBusy(false);
  }

  if(loading)return <div className="p-8"><div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Carregando CFP...</div></div>;
  if(error&&!dashboard)return <div className="p-8"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700"><p>{error}</p><button onClick={()=>void boot()} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">Tentar novamente</button></div></div>;

  return <div className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">CFP</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Cotação, Fornecedores e Produtos</h1><p className="mt-2 text-sm text-slate-500">Registro rastreável de itens e cotações por oportunidade do ambiente autenticado.</p></div><button onClick={()=>void loadCfp()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold">Atualizar</button></div>

    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><label className="text-xs font-bold uppercase tracking-wide text-slate-500">Oportunidade</label><select value={selectedOpportunity} onChange={e=>setSelectedOpportunity(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="">Selecione...</option>{opportunities.map(o=><option key={String(o.opportunity_id)} value={String(o.opportunity_id)}>{text(o.process_number)} · {text(o.buyer_name)} · {text(o.object_text??o.title)}</option>)}</select>{currentOpportunity&&<div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs text-slate-500"><div><b className="block text-slate-400">Órgão</b>{text(currentOpportunity.buyer_name)}</div><div><b className="block text-slate-400">Processo</b>{text(currentOpportunity.process_number)}</div><div><b className="block text-slate-400">Prazo</b>{text(currentOpportunity.proposal_deadline)}</div></div>}</section>

    <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Itens do CFP</h2><span className="text-xs text-slate-500">{items.length} item(ns)</span></div><form onSubmit={addItem} className="mt-4 grid gap-2 sm:grid-cols-2"><input value={itemForm.item_number} onChange={e=>setItemForm(v=>({...v,item_number:e.target.value}))} type="number" min="1" placeholder="Nº item" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={itemForm.quantity} onChange={e=>setItemForm(v=>({...v,quantity:e.target.value}))} type="number" min="0.0001" step="any" placeholder="Quantidade" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={itemForm.unit} onChange={e=>setItemForm(v=>({...v,unit:e.target.value}))} placeholder="Unidade" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={itemForm.estimated_unit_value} onChange={e=>setItemForm(v=>({...v,estimated_unit_value:e.target.value}))} type="number" min="0" step="0.01" placeholder="Valor estimado unitário" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><textarea value={itemForm.description} onChange={e=>setItemForm(v=>({...v,description:e.target.value}))} placeholder="Descrição do item" className="sm:col-span-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><button disabled={busy||!selectedOpportunity} className="sm:col-span-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Adicionar item</button></form>
        <div className="mt-5 space-y-2">{itemStats.length===0?<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum item cadastrado para esta oportunidade.</p>:itemStats.map(({item,count,best})=><button key={item.id} onClick={()=>setSelectedItem(item.id)} className={`w-full rounded-xl border p-3 text-left ${selectedItem===item.id?"border-blue-300 bg-blue-50":"border-slate-200"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{item.item_number?`Item ${item.item_number} · `:""}{item.description}</p><p className="mt-1 text-xs text-slate-500">{item.quantity} {text(item.unit,"")} · {count}/3 cotações · melhor custo {best===null?"—":money(best)}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.status==="validated"?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700"}`}>{item.status==="validated"?"VALIDADO":"EM COTAÇÃO"}</span></div></button>)}</div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900">Cotações do item</h2><p className="mt-1 text-xs text-slate-500">Regra operacional: 3 referências por item antes da validação.</p></div>{currentItem&&<button disabled={busy||currentQuotes.length<3||currentItem.status==="validated"} onClick={()=>void validateItem(currentItem)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Validar item</button>}</div>
        {!currentItem?<p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Selecione ou cadastre um item para registrar cotações.</p>:<><form onSubmit={addQuote} className="mt-4 grid gap-2 sm:grid-cols-2"><input value={quoteForm.supplier_name} onChange={e=>setQuoteForm(v=>({...v,supplier_name:e.target.value}))} placeholder="Fornecedor" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={quoteForm.brand_model} onChange={e=>setQuoteForm(v=>({...v,brand_model:e.target.value}))} placeholder="Marca / modelo" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={quoteForm.unit_cost} onChange={e=>setQuoteForm(v=>({...v,unit_cost:e.target.value}))} type="number" min="0" step="0.01" placeholder="Custo unitário" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={quoteForm.freight_cost} onChange={e=>setQuoteForm(v=>({...v,freight_cost:e.target.value}))} type="number" min="0" step="0.01" placeholder="Frete" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={quoteForm.tax_percent} onChange={e=>setQuoteForm(v=>({...v,tax_percent:e.target.value}))} type="number" min="0" step="0.01" placeholder="Imposto %" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={quoteForm.admin_percent} onChange={e=>setQuoteForm(v=>({...v,admin_percent:e.target.value}))} type="number" min="0" step="0.01" placeholder="Administração %" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={quoteForm.availability} onChange={e=>setQuoteForm(v=>({...v,availability:e.target.value}))} placeholder="Disponibilidade" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><input value={quoteForm.source_url} onChange={e=>setQuoteForm(v=>({...v,source_url:e.target.value}))} type="url" placeholder="Link / fonte" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><textarea value={quoteForm.product_description} onChange={e=>setQuoteForm(v=>({...v,product_description:e.target.value}))} placeholder="Descrição do produto cotado" className="sm:col-span-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><textarea value={quoteForm.notes} onChange={e=>setQuoteForm(v=>({...v,notes:e.target.value}))} placeholder="Observações" className="sm:col-span-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/><button disabled={busy} className="sm:col-span-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Registrar cotação</button></form>
        <div className="mt-5 overflow-x-auto"><table className="min-w-[720px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{["Fornecedor","Marca/modelo","Custo","Frete","Custo base","Disponibilidade","Fonte"].map(h=><th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{currentQuotes.map(q=><tr key={q.id}><td className="px-3 py-2 font-semibold">{q.supplier_name}</td><td className="px-3 py-2">{text(q.brand_model)}</td><td className="px-3 py-2">{money(q.unit_cost)}</td><td className="px-3 py-2">{money(q.freight_cost)}</td><td className="px-3 py-2 font-semibold">{money(Number(q.unit_cost)+Number(q.freight_cost))}</td><td className="px-3 py-2">{text(q.availability)}</td><td className="px-3 py-2">{q.source_url?<a href={q.source_url} target="_blank" rel="noreferrer" className="font-semibold text-blue-600">Abrir ↗</a>:"—"}</td></tr>)}{currentQuotes.length===0&&<tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Nenhuma cotação registrada.</td></tr>}</tbody></table></div></>}
      </section>
    </div>
    {message&&<div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{message}</div>}
  </div>;
}
