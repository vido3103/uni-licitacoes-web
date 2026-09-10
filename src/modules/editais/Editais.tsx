"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BackendDashboard, loadCurrentClientDashboard } from "@/lib/dashboard";

type Opportunity = Record<string, unknown>;
type Filters = {
  location: string; modality: string; category: string; buyer: string;
  minValue: string; maxValue: string; deadlineFrom: string; deadlineTo: string;
  analysisStatus: string; compatibility: string; publicationFrom: string;
  publicationTo: string; process: string; situation: string;
};
type SortKey = "deadline" | "publication" | "value_desc" | "value_asc";

const emptyFilters: Filters = { location:"", modality:"", category:"", buyer:"", minValue:"", maxValue:"", deadlineFrom:"", deadlineTo:"", analysisStatus:"", compatibility:"", publicationFrom:"", publicationTo:"", process:"", situation:"" };
const PAGE_SIZE = 8;

function text(value: unknown, fallback = "") { return value === null || value === undefined || value === "" ? fallback : String(value); }
function normalized(value: unknown) { return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function numberValue(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function dateValue(value: unknown) { if (!value) return null; const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? null : d; }
function money(value: unknown) { const n = numberValue(value); if (n === null || n <= 0) return "Não informado"; return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(n); }
function formatDate(value: unknown, withTime = false) { const d = dateValue(value); if (!d) return "—"; return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle:"short", timeStyle:"short" } : { dateStyle:"short" }).format(d); }
function sourceLabel(row: Opportunity) { const url = normalized(row.source_url); if (url.includes("pncp")) return "PNCP"; if (url.includes("compras")) return "Compras.gov.br"; if (url.includes("cptm")) return "CPTM"; return row.source_url ? "Fonte oficial" : "Fonte não informada"; }
function compatibilityLabel(row: Opportunity) { const status = normalized(row.match_status ?? row.compatibility ?? row.match_result); if (status.includes("filtered") || status.includes("incompat")) return "Incompatível"; if (status.includes("possible") || status.includes("possivel")) return "Possivelmente compatível"; if (status.includes("match") || status.includes("queue") || status.includes("analysis")) return "Compatível"; return "Compatibilidade pendente"; }
function situationLabel(row: Opportunity) { const lifecycle = normalized(row.lifecycle ?? row.lifecycle_class ?? row.situation); if (lifecycle === "live" || lifecycle.includes("active") || lifecycle.includes("ativa")) return "Ativa"; if (lifecycle.includes("historic") || lifecycle.includes("encerr")) return "Histórica"; return text(row.lifecycle ?? row.lifecycle_class ?? row.situation, "Não informada"); }
function analysisLabel(row: Opportunity) { const raw = normalized(row.match_status ?? row.analysis_status ?? row.status); if (raw.includes("queued")) return "Em fila"; if (raw.includes("processing") || raw.includes("analysis")) return "Em análise"; if (raw.includes("completed") || raw.includes("conclu")) return "Concluída"; if (raw.includes("filtered")) return "Não aprovada"; return "Não iniciada"; }
function includesFilter(value: unknown, filter: string) { return !filter.trim() || normalized(value).includes(normalized(filter)); }

