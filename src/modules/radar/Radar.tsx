"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BackendDashboard, loadCurrentClientDashboard } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";
import {
  AdvancedRadarFilters,
  canStartDetailedAnalysis,
  emptyAdvancedRadarFilters,
  errorMessage,
  recentAdvancedRadarFilters,
  TriageSnapshot,
  toAdvancedRadarRpcParams,
} from "./radar-utils";

type Opportunity = Record<string, unknown>;
type OpportunityDocument = { id:string; original_filename:string; validation_status:string; uploaded_at:string; file_size_bytes:number|null };
type TriageStage = { stage?:string; result?:string };
type DocumentSync = { status:"idle"|"running"|"complete"|"partial"|"manual_required"|"error"; found?:number; downloaded?:number; skipped?:number; failed?:number; reason?:string };
type Filters = { state:string; modality:string; lifecycle:string; match:string; deadline:string; minValue:string; maxValue:string };
type ExplorerOpportunity = Opportunity & { total_count?:number; source_code?:string; source_name?:string };
type AiRadarCommand = { action?:"search"|"triage"|"sync_documents"|"analyze"|"refresh"; text?:string; filters?:Record<string,string> };

const emptyFilters: Filters = { state:"", modality:"", lifecycle:"", match:"", deadline:"", minValue:"", maxValue:"" };

