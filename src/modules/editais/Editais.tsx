"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { resolveCurrentClientId } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";

type Row = Record<string, unknown>;
type Mode = "recent" | "history";
type Requirement = {id:string;title:string;description:string|null;requirement_kind:string;blocking:boolean;status:string;evidence_document_id:string|null;notes:string|null};
type CompanyDoc = {id:string;original_filename:string;validation_status:string;expiry_date:string|null;is_current:boolean};

const PAGE = 12;
const REFERENCE_NOW = Date.now();
const txt = (v:unknown) => v == null ? "" : String(v);
const norm = (v:unknown) => txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dt = (v:unknown) => { const d = new Date(txt(v)); return Number.isNaN(d.getTime()) ? null : d };
const fd = (v:unknown) => { const d = dt(v); return d ? new Intl.DateTimeFormat("pt-BR").format(d) : "—" };
const money = (v:unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"}).format(n) : "Não informado" };
const expired = (v:string|null) => { if(!v) return false; const d = new Date(`${v}T23:59:59`); return !Number.isNaN(d.getTime()) && d.getTime() < REFERENCE_NOW };

export default function Editais(){
  const [rows,setRows] = useState<Row[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [mode,setMode] = useState<Mode>("recent");
  const [query,setQuery] = useState("");
  const [applied,setApplied] = useState("");
  const [page,setPage] = useState(1);
  const [analysisBusy,setAnalysisBusy] = useState("");
  const [analysisMessage,setAnalysisMessage] = useState<Record<string,string>>({});
  const [habilBusy,setHabilBusy] = useState("");
  const [habilMessage,setHabilMessage] = useState<Record<string,string>>({});

  async function load(){
    if(!supabase) return;
    setLoading(true); setError("");
    try{
      const id = await resolveCurrentClientId();
      if(!id) throw new Error("Cliente não associado.");
      const from = new Date(); from.setFullYear(from.getFullYear()-1);
      const {data,error:e} = await supabase.from("client_radar_dashboard").select("*").eq("client_id",id).gte("publication_date",from.toISOString().slice(0,10)).order("publication_date",{ascending:false}).limit(1000);
      if(e) throw e;
      setRows((data??[]) as Row[]);
    }catch(e){ setError(e instanceof Error ? e.message : String(e)) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ void load() },[]);
  useEffect(()=>{ const q=sessionStorage.getItem("uni-global-search"); if(q){ sessionStorage.removeItem("uni-global-search"); setQuery(q); setApplied(q); setMode("history") } },[]);

  const filtered = useMemo(()=>{
    const cut30=REFERENCE_NOW-30*86400000, cut12=new Date(REFERENCE_NOW), q=norm(applied); cut12.setFullYear(cut12.getFullYear()-1);
    return rows.filter(r=>{
      const p=dt(r.publication_date)?.getTime()??0;
      if(mode==="recent"&&p<cut30) return false;
      if(mode==="history"&&p<cut12.getTime()) return false;
      if(q&&!norm([r.process_number,r.buyer_name,r.object_text,r.title,r.modality,r.city,r.state].join(" ")).includes(q)) return false;
      return true;
    });
  },[rows,mode,applied]);

  useEffect(()=>setPage(1),[mode,applied]);
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE));
  const visible=filtered.slice((page-1)*PAGE,page*PAGE);
  function submit(e:FormEvent){ e.preventDefault(); setApplied(query.trim()); if(query.trim()) setMode("history") }

  async function validateHabilitation(r:Row){
    if(!supabase) return;
    const opportunityId=txt(r.opportunity_id), key=opportunityId||txt(r.process_number);
    if(!opportunityId){ setHabilMessage(m=>({...m,[key]:"Este edital ainda não possui identificador operacional."})); return }
    setHabilBusy(key); setHabilMessage(m=>({...m,[key]:"Conferindo exigências e documentos da empresa..."}));
    try{
      const clientId=await resolveCurrentClientId(); if(!clientId) throw new Error("Cliente não associado.");
      const {data,error:e}=await supabase.from("opportunity_requirements").select("id,title,description,requirement_kind,blocking,status,evidence_document_id,notes").eq("client_id",clientId).eq("opportunity_id",opportunityId).order("blocking",{ascending:false});
      if(e) throw e;
      const reqs=(data??[]) as Requirement[];
      if(!reqs.length){ setHabilMessage(m=>({...m,[key]:"As exigências de habilitação deste edital ainda não foram estruturadas. Execute a Análise detalhada/extração dos anexos antes de validar."})); return }
      const evidenceIds=[...new Set(reqs.map(x=>x.evidence_document_id).filter(Boolean))] as string[];
      let docs:CompanyDoc[]=[];
      if(evidenceIds.length){
        const {data:dd,error:de}=await supabase.from("client_documents").select("id,original_filename,validation_status,expiry_date,is_current").eq("client_id",clientId).in("id",evidenceIds);
        if(de) throw de; docs=(dd??[]) as CompanyDoc[];
      }
      const byId=new Map(docs.map(d=>[d.id,d])); let ok=0,pending=0,blocking=0; const issues:string[]=[];
      for(const req of reqs){
        const status=norm(req.status), doc=req.evidence_document_id?byId.get(req.evidence_document_id):undefined;
        const reqApproved=["atende","aprovado","approved","compliant"].includes(status);
        let state:"ok"|"pending"|"blocking"="pending";
        if(["impeditivo","reprovado","rejected","blocking"].includes(status)) state="blocking";
        else if(doc){ if(doc.validation_status==="impeditivo"||expired(doc.expiry_date)) state="blocking"; else if(doc.validation_status==="atende"&&doc.is_current) state="ok"; }
        else if(reqApproved) state="ok";
        if(state==="ok") ok++; else if(state==="blocking"){ blocking++; issues.push(req.title) } else { pending++; if(req.blocking) issues.push(req.title) }
      }
      const result=blocking>0?"NÃO HABILITADO":pending>0?"PENDENTE":"HABILITADO";
      const detail=`${result} — ${ok} requisito(s) atendido(s), ${pending} pendente(s), ${blocking} impeditivo(s).${issues.length?` Verificar: ${issues.slice(0,3).join("; ")}${issues.length>3?"…":""}`:""}`;
      setHabilMessage(m=>({...m,[key]:detail}));
    }catch(e){ setHabilMessage(m=>({...m,[key]:`Falha na validação: ${e instanceof Error?e.message:String(e)}`})) }
    finally{ setHabilBusy("") }
  }

  async function detailedAnalysis(r:Row){
    if(!supabase) return;
    const opportunityId=txt(r.opportunity_id), capabilityId=txt(r.capability_id), key=opportunityId||txt(r.process_number);
    if(!opportunityId||!capabilityId){ setAnalysisMessage(m=>({...m,[key]:"Este edital ainda não possui capacidade associada para análise."})); return }
    setAnalysisBusy(key); setAnalysisMessage(m=>({...m,[key]:"Validando triagem e documentos..."}));
    try{
      const [triageResponse,docsResponse]=await Promise.all([
        supabase.from("opportunity_triage_runs").select("result,run_sequence").eq("capability_id",capabilityId).eq("opportunity_id",opportunityId).order("run_sequence",{ascending:false}).limit(1).maybeSingle(),
        supabase.from("opportunity_documents").select("id",{count:"exact",head:true}).eq("opportunity_id",opportunityId).eq("validation_status","available")
      ]);
      if(triageResponse.error) throw triageResponse.error;
      if(docsResponse.error) throw docsResponse.error;
      if(triageResponse.data?.result!=="queued_for_ai"){ setAnalysisMessage(m=>({...m,[key]:"A Análise detalhada só é liberada após a triagem aprovar o edital."})); return }
      if((docsResponse.count??0)===0){ setAnalysisMessage(m=>({...m,[key]:"Nenhum anexo disponível. Sincronize ou anexe o edital/TR no dossiê antes da análise."})); return }
      const {data,error:e}=await supabase.rpc("enqueue_opportunity_ai_analysis",{p_capability_id:capabilityId,p_opportunity_id:opportunityId,p_prompt_master_version:"Prompt Mestre v1.17"});
      if(e) throw e;
      setAnalysisMessage(m=>({...m,[key]:`Análise detalhada registrada (${String(data).slice(0,8)}…).`}));
    }catch(e){ setAnalysisMessage(m=>({...m,[key]:`Não foi possível iniciar: ${e instanceof Error?e.message:String(e)}`})) }
    finally{ setAnalysisBusy("") }
  }

  return <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 xl:p-8">
    <div className="mb-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Editais</p><h1 className="mt-1 text-3xl font-bold">Editais em fluxo</h1><p className="mt-2 text-sm text-slate-500">Aqui ficam as oportunidades vinculadas ao cliente após entrarem no fluxo do UNI. Valide a habilitação específica do edital e, quando liberado, inicie a Análise detalhada.</p></div>
    <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-2"><button onClick={()=>setMode("recent")} className={`rounded-xl px-4 py-2 text-sm font-bold ${mode==="recent"?"bg-blue-700 text-white":"bg-slate-100 text-slate-600"}`}>Recentes · 30 dias</button><button onClick={()=>setMode("history")} className={`rounded-xl px-4 py-2 text-sm font-bold ${mode==="history"?"bg-blue-700 text-white":"bg-slate-100 text-slate-600"}`}>Histórico · 12 meses</button></div><form onSubmit={submit} className="flex min-w-0 gap-2 lg:w-[560px]"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar órgão, processo, objeto, modalidade..." className="min-w-0 flex-1 rounded-xl border px-4 py-2.5 text-sm"/><button className="rounded-xl bg-blue-700 px-4 text-sm font-bold text-white">Pesquisar</button></form></div>
    {error&&<div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    <section className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-bold">{mode==="recent"?"Editais recentes":"Histórico operacional"}</h2><p className="text-xs text-slate-500">{loading?"Atualizando...":`${filtered.length} editais encontrados`}</p></div><button onClick={()=>void load()} disabled={loading} className="rounded-lg border px-3 py-2 text-xs font-semibold">Atualizar</button></div>
      <div className="overflow-x-auto"><table className="min-w-[1240px] w-full text-left text-xs"><thead className="bg-slate-50"><tr>{["Publicação","Órgão","Modalidade","Processo","Objeto","Valor estimado","Prazo","Situação","Ações"].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">
        {visible.map((r,i)=>{ const key=txt(r.opportunity_id)||`${txt(r.process_number)}-${i}`; const portalUrl=txt(r.source_url); return <tr key={key} className="hover:bg-slate-50"><td className="px-4 py-3">{fd(r.publication_date)}</td><td className="px-4 py-3 font-semibold">{txt(r.buyer_name)||"—"}</td><td className="px-4 py-3">{txt(r.modality)||"—"}</td><td className="px-4 py-3">{txt(r.process_number)||"—"}</td><td className="max-w-[360px] truncate px-4 py-3">{txt(r.object_text||r.title)||"—"}</td><td className="px-4 py-3">{money(r.estimated_value)}</td><td className="px-4 py-3">{fd(r.proposal_deadline)}</td><td className="px-4 py-3">{txt(r.match_status)||txt(r.lifecycle)||"—"}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2">{portalUrl&&<a href={portalUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-100">Acessar Portal</a>}<button onClick={()=>void validateHabilitation(r)} disabled={habilBusy===key} className="rounded-lg bg-blue-700 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50">{habilBusy===key?"Validando...":"Validar habilitação"}</button><button onClick={()=>void detailedAnalysis(r)} disabled={analysisBusy===key} className="rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50">{analysisBusy===key?"Validando...":"Análise detalhada"}</button></div>{habilMessage[key]&&<p className="mt-2 max-w-[330px] text-[10px] leading-4 text-slate-600">{habilMessage[key]}</p>}{analysisMessage[key]&&<p className="mt-1 max-w-[330px] text-[10px] leading-4 text-slate-500">{analysisMessage[key]}</p>}</td></tr> })}
        {!loading&&visible.length===0&&<tr><td colSpan={9} className="p-8 text-center text-slate-400">Nenhum edital nesta janela.</td></tr>}
      </tbody></table></div>
      <div className="flex items-center justify-between border-t px-5 py-4 text-xs"><span>Página {page} de {pages}</span><div className="flex gap-2"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="rounded-lg border px-3 py-2 disabled:opacity-30">Anterior</button><button disabled={page>=pages} onClick={()=>setPage(p=>p+1)} className="rounded-lg border px-3 py-2 disabled:opacity-30">Próxima</button></div></div>
    </section>
    <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600"><b>Fluxo UNI:</b> Radar → Triagem → Editais → Validar habilitação → Análise detalhada. A validação específica do edital só declara HABILITADO quando os requisitos estruturados estiverem atendidos; ausência de requisito/documento permanece como pendência.</div>
  </div>
}