export default function Editais() {
  const [data,setData]=useState<BackendDashboard|null>(null);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState("");
  const [query,setQuery]=useState("");
  const [appliedQuery,setAppliedQuery]=useState("");
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [draftFilters,setDraftFilters]=useState<Filters>(emptyFilters);
  const [filters,setFilters]=useState<Filters>(emptyFilters);
  const [sort,setSort]=useState<SortKey>("deadline");
  const [page,setPage]=useState(1);

  async function reload() {
    setLoading(true); setLoadError("");
    try { const result = await loadCurrentClientDashboard(); if (!result) throw new Error("Tenant não associado."); setData(result); }
    catch { setLoadError("Não foi possível carregar os editais do ambiente autenticado."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ void reload(); },[]);
  useEffect(()=>{
    const stored = sessionStorage.getItem("uni-global-search");
    if (!stored) return;
    const q = stored.trim();
    sessionStorage.removeItem("uni-global-search");
    if (!q) return;
    setQuery(q);
    setAppliedQuery(q);
    setPage(1);
  },[]);

  const all = useMemo(() => (data?.opportunities ?? []) as Opportunity[], [data]);
  const unique = (key: string) => Array.from(new Set(all.map(row=>text(row[key])).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const modalities = useMemo(()=>unique("modality"),[all]); // eslint-disable-line react-hooks/exhaustive-deps
  const buyers = useMemo(()=>unique("buyer_name"),[all]); // eslint-disable-line react-hooks/exhaustive-deps
  const locations = useMemo(()=>Array.from(new Set(all.map(row=>[text(row.city),text(row.state)].filter(Boolean).join("/")).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR")),[all]);

  const results = useMemo(()=>{
    const q=normalized(appliedQuery); const min=filters.minValue?Number(filters.minValue):null; const max=filters.maxValue?Number(filters.maxValue):null;
    const df=filters.deadlineFrom?new Date(`${filters.deadlineFrom}T00:00:00`):null, dt=filters.deadlineTo?new Date(`${filters.deadlineTo}T23:59:59`):null;
    const pf=filters.publicationFrom?new Date(`${filters.publicationFrom}T00:00:00`):null, pt=filters.publicationTo?new Date(`${filters.publicationTo}T23:59:59`):null;
    const filtered=all.filter(row=>{
      if(q && ![row.object_text,row.title,row.buyer_name,row.process_number,row.city,row.state,row.modality].map(normalized).join(" ").includes(q)) return false;
      if(filters.location && normalized([text(row.city),text(row.state)].filter(Boolean).join("/"))!==normalized(filters.location)) return false;
      if(filters.modality && normalized(row.modality)!==normalized(filters.modality)) return false;
      if(filters.category && !includesFilter(row.category_name ?? row.category ?? row.object_text,filters.category)) return false;
      if(filters.buyer && normalized(row.buyer_name)!==normalized(filters.buyer)) return false;
      if(filters.process && !includesFilter(row.process_number,filters.process)) return false;
      if(filters.analysisStatus && normalized(analysisLabel(row))!==normalized(filters.analysisStatus)) return false;
      if(filters.compatibility && normalized(compatibilityLabel(row))!==normalized(filters.compatibility)) return false;
      if(filters.situation && normalized(situationLabel(row))!==normalized(filters.situation)) return false;
      const value=numberValue(row.estimated_value); if(min!==null && (value===null || value<min)) return false; if(max!==null && (value===null || value>max)) return false;
      const deadline=dateValue(row.proposal_deadline); if(df&&(!deadline||deadline<df))return false; if(dt&&(!deadline||deadline>dt))return false;
      const pub=dateValue(row.publication_date); if(pf&&(!pub||pub<pf))return false; if(pt&&(!pub||pub>pt))return false;
      return true;
    });
    return [...filtered].sort((a,b)=>{
      if(sort==="value_desc"||sort==="value_asc"){ const av=numberValue(a.estimated_value)??0,bv=numberValue(b.estimated_value)??0; return sort==="value_desc"?bv-av:av-bv; }
      const field=sort==="publication"?"publication_date":"proposal_deadline"; const av=dateValue(a[field])?.getTime()??Number.MAX_SAFE_INTEGER,bv=dateValue(b[field])?.getTime()??Number.MAX_SAFE_INTEGER; return av-bv;
    });
  },[all,appliedQuery,filters,sort]);

  useEffect(()=>setPage(1),[appliedQuery,filters,sort]);
  const totalPages=Math.max(1,Math.ceil(results.length/PAGE_SIZE));
  const visible=results.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  const summary=useMemo(()=>{ const now=Date.now(); return { compatible:all.filter(r=>compatibilityLabel(r)==="Compatível").length, possible:all.filter(r=>compatibilityLabel(r)==="Possivelmente compatível").length, soon:all.filter(r=>{const d=dateValue(r.proposal_deadline)?.getTime();return !!d&&d>now&&d-now<=72*60*60*1000}).length, analysis:all.filter(r=>["Em fila","Em análise"].includes(analysisLabel(r))).length }; },[all]);
  const activeFilterCount=Object.values(filters).filter(Boolean).length;
  function submitSearch(e:FormEvent){e.preventDefault();setAppliedQuery(query.trim());}
  function setDraft<K extends keyof Filters>(key:K,value:Filters[K]){setDraftFilters(c=>({...c,[key]:value}));}
  function applyFilters(){setFilters(draftFilters);setFiltersOpen(false);}
  function clearFilters(){setDraftFilters(emptyFilters);setFilters(emptyFilters);setQuery("");setAppliedQuery("");setPage(1);}

  return <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 xl:p-8">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-7 text-center sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Editais personalizados</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Oportunidades compatíveis com sua empresa</h1>
        <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-slate-500">Busca e refinamento sobre as oportunidades reais vinculadas ao perfil de capacidade do CNPJ autenticado.</p>
        <form onSubmit={submitSearch} className="mx-auto mt-6 flex max-w-4xl items-center gap-2"><div className="flex min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 p-1.5 shadow-sm focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50"><span className="pl-3 text-slate-400">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} type="search" placeholder="Pesquisar objeto, produto, órgão, processo ou palavra-chave..." className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"/><button type="submit" className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Pesquisar</button></div><button type="button" onClick={()=>setFiltersOpen(v=>!v)} className={`relative inline-flex h-[50px] items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${filtersOpen?"border-blue-200 bg-blue-50 text-blue-700":"border-slate-200 bg-white text-slate-700"}`}>☷ <span className="hidden sm:inline">Filtros</span>{activeFilterCount>0&&<span className="rounded-full bg-blue-700 px-1.5 py-0.5 text-[10px] text-white">{activeFilterCount}</span>}</button><button type="button" onClick={()=>void reload()} disabled={loading} className="h-[50px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">{loading?"Atualizando...":"Atualizar"}</button></form>
        {filtersOpen&&<div className="mx-auto mt-5 max-w-4xl rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left sm:p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">Refinar oportunidades</h2><p className="mt-1 text-xs text-slate-500">Todos os campos abaixo possuem efeito real sobre os resultados.</p></div><button onClick={()=>setFiltersOpen(false)} className="text-xs font-semibold text-slate-500">Fechar</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <select value={draftFilters.location} onChange={e=>setDraft("location",e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Estado / município</option>{locations.map(v=><option key={v}>{v}</option>)}</select>
          <select value={draftFilters.modality} onChange={e=>setDraft("modality",e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Modalidade</option>{modalities.map(v=><option key={v}>{v}</option>)}</select>
          <input value={draftFilters.category} onChange={e=>setDraft("category",e.target.value)} placeholder="Categoria / produto" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/>
          <select value={draftFilters.buyer} onChange={e=>setDraft("buyer",e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Órgão</option>{buyers.map(v=><option key={v}>{v}</option>)}</select>
          <input value={draftFilters.minValue} onChange={e=>setDraft("minValue",e.target.value)} type="number" min="0" placeholder="Valor mínimo" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/><input value={draftFilters.maxValue} onChange={e=>setDraft("maxValue",e.target.value)} type="number" min="0" placeholder="Valor máximo" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/>
          <label className="text-xs font-semibold text-slate-500">Prazo de<input value={draftFilters.deadlineFrom} onChange={e=>setDraft("deadlineFrom",e.target.value)} type="date" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal"/></label><label className="text-xs font-semibold text-slate-500">Prazo até<input value={draftFilters.deadlineTo} onChange={e=>setDraft("deadlineTo",e.target.value)} type="date" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal"/></label>
          <select value={draftFilters.analysisStatus} onChange={e=>setDraft("analysisStatus",e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Status da análise</option>{["Não iniciada","Em fila","Em análise","Concluída","Não aprovada"].map(v=><option key={v}>{v}</option>)}</select><select value={draftFilters.compatibility} onChange={e=>setDraft("compatibility",e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Compatibilidade</option>{["Compatível","Possivelmente compatível","Incompatível","Compatibilidade pendente"].map(v=><option key={v}>{v}</option>)}</select>
          <input value={draftFilters.process} onChange={e=>setDraft("process",e.target.value)} placeholder="Número do processo" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/><label className="text-xs font-semibold text-slate-500">Publicação de<input value={draftFilters.publicationFrom} onChange={e=>setDraft("publicationFrom",e.target.value)} type="date" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal"/></label><label className="text-xs font-semibold text-slate-500">Publicação até<input value={draftFilters.publicationTo} onChange={e=>setDraft("publicationTo",e.target.value)} type="date" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal"/></label><select value={draftFilters.situation} onChange={e=>setDraft("situation",e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Situação</option><option>Ativa</option><option>Histórica</option></select>
        </div><div className="mt-4 flex justify-end gap-2"><button onClick={clearFilters} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold">Limpar filtros</button><button onClick={applyFilters} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white">Aplicar filtros</button></div></div>}
      </div>
      <div className="grid gap-4 bg-slate-50/70 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">{[["Compatíveis com o perfil",summary.compatible],["Possivelmente compatíveis",summary.possible],["Encerrando em breve",summary.soon],["Em análise",summary.analysis]].map(([l,v])=><div key={String(l)} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{l}</p><p className="mt-2 text-2xl font-bold">{loading?"…":v}</p></div>)}</div>
    </section>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4"><div><h2 className="text-lg font-bold">Editais selecionados para o seu perfil</h2><p className="mt-1 text-sm text-slate-500">{loading?"Carregando...":`${results.length} resultado(s)`}</p></div><select value={sort} onChange={e=>setSort(e.target.value as SortKey)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"><option value="deadline">Prazo mais próximo</option><option value="publication">Publicação mais recente/próxima</option><option value="value_desc">Maior valor</option><option value="value_asc">Menor valor</option></select></div>
      {loadError?<div className="py-10 text-center text-sm text-rose-600"><p>{loadError}</p><button onClick={()=>void reload()} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">Tentar novamente</button></div>:loading?<div className="py-10 text-center text-sm text-slate-500">Carregando oportunidades...</div>:visible.length===0?<div className="py-12 text-center"><h3 className="font-bold">Nenhum edital encontrado</h3><button onClick={clearFilters} className="mt-3 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold">Limpar pesquisa e filtros</button></div>:<div className="mt-5 grid gap-4 lg:grid-cols-2">{visible.map((row,index)=>{const compatibility=compatibilityLabel(row);return <article key={text(row.opportunity_id,String(index))} className="rounded-2xl border border-slate-200 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-600">{sourceLabel(row)} · {text(row.modality,"Modalidade não informada")}</p><h3 className="mt-1 line-clamp-2 font-bold">{text(row.object_text??row.title,"Objeto não informado")}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${compatibility==="Compatível"?"bg-emerald-50 text-emerald-700":compatibility==="Incompatível"?"bg-rose-50 text-rose-700":"bg-amber-50 text-amber-700"}`}>{compatibility}</span></div><p className="mt-3 text-sm font-semibold text-slate-700">{text(row.buyer_name,"Órgão não informado")}</p><div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500"><div><b className="block text-slate-400">Processo</b>{text(row.process_number,"—")}</div><div><b className="block text-slate-400">Local</b>{[text(row.city),text(row.state)].filter(Boolean).join("/")||"—"}</div><div><b className="block text-slate-400">Prazo</b>{formatDate(row.proposal_deadline,true)}</div><div><b className="block text-slate-400">Valor estimado</b>{money(row.estimated_value)}</div></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-xs text-slate-500">{situationLabel(row)} · {analysisLabel(row)}</span>{row.source_url?<a href={String(row.source_url)} target="_blank" rel="noreferrer" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">Abrir fonte oficial ↗</a>:<span className="text-xs text-slate-400">Sem link oficial</span>}</div></article>})}</div>}
      {!loading&&!loadError&&results.length>PAGE_SIZE&&<div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-xs text-slate-500">Página {page} de {totalPages}</span><div className="flex gap-2"><button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Anterior</button><button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-40">Próxima</button></div></div>}
    </section>
    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5"><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Seleção UNI</p><p className="mt-2 text-sm leading-6 text-slate-600">CNPJ → perfil de capacidade → fontes oficiais → deduplicação → compatibilidade → Radar → triagem → análise.</p></div>
  </div>;
}