function text(value:unknown,fallback="—"){return value===null||value===undefined||value===""?fallback:String(value)}
function date(value:unknown,withTime=false){if(!value)return"—";const d=new Date(String(value));if(Number.isNaN(d.getTime()))return text(value);return new Intl.DateTimeFormat("pt-BR",withTime?{dateStyle:"short",timeStyle:"short"}:{dateStyle:"short"}).format(d)}
function money(value:unknown){const n=typeof value==="number"?value:Number(value);if(!Number.isFinite(n)||n<=0)return"Não informado";return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n)}
function safeName(name:string){return name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_")}
function opportunityId(o:Opportunity|null){return o?.opportunity_id?String(o.opportunity_id):""}
function capabilityId(o:Opportunity|null){return o?.capability_id?String(o.capability_id):""}
function fileMime(file:File){const n=file.name.toLowerCase();if(n.endsWith(".pdf"))return"application/pdf";if(n.endsWith(".zip"))return"application/zip";if(n.endsWith(".doc"))return"application/msword";if(n.endsWith(".docx"))return"application/vnd.openxmlformats-officedocument.wordprocessingml.document";if(n.endsWith(".xls"))return"application/vnd.ms-excel";if(n.endsWith(".xlsx"))return"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";return""}
function resultLabel(result?:string){const map:Record<string,string>={queued_for_ai:"APROVADO PARA ANÁLISE",filtered_out:"NÃO APROVADO NA TRIAGEM",matched:"COMPATÍVEL",not_filtered:"APROVADO",queued_for_analysis:"AGUARDANDO ANÁLISE",approved:"APROVADO",analyzed:"ANALISADO",candidate:"CANDIDATO",rejected:"NÃO APROVADO"};return map[result||""]||text(result,"EM ANÁLISE").replaceAll("_"," ").toUpperCase()}
function prettyReasons(value:unknown):string{if(!value)return"Nenhuma justificativa adicional registrada.";if(typeof value==="string")return value;if(Array.isArray(value))return value.map(prettyReasons).filter(Boolean).join(" · ");if(typeof value==="object")return Object.entries(value as Record<string,unknown>).map(([k,v])=>`${k.replaceAll("_"," ")}: ${prettyReasons(v)}`).join(" · ");return String(value)}
function localIso(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}

export default function Radar(){
  const [data,setData]=useState<BackendDashboard|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [draftFilters,setDraftFilters]=useState<Filters>(emptyFilters);
  const [filters,setFilters]=useState<Filters>(emptyFilters);
  const [selected,setSelected]=useState<Opportunity|null>(null);
  const [documents,setDocuments]=useState<OpportunityDocument[]>([]);
  const [docsLoading,setDocsLoading]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [uploadMessage,setUploadMessage]=useState("");
  const [triageBusy,setTriageBusy]=useState(false);
  const [triage,setTriage]=useState<TriageSnapshot|null>(null);
  const [triageError,setTriageError]=useState("");
  const [documentSync,setDocumentSync]=useState<DocumentSync>({status:"idle"});
  const [analysisBusy,setAnalysisBusy]=useState(false);
  const [analysisMessage,setAnalysisMessage]=useState("");
  const [analysisQueued,setAnalysisQueued]=useState(false);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [advancedDraft,setAdvancedDraft]=useState<AdvancedRadarFilters>(()=>recentAdvancedRadarFilters());
  const [advancedFilters,setAdvancedFilters]=useState<AdvancedRadarFilters>(()=>recentAdvancedRadarFilters());
  const [explorerRows,setExplorerRows]=useState<ExplorerOpportunity[]>([]);
  const [explorerPage,setExplorerPage]=useState(1);
  const [explorerTotal,setExplorerTotal]=useState(0);
  const [explorerLoading,setExplorerLoading]=useState(false);
  const [explorerSearched,setExplorerSearched]=useState(false);
  const [explorerError,setExplorerError]=useState("");
  const [recentOnly,setRecentOnly]=useState(true);
  const explorerPageSize=25;
  const currentYear=new Date().getFullYear();

  const refreshDashboard=useCallback(async(initial=false)=>{
    if(initial)setLoading(true);else setRefreshing(true);
    setError("");
    try{
      const result=await loadCurrentClientDashboard();
      if(!result)throw new Error("Nenhum ambiente empresarial foi associado ao usuário autenticado.");
      setData(result);
      return result;
    }catch(e){setError(errorMessage(e));return null}
    finally{setLoading(false);setRefreshing(false)}
  },[]);

  useEffect(()=>{void refreshDashboard(true)},[refreshDashboard]);

  const rows=useMemo(()=>(data?.opportunities??[]) as Opportunity[],[data?.opportunities]);
  const clientId=data?.client?.id;
  const states=useMemo(()=>Array.from(new Set(rows.map(r=>text(r.state,"")).filter(Boolean))).sort(),[rows]);
  const modalities=useMemo(()=>Array.from(new Set(rows.map(r=>text(r.modality,"")).filter(Boolean))).sort(),[rows]);
  const matches=useMemo(()=>Array.from(new Set(rows.map(r=>text(r.match_status,"")).filter(Boolean))).sort(),[rows]);
  const activeFilterCount=Object.values(filters).filter(Boolean).length;

  const opportunities=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const yearStart=new Date(currentYear,0,1).getTime();
    const now=Date.now();
    return rows.filter(row=>{
      const publication=row.publication_date?new Date(String(row.publication_date)).getTime():0;
      if(recentOnly&&publication&&publication<yearStart)return false;
      if(q&&!([row.buyer_name,row.modality,row.process_number,row.title,row.object_text,row.city,row.state].map(v=>text(v,"").toLowerCase()).some(v=>v.includes(q))))return false;
      if(filters.state&&text(row.state,"")!==filters.state)return false;
      if(filters.modality&&text(row.modality,"")!==filters.modality)return false;
      if(filters.lifecycle&&text(row.lifecycle,"")!==filters.lifecycle)return false;
      if(filters.match&&text(row.match_status,"")!==filters.match)return false;
      const value=Number(row.estimated_value??0);
      if(filters.minValue&&value<Number(filters.minValue))return false;
      if(filters.maxValue&&value>Number(filters.maxValue))return false;
      if(filters.deadline){
        if(typeof row.proposal_deadline!=="string")return false;
        const diff=new Date(row.proposal_deadline).getTime()-now;
        if(diff<0||diff>Number(filters.deadline)*86400000)return false;
      }
      return true;
    });
  },[rows,query,filters,recentOnly,currentYear]);

  const searchAdvanced=useCallback(async(nextFilters:AdvancedRadarFilters,nextPage=1)=>{
    if(!supabase||!clientId){setExplorerError("A pesquisa exige um ambiente empresarial autenticado.");return}
    setExplorerLoading(true);setExplorerSearched(true);setExplorerError("");
    try{
      const{data:result,error:searchError}=await supabase.rpc("search_radar_opportunities",toAdvancedRadarRpcParams(clientId,nextFilters,nextPage,explorerPageSize));
      if(searchError)throw searchError;
      const found=(result??[]) as ExplorerOpportunity[];
      setAdvancedFilters(nextFilters);setAdvancedDraft(nextFilters);setExplorerRows(found);setExplorerPage(nextPage);setExplorerTotal(Number(found[0]?.total_count??0));setAdvancedOpen(true);
    }catch(e){setExplorerRows([]);setExplorerTotal(0);setExplorerError(`A pesquisa não pôde ser concluída: ${errorMessage(e)}`)}
    finally{setExplorerLoading(false)}
  },[clientId]);

  async function loadDocuments(opportunity:Opportunity){
    const oid=opportunityId(opportunity);if(!supabase||!data?.client?.id||!oid)return;
    setDocsLoading(true);
    try{
      const{data:docs,error:e}=await supabase.from("opportunity_documents").select("id,original_filename,validation_status,uploaded_at,file_size_bytes").eq("client_id",data.client.id).eq("opportunity_id",oid).eq("validation_status","available").order("uploaded_at",{ascending:false});
      if(e)throw e;setDocuments((docs??[]) as OpportunityDocument[]);
    }catch(e){setUploadMessage(`Não foi possível consultar os anexos: ${errorMessage(e)}`)}
    finally{setDocsLoading(false)}
  }

  async function runTriage(opportunity:Opportunity):Promise<TriageSnapshot>{
    if(!supabase)throw new Error("Conexão com o backend indisponível.");
    const oid=opportunityId(opportunity),cid=capabilityId(opportunity);
    if(!oid||!cid)throw new Error("A oportunidade ainda não possui identidade operacional suficiente para executar a triagem.");
    setTriageBusy(true);setTriageError("");
    try{
      const{data:result,error:runError}=await supabase.rpc("run_deterministic_triage",{p_capability_id:cid,p_opportunity_id:oid});
      if(runError)throw runError;
      const[runResponse,matchResponse]=await Promise.all([
        supabase.from("opportunity_triage_runs").select("result,stages,created_at,run_sequence").eq("capability_id",cid).eq("opportunity_id",oid).order("run_sequence",{ascending:false}).limit(1).maybeSingle(),
        supabase.from("client_opportunity_matches").select("match_status,deterministic_score,deterministic_reasons,participation_allowed").eq("capability_id",cid).eq("opportunity_id",oid).limit(1).maybeSingle(),
      ]);
      if(runResponse.error)throw runResponse.error;if(matchResponse.error)throw matchResponse.error;
      const run=runResponse.data as {result?:string;stages?:TriageStage[];created_at?:string}|null;
      const match=matchResponse.data as {match_status?:string;deterministic_score?:number|null;deterministic_reasons?:unknown;participation_allowed?:boolean}|null;
      const snapshot:TriageSnapshot={result:String(run?.result??result??"unknown"),stages:Array.isArray(run?.stages)?run.stages:[],created_at:run?.created_at,match_status:match?.match_status,deterministic_score:match?.deterministic_score??null,deterministic_reasons:match?.deterministic_reasons,participation_allowed:match?.participation_allowed};
      setTriage(snapshot);await refreshDashboard();return snapshot;
    }catch(e){const msg=errorMessage(e);setTriageError(`A triagem não pôde ser concluída: ${msg}`);throw e}
    finally{setTriageBusy(false)}
  }

  async function syncPncpDocuments(opportunity:Opportunity){
    if(!supabase||!data?.client?.id)return;const oid=opportunityId(opportunity);if(!oid)return;
    setDocumentSync({status:"running"});
    try{
      const{data:result,error:e}=await supabase.functions.invoke("opportunity-document-sync",{body:{client_id:data.client.id,opportunity_id:oid}});
      if(e)throw e;const s=result?.status;const status:DocumentSync["status"]=s==="complete"||s==="partial"||s==="manual_required"?s:"error";
      setDocumentSync({status,found:Number(result?.found??0),downloaded:Number(result?.downloaded??0),skipped:Number(result?.skipped??0),failed:Number(result?.failed??0),reason:result?.reason?String(result.reason):undefined});
      await loadDocuments(opportunity);
    }catch(e){setDocumentSync({status:"error",reason:errorMessage(e)});await loadDocuments(opportunity)}
  }

  function openOpportunity(opportunity:Opportunity){
    setSelected(opportunity);setDocuments([]);setUploadMessage("");setAnalysisMessage("");setAnalysisQueued(false);setTriage(null);setTriageError("");setDocumentSync({status:"idle"});
    void Promise.allSettled([runTriage(opportunity),syncPncpDocuments(opportunity)]);
  }

  async function uploadFiles(files:File[]){
    const oid=opportunityId(selected);if(!files.length||!supabase||!data?.client?.id||!selected||!oid)return;
    setUploading(true);setUploadMessage(`${files.length} arquivo(s) selecionado(s). Enviando...`);
    try{
      const{data:auth,error:authError}=await supabase.auth.getUser();if(authError||!auth.user)throw new Error("Sessão não autenticada.");
      let completed=0;
      for(const file of files){
        if(file.size>50*1024*1024)throw new Error(`${file.name}: o arquivo excede 50 MB.`);
        const mime=fileMime(file);if(!mime)throw new Error(`${file.name}: formato não permitido.`);
        const path=`${data.client.id}/${oid}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safeName(file.name)}`;
        const{error:storageError}=await supabase.storage.from("opportunity-documents").upload(path,file,{upsert:false,contentType:mime,cacheControl:"3600"});if(storageError)throw storageError;
        const{error:dbError}=await supabase.from("opportunity_documents").insert({client_id:data.client.id,opportunity_id:oid,storage_bucket:"opportunity-documents",storage_path:path,original_filename:file.name,mime_type:mime,file_size_bytes:file.size,source_kind:"user_upload",validation_status:"available",uploaded_by:auth.user.id,metadata:{origin:"manual_upload"}});
        if(dbError){await supabase.storage.from("opportunity-documents").remove([path]);throw dbError}completed++;
      }
      setUploadMessage(`${completed} arquivo(s) anexado(s) com sucesso.`);await loadDocuments(selected);
    }catch(e){setUploadMessage(errorMessage(e))}
    finally{setUploading(false)}
  }

  async function startDetailedAnalysis(){
    if(!supabase||!selected)return;const oid=opportunityId(selected),cid=capabilityId(selected);
    if(!oid||!cid){setAnalysisMessage("A oportunidade não possui identidade operacional suficiente para iniciar a análise.");return}
    if(!triage||triage.result!=="queued_for_ai"){setAnalysisMessage("A Análise Detalhada só pode ser solicitada após aprovação na triagem preliminar.");return}
    if(documents.length===0){setAnalysisMessage("Ainda não há documentos disponíveis. Sincronize ou anexe o edital/TR.");return}
    setAnalysisBusy(true);setAnalysisMessage("Registrando a solicitação na fila do UNI...");
    try{
      const{data:queueId,error:e}=await supabase.rpc("enqueue_opportunity_ai_analysis",{p_capability_id:cid,p_opportunity_id:oid,p_prompt_master_version:"Prompt Mestre v1.17"});
      if(e)throw e;setAnalysisQueued(true);setAnalysisMessage(`Análise registrada: ${String(queueId).slice(0,8)}… · Prompt Mestre v1.17.`);await refreshDashboard();
    }catch(e){setAnalysisQueued(false);setAnalysisMessage(`Não foi possível solicitar a análise detalhada: ${errorMessage(e)}`)}
    finally{setAnalysisBusy(false)}
  }

  const executeAiCommand=useCallback(async(command:AiRadarCommand)=>{
    if(!command?.action)return;
    if(command.action==="refresh"){await refreshDashboard();return}
    if(command.action==="search"){
      const base=recentAdvancedRadarFilters();
      const next={...base,...(command.filters??{})} as AdvancedRadarFilters;
      await searchAdvanced(next,1);return;
    }
    if(!selected){setAnalysisMessage("Abra uma oportunidade no Radar antes de pedir esta ação à IA.");return}
    if(command.action==="triage"){await runTriage(selected);return}
    if(command.action==="sync_documents"){await syncPncpDocuments(selected);return}
    if(command.action==="analyze"){await startDetailedAnalysis()}
  },[refreshDashboard,searchAdvanced,selected,triage,documents]);

  useEffect(()=>{
    const handler=(event:Event)=>{const command=(event as CustomEvent<AiRadarCommand>).detail;void executeAiCommand(command)};
    window.addEventListener("uni-ai-radar-command",handler);
    const queued=sessionStorage.getItem("uni-ai-radar-command");
    if(queued){sessionStorage.removeItem("uni-ai-radar-command");try{void executeAiCommand(JSON.parse(queued) as AiRadarCommand)}catch{/* ignore invalid session payload */}}
    return()=>window.removeEventListener("uni-ai-radar-command",handler);
  },[executeAiCommand]);

  const approvedForAnalysis=triage?.result==="queued_for_ai";
  const detailedAnalysisReady=canStartDetailedAnalysis({triage,documentCount:documents.length,analysisBusy,triageBusy});
  const syncMessage=documentSync.status==="running"?"Sincronizando documentos oficiais...":documentSync.status==="complete"?`Concluído: ${documentSync.downloaded??0} novo(s), ${documentSync.skipped??0} existente(s).`:documentSync.status==="partial"?`Parcial: ${documentSync.downloaded??0} obtido(s), ${documentSync.failed??0} falha(s).`:documentSync.status==="manual_required"?"Download automático indisponível; use o upload manual.":documentSync.status==="error"?"Falha na sincronização automática.":"A sincronização é executada ao abrir a oportunidade.";

  return <div className="px-3 py-4 sm:px-4 xl:px-6"><div className="mx-auto max-w-[1540px]">
    <div className="mb-4 flex flex-col justify-between gap-3 xl:flex-row xl:items-end">
      <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-blue-600">Monitoramento personalizado</p><h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Radar de Licitações</h1><p className="mt-1 text-xs text-slate-500">Por padrão, o UNI exibe oportunidades publicadas em {currentYear}. O histórico permanece disponível sob demanda.</p></div>
      <div className="flex w-full flex-wrap gap-2 xl:max-w-2xl"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar órgão, processo, objeto..." className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"/><button onClick={()=>setRecentOnly(v=>!v)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${recentOnly?"border-blue-200 bg-blue-50 text-blue-700":"border-amber-200 bg-amber-50 text-amber-700"}`}>{recentOnly?`Recentes ${currentYear}`:"Histórico liberado"}</button><button onClick={()=>setFiltersOpen(v=>!v)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">☷ Filtros{activeFilterCount?` (${activeFilterCount})`:""}</button><button onClick={()=>void refreshDashboard()} disabled={refreshing} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{refreshing?"Atualizando...":"Atualizar"}</button></div>
    </div>

    <section className="mb-3 rounded-xl border border-blue-100 bg-blue-50/55 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Pesquisa oficial</p><p className="text-xs font-semibold text-slate-800">Período padrão: {advancedDraft.publicationStart} até {advancedDraft.publicationEnd}</p></div><button onClick={()=>setAdvancedOpen(v=>!v)} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700">{advancedOpen?"Fechar":"Pesquisa avançada"}</button></div>
      {advancedOpen&&<div className="mt-3 border-t border-blue-100 pt-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <input value={advancedDraft.query} onChange={e=>setAdvancedDraft({...advancedDraft,query:e.target.value})} placeholder="Objeto / palavra-chave" className="rounded-lg border border-slate-200 px-3 py-2 text-xs"/>
          <input value={advancedDraft.buyerName} onChange={e=>setAdvancedDraft({...advancedDraft,buyerName:e.target.value})} placeholder="Órgão" className="rounded-lg border border-slate-200 px-3 py-2 text-xs"/>
          <input value={advancedDraft.city} onChange={e=>setAdvancedDraft({...advancedDraft,city:e.target.value})} placeholder="Município" className="rounded-lg border border-slate-200 px-3 py-2 text-xs"/>
          <select value={advancedDraft.state} onChange={e=>setAdvancedDraft({...advancedDraft,state:e.target.value})} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="">Todas UFs</option>{["SP","RJ","MG","PR","SC","RS","ES","BA","GO","DF","PE","CE"].map(v=><option key={v}>{v}</option>)}</select>
          <select value={advancedDraft.source} onChange={e=>setAdvancedDraft({...advancedDraft,source:e.target.value})} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="">Todas fontes</option><option value="pncp">PNCP</option><option value="compras_gov_br">Compras.gov.br</option><option value="cptm_portal">CPTM</option></select>
          <label className="text-[10px] font-semibold text-slate-600">Publicação inicial<input type="date" value={advancedDraft.publicationStart} onChange={e=>setAdvancedDraft({...advancedDraft,publicationStart:e.target.value})} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal"/></label>
          <label className="text-[10px] font-semibold text-slate-600">Publicação final<input type="date" value={advancedDraft.publicationEnd} onChange={e=>setAdvancedDraft({...advancedDraft,publicationEnd:e.target.value})} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal"/></label>
          <input value={advancedDraft.processNumber} onChange={e=>setAdvancedDraft({...advancedDraft,processNumber:e.target.value})} placeholder="Processo" className="self-end rounded-lg border border-slate-200 px-3 py-2 text-xs"/>
          <input type="number" value={advancedDraft.minValue} onChange={e=>setAdvancedDraft({...advancedDraft,minValue:e.target.value})} placeholder="Valor mínimo" className="self-end rounded-lg border border-slate-200 px-3 py-2 text-xs"/>
          <input type="number" value={advancedDraft.maxValue} onChange={e=>setAdvancedDraft({...advancedDraft,maxValue:e.target.value})} placeholder="Valor máximo" className="self-end rounded-lg border border-slate-200 px-3 py-2 text-xs"/>
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2"><button onClick={()=>{const recent=recentAdvancedRadarFilters();setAdvancedDraft(recent);setAdvancedFilters(recent);setExplorerRows([]);setExplorerTotal(0);setExplorerSearched(false)}} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Restaurar recentes</button><button onClick={()=>{setAdvancedDraft(emptyAdvancedRadarFilters);setExplorerRows([]);setExplorerTotal(0);setExplorerSearched(false)}} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Liberar histórico</button><button onClick={()=>void searchAdvanced(advancedDraft,1)} disabled={explorerLoading} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{explorerLoading?"Pesquisando...":"Pesquisar"}</button></div>
        {explorerError&&<div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">{explorerError}</div>}
        {explorerSearched&&<div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-3 py-2"><span className="text-xs font-bold">Resultados oficiais</span><span className="text-[10px] text-slate-500">{explorerTotal} encontrado(s) · pág. {explorerPage}</span></div>{explorerLoading?<p className="p-4 text-xs text-slate-500">Consultando...</p>:explorerRows.length===0?<p className="p-4 text-xs text-slate-500">Nenhuma oportunidade encontrada.</p>:<div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-[11px]"><thead className="bg-slate-50 text-slate-500"><tr>{["Fonte","Órgão","Modalidade","Processo","Objeto","Local","Publicação","Valor"].map(h=><th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{explorerRows.map((row,index)=><tr key={text(row.opportunity_id,String(index))}><td className="px-3 py-2 font-semibold">{text(row.source_name??row.source_code)}</td><td className="px-3 py-2">{text(row.buyer_name)}</td><td className="px-3 py-2">{text(row.modality)}</td><td className="px-3 py-2">{text(row.process_number)}</td><td className="max-w-[300px] px-3 py-2"><div className="line-clamp-2">{text(row.object_text??row.title)}</div></td><td className="px-3 py-2">{[text(row.city,""),text(row.state,"")].filter(Boolean).join("/")||"—"}</td><td className="px-3 py-2">{date(row.publication_date)}</td><td className="px-3 py-2">{money(row.estimated_value)}</td></tr>)}</tbody></table></div>}<div className="flex justify-end gap-2 border-t border-slate-100 p-2"><button disabled={explorerPage<=1||explorerLoading} onClick={()=>void searchAdvanced(advancedFilters,explorerPage-1)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold disabled:opacity-40">Anterior</button><button disabled={explorerPage*explorerPageSize>=explorerTotal||explorerLoading} onClick={()=>void searchAdvanced(advancedFilters,explorerPage+1)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold disabled:opacity-40">Próxima</button></div></div>}
      </div>}
    </section>

    {filtersOpen&&<section className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><select value={draftFilters.state} onChange={e=>setDraftFilters({...draftFilters,state:e.target.value})} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="">Todos estados</option>{states.map(v=><option key={v}>{v}</option>)}</select><select value={draftFilters.modality} onChange={e=>setDraftFilters({...draftFilters,modality:e.target.value})} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="">Todas modalidades</option>{modalities.map(v=><option key={v}>{v}</option>)}</select><select value={draftFilters.lifecycle} onChange={e=>setDraftFilters({...draftFilters,lifecycle:e.target.value})} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="">Ativas e históricas</option><option value="live">Ativas</option><option value="historical">Históricas</option></select><select value={draftFilters.match} onChange={e=>setDraftFilters({...draftFilters,match:e.target.value})} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="">Todos status</option>{matches.map(v=><option key={v} value={v}>{resultLabel(v)}</option>)}</select><select value={draftFilters.deadline} onChange={e=>setDraftFilters({...draftFilters,deadline:e.target.value})} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="">Qualquer prazo</option><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option></select><input type="number" placeholder="Valor mínimo" value={draftFilters.minValue} onChange={e=>setDraftFilters({...draftFilters,minValue:e.target.value})} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"/><input type="number" placeholder="Valor máximo" value={draftFilters.maxValue} onChange={e=>setDraftFilters({...draftFilters,maxValue:e.target.value})} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"/><div className="flex gap-2"><button onClick={()=>{setDraftFilters(emptyFilters);setFilters(emptyFilters)}} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">Limpar</button><button onClick={()=>{setFilters(draftFilters);setFiltersOpen(false)}} className="flex-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Aplicar</button></div></div></section>}

    {error&&<div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

    <div className="mb-3 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-xl font-bold">{Number(data?.summary?.live_count??0)}</div><div className="text-xs text-slate-500">Oportunidades ativas</div></div><div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-xl font-bold">{opportunities.length}</div><div className="text-xs text-slate-500">Exibidas no recorte atual</div></div><div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-xl font-bold">{Number(data?.summary?.released_for_participation_count??0)}</div><div className="text-xs text-slate-500">Liberadas para participação</div></div></div>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><h2 className="text-sm font-bold">Oportunidades</h2><p className="text-[10px] text-slate-400">Resultados associados ao perfil do cliente.</p></div><span className="text-[10px] text-slate-500">{opportunities.length} exibida(s)</span></div>{loading?<div className="p-6 text-xs text-slate-500">Carregando...</div>:opportunities.length===0?<div className="p-6 text-xs text-slate-500">Nenhuma oportunidade encontrada para o recorte atual.</div>:<div className="overflow-x-auto"><table className="min-w-[1000px] w-full text-left text-[11px]"><thead className="bg-slate-50 text-slate-500"><tr>{["Órgão","Modalidade","Processo","Objeto","Local","Publicação","Prazo","Valor","Situação","Ação"].map(h=><th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{opportunities.map((row,index)=>{const lifecycle=text(row.lifecycle,"unknown"),released=Boolean(row.participation_allowed??false);return <tr key={text(row.opportunity_id,String(index))} className="hover:bg-slate-50/70"><td className="px-3 py-2 font-semibold">{text(row.buyer_name)}</td><td className="px-3 py-2">{text(row.modality)}</td><td className="px-3 py-2">{text(row.process_number)}</td><td className="max-w-[320px] px-3 py-2"><div className="line-clamp-2">{text(row.object_text??row.title)}</div></td><td className="px-3 py-2">{[text(row.city,""),text(row.state,"")].filter(Boolean).join("/")||"—"}</td><td className="px-3 py-2">{date(row.publication_date)}</td><td className="px-3 py-2">{date(row.proposal_deadline,true)}</td><td className="px-3 py-2">{money(row.estimated_value)}</td><td className="px-3 py-2"><span className={`rounded px-1.5 py-1 text-[9px] font-bold ${released?"bg-emerald-50 text-emerald-700":lifecycle==="live"?"bg-blue-50 text-blue-700":"bg-slate-100 text-slate-600"}`}>{released?"Liberada":lifecycle==="live"?"Ativa":"Histórica"}</span></td><td className="px-3 py-2"><button onClick={()=>openOpportunity(row)} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-semibold text-blue-700">Abrir</button></td></tr>})}</tbody></table></div>}</section>

    {selected&&<section className="mt-3 space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col justify-between gap-3 lg:flex-row"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Triagem preliminar</p><h2 className="mt-1 text-lg font-bold">{text(selected.buyer_name)} · {text(selected.process_number)}</h2><p className="mt-1 max-w-5xl text-xs text-slate-600">{text(selected.object_text??selected.title)}</p></div><button onClick={()=>setSelected(null)} className="self-start rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold">Fechar</button></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[9px] font-bold uppercase text-slate-400">Modalidade</p><p className="mt-1 text-xs font-semibold">{text(selected.modality)}</p></div><div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[9px] font-bold uppercase text-slate-400">Local</p><p className="mt-1 text-xs font-semibold">{[text(selected.city,""),text(selected.state,"")].filter(Boolean).join("/")||"—"}</p></div><div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[9px] font-bold uppercase text-slate-400">Prazo</p><p className="mt-1 text-xs font-semibold">{date(selected.proposal_deadline,true)}</p></div><div className="rounded-lg bg-slate-50 p-2.5"><p className="text-[9px] font-bold uppercase text-slate-400">Valor estimado</p><p className="mt-1 text-xs font-semibold">{money(selected.estimated_value)}</p></div></div>
        <div className="mt-3 rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><div><h3 className="text-xs font-bold">Resultado da triagem</h3><p className="text-[10px] text-slate-500">Pode ser executada pelo botão Abrir ou pelo Fale com a IA.</p></div>{triageBusy?<span className="rounded bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">TRIANDO...</span>:triage?<span className={`rounded px-2 py-1 text-[9px] font-bold ${triage.result==="filtered_out"?"bg-rose-50 text-rose-700":"bg-emerald-50 text-emerald-700"}`}>{resultLabel(triage.result)}</span>:null}</div>{triageError&&<div className="mt-2 rounded border border-rose-200 bg-rose-50 p-2 text-[10px] text-rose-700">{triageError}</div>}{triage&&<div className="mt-3 grid gap-2 md:grid-cols-4 text-[11px]"><p><strong>Status:</strong> {resultLabel(triage.result)}</p><p><strong>Match:</strong> {resultLabel(triage.match_status)}</p><p><strong>Score:</strong> {triage.deterministic_score??"—"}</p><p><strong>Fundamentos:</strong> {prettyReasons(triage.deterministic_reasons)}</p></div>}
        {approvedForAnalysis&&<div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><div><p className="text-xs font-bold text-emerald-800">Aprovada para Análise Detalhada</p><p className="text-[10px] text-emerald-700">Exige documentos disponíveis e gates satisfeitos.</p></div><button onClick={()=>void startDetailedAnalysis()} disabled={!detailedAnalysisReady} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:bg-emerald-300">{analysisBusy?"Registrando...":"Iniciar análise"}</button></div>}</div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Documentos oficiais</h3><button onClick={()=>void syncPncpDocuments(selected)} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-semibold text-blue-700">Sincronizar</button></div><p className="mt-2 text-[11px] text-slate-600">{syncMessage}</p>{documentSync.reason&&<p className="mt-1 text-[10px] text-amber-700">{documentSync.reason}</p>}{selected.source_url&&<a href={String(selected.source_url)} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Fonte oficial ↗</a>}</div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="text-sm font-bold">Anexos do edital</h3><label className="mt-3 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center"><span className="text-xs font-semibold text-slate-700">{uploading?"Enviando...":"Anexar PDF, ZIP, DOC ou XLS"}</span><input type="file" multiple disabled={uploading} accept=".pdf,.zip,.doc,.docx,.xls,.xlsx" onChange={e=>{const chosen=Array.from(e.currentTarget.files??[]);e.currentTarget.value="";void uploadFiles(chosen)}} className="hidden"/></label>{uploadMessage&&<div className="mt-2 rounded bg-slate-50 p-2 text-[10px] text-slate-700">{uploadMessage}</div>}<div className="mt-3">{docsLoading?<p className="text-xs text-slate-500">Consultando anexos...</p>:documents.length===0?<p className="text-xs text-slate-500">Nenhum anexo disponível.</p>:documents.map(doc=><div key={doc.id} className="mb-1 flex items-center justify-between rounded border border-slate-100 px-2.5 py-2"><p className="truncate text-[11px] font-semibold">{doc.original_filename}</p><span className="text-[9px] font-bold text-emerald-700">DISPONÍVEL</span></div>)}</div>{analysisMessage&&<div className={`mt-2 rounded border p-2 text-[10px] ${analysisQueued?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-slate-200 bg-slate-50 text-slate-700"}`}>{analysisMessage}</div>}</div></div>
    </section>}
  </div></div>
}
