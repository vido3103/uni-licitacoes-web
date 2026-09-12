"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BackendDashboard, loadCurrentClientDashboard } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";
import {
  AdvancedRadarFilters,
  errorMessage,
  recentAdvancedRadarFilters,
  TriageSnapshot,
  toAdvancedRadarRpcParams,
} from "./radar-utils";

type Opportunity = Record<string, unknown>;
type ExplorerOpportunity = Opportunity & { total_count?: number };
type OpportunityDocument = { id:string; original_filename:string; uploaded_at:string; file_size_bytes:number|null };
type AiRadarCommand = { action?:"search"|"triage"|"sync_documents"|"analyze"|"refresh"; filters?:Record<string,string> };

type DocumentSync = {
  status:"idle"|"running"|"complete"|"partial"|"manual_required"|"error";
  downloaded?:number;
  skipped?:number;
  failed?:number;
  reason?:string;
};

function txt(value:unknown,fallback="—"){return value===null||value===undefined||value===""?fallback:String(value)}
function fmtDate(value:unknown,withTime=false){if(!value)return"—";const d=new Date(String(value));if(Number.isNaN(d.getTime()))return txt(value);return new Intl.DateTimeFormat("pt-BR",withTime?{dateStyle:"short",timeStyle:"short"}:{dateStyle:"short"}).format(d)}
function money(value:unknown){const n=Number(value);return Number.isFinite(n)&&n>0?new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n):"Não informado"}
function oid(row:Opportunity|null){return row?.opportunity_id?String(row.opportunity_id):""}
function cid(row:Opportunity|null){return row?.capability_id?String(row.capability_id):""}
function resultLabel(value?:string){const map:Record<string,string>={queued_for_ai:"APROVADO PARA ANÁLISE",filtered_out:"NÃO APROVADO",queued_for_analysis:"AGUARDANDO ANÁLISE",matched:"COMPATÍVEL",approved:"APROVADO",rejected:"NÃO APROVADO"};return map[value||""]||txt(value,"EM ANÁLISE").replaceAll("_"," ").toUpperCase()}
function safeName(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_")}
function mimeFor(name:string){const n=name.toLowerCase();if(n.endsWith(".pdf"))return"application/pdf";if(n.endsWith(".zip"))return"application/zip";if(n.endsWith(".doc"))return"application/msword";if(n.endsWith(".docx"))return"application/vnd.openxmlformats-officedocument.wordprocessingml.document";if(n.endsWith(".xls"))return"application/vnd.ms-excel";if(n.endsWith(".xlsx"))return"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";return""}

export default function Radar(){
  const [dashboard,setDashboard]=useState<BackendDashboard|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");
  const [recentOnly,setRecentOnly]=useState(true);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [advancedDraft,setAdvancedDraft]=useState<AdvancedRadarFilters>(()=>recentAdvancedRadarFilters());
  const [advancedApplied,setAdvancedApplied]=useState<AdvancedRadarFilters>(()=>recentAdvancedRadarFilters());
  const [explorerRows,setExplorerRows]=useState<ExplorerOpportunity[]>([]);
  const [explorerTotal,setExplorerTotal]=useState(0);
  const [explorerPage,setExplorerPage]=useState(1);
  const [explorerLoading,setExplorerLoading]=useState(false);
  const [explorerError,setExplorerError]=useState("");
  const [selected,setSelected]=useState<Opportunity|null>(null);
  const [triage,setTriage]=useState<TriageSnapshot|null>(null);
  const [triageBusy,setTriageBusy]=useState(false);
  const [triageError,setTriageError]=useState("");
  const [documents,setDocuments]=useState<OpportunityDocument[]>([]);
  const [docsLoading,setDocsLoading]=useState(false);
  const [documentSync,setDocumentSync]=useState<DocumentSync>({status:"idle"});
  const [uploading,setUploading]=useState(false);
  const [message,setMessage]=useState("");
  const [analysisBusy,setAnalysisBusy]=useState(false);
  const currentYear=new Date().getFullYear();
  const pageSize=25;

  const refreshDashboard=useCallback(async(initial=false)=>{
    if(initial)setLoading(true);else setRefreshing(true);
    setError("");
    try{
      const result=await loadCurrentClientDashboard();
      if(!result)throw new Error("Nenhum ambiente empresarial foi associado ao usuário autenticado.");
      setDashboard(result);
      return result;
    }catch(e){setError(errorMessage(e));return null}
    finally{setLoading(false);setRefreshing(false)}
  },[]);

  useEffect(()=>{void refreshDashboard(true)},[refreshDashboard]);

  const rows=useMemo(()=>(dashboard?.opportunities??[]) as Opportunity[],[dashboard?.opportunities]);
  const clientId=dashboard?.client?.id;
  const shownRows=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase("pt-BR");
    const start=new Date(currentYear,0,1).getTime();
    return rows.filter(row=>{
      if(recentOnly&&row.publication_date){const time=new Date(String(row.publication_date)).getTime();if(Number.isFinite(time)&&time<start)return false}
      if(!q)return true;
      return [row.buyer_name,row.process_number,row.object_text,row.title,row.modality,row.city,row.state].some(value=>txt(value,"").toLocaleLowerCase("pt-BR").includes(q));
    });
  },[rows,query,recentOnly,currentYear]);

  const searchAdvanced=useCallback(async(filters:AdvancedRadarFilters,page=1)=>{
    if(!supabase||!clientId){setExplorerError("A pesquisa exige um ambiente empresarial autenticado.");return}
    setExplorerLoading(true);setExplorerError("");setAdvancedOpen(true);
    try{
      const {data,error:rpcError}=await supabase.rpc("search_radar_opportunities",toAdvancedRadarRpcParams(clientId,filters,page,pageSize));
      if(rpcError)throw rpcError;
      const found=(data??[]) as ExplorerOpportunity[];
      setExplorerRows(found);setExplorerTotal(Number(found[0]?.total_count??0));setExplorerPage(page);setAdvancedApplied(filters);setAdvancedDraft(filters);
    }catch(e){setExplorerRows([]);setExplorerTotal(0);setExplorerError(errorMessage(e))}
    finally{setExplorerLoading(false)}
  },[clientId]);

  async function loadDocuments(row:Opportunity){
    if(!supabase||!clientId||!oid(row))return;
    setDocsLoading(true);
    try{
      const {data,error:docsError}=await supabase.from("opportunity_documents").select("id,original_filename,uploaded_at,file_size_bytes").eq("client_id",clientId).eq("opportunity_id",oid(row)).eq("validation_status","available").order("uploaded_at",{ascending:false});
      if(docsError)throw docsError;setDocuments((data??[]) as OpportunityDocument[]);
    }catch(e){setMessage(`Falha ao consultar anexos: ${errorMessage(e)}`)}finally{setDocsLoading(false)}
  }

  async function runTriage(row:Opportunity){
    if(!supabase)throw new Error("Backend indisponível.");
    const opportunityId=oid(row),capabilityId=cid(row);
    if(!opportunityId||!capabilityId)throw new Error("A oportunidade ainda não possui capacidade associada para triagem.");
    setTriageBusy(true);setTriageError("");
    try{
      const {error:runError}=await supabase.rpc("run_deterministic_triage",{p_capability_id:capabilityId,p_opportunity_id:opportunityId});
      if(runError)throw runError;
      const [runResponse,matchResponse]=await Promise.all([
        supabase.from("opportunity_triage_runs").select("result,stages,created_at,run_sequence").eq("capability_id",capabilityId).eq("opportunity_id",opportunityId).order("run_sequence",{ascending:false}).limit(1).maybeSingle(),
        supabase.from("client_opportunity_matches").select("match_status,deterministic_score,deterministic_reasons,participation_allowed").eq("capability_id",capabilityId).eq("opportunity_id",opportunityId).limit(1).maybeSingle(),
      ]);
      if(runResponse.error)throw runResponse.error;if(matchResponse.error)throw matchResponse.error;
      const run=runResponse.data as {result?:string;stages?:Array<{stage?:string;result?:string}>;created_at?:string}|null;
      const match=matchResponse.data as {match_status?:string;deterministic_score?:number|null;deterministic_reasons?:unknown;participation_allowed?:boolean}|null;
      setTriage({result:String(run?.result??"unknown"),stages:Array.isArray(run?.stages)?run.stages:[],created_at:run?.created_at,match_status:match?.match_status,deterministic_score:match?.deterministic_score??null,deterministic_reasons:match?.deterministic_reasons,participation_allowed:match?.participation_allowed});
      await refreshDashboard();
    }catch(e){setTriageError(errorMessage(e));throw e}finally{setTriageBusy(false)}
  }

  async function syncDocuments(row:Opportunity){
    if(!supabase||!clientId||!oid(row))return;
    setDocumentSync({status:"running"});
    try{
      const {data,error:syncError}=await supabase.functions.invoke("opportunity-document-sync",{body:{client_id:clientId,opportunity_id:oid(row)}});
      if(syncError)throw syncError;
      const raw=String(data?.status??"error");
      const status:DocumentSync["status"]=raw==="complete"||raw==="partial"||raw==="manual_required"?raw:"error";
      setDocumentSync({status,downloaded:Number(data?.downloaded??0),skipped:Number(data?.skipped??0),failed:Number(data?.failed??0),reason:data?.reason?String(data.reason):undefined});
      await loadDocuments(row);
    }catch(e){setDocumentSync({status:"error",reason:errorMessage(e)});await loadDocuments(row)}
  }

  function openOpportunity(row:Opportunity){
    setSelected(row);setTriage(null);setTriageError("");setDocuments([]);setMessage("");setDocumentSync({status:"idle"});
    void Promise.allSettled([runTriage(row),syncDocuments(row)]);
  }

  async function startDetailedAnalysis(){
    if(!supabase||!selected)return;
    if(!cid(selected)||!oid(selected)){setMessage("A oportunidade não possui capacidade associada para análise.");return}
    if(triage?.result!=="queued_for_ai"){setMessage("A oportunidade precisa ser aprovada na triagem antes da Análise Detalhada.");return}
    if(documents.length===0){setMessage("É necessário ter ao menos um documento disponível.");return}
    setAnalysisBusy(true);
    try{
      const {data,error:queueError}=await supabase.rpc("enqueue_opportunity_ai_analysis",{p_capability_id:cid(selected),p_opportunity_id:oid(selected),p_prompt_master_version:"Prompt Mestre v1.17"});
      if(queueError)throw queueError;setMessage(`Análise Detalhada registrada: ${String(data).slice(0,8)}…`);await refreshDashboard();
    }catch(e){setMessage(`Falha ao registrar a análise: ${errorMessage(e)}`)}finally{setAnalysisBusy(false)}
  }

  async function uploadFiles(files:File[]){
    if(!supabase||!selected||!clientId||!oid(selected)||files.length===0)return;
    setUploading(true);
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser();if(authError||!auth.user)throw new Error("Sessão não autenticada.");
      for(const file of files){
        if(file.size>50*1024*1024)throw new Error(`${file.name}: limite de 50 MB excedido.`);
        const mime=mimeFor(file.name);if(!mime)throw new Error(`${file.name}: formato não permitido.`);
        const path=`${clientId}/${oid(selected)}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safeName(file.name)}`;
        const {error:storageError}=await supabase.storage.from("opportunity-documents").upload(path,file,{contentType:mime,upsert:false});if(storageError)throw storageError;
        const {error:dbError}=await supabase.from("opportunity_documents").insert({client_id:clientId,opportunity_id:oid(selected),storage_bucket:"opportunity-documents",storage_path:path,original_filename:file.name,mime_type:mime,file_size_bytes:file.size,source_kind:"user_upload",validation_status:"available",uploaded_by:auth.user.id,metadata:{origin:"manual_upload"}});
        if(dbError){await supabase.storage.from("opportunity-documents").remove([path]);throw dbError}
      }
      setMessage(`${files.length} arquivo(s) anexado(s).`);await loadDocuments(selected);
    }catch(e){setMessage(errorMessage(e))}finally{setUploading(false)}
  }

  const executeAiCommand=useCallback(async(command:AiRadarCommand)=>{
    if(!command.action)return;
    if(command.action==="refresh"){await refreshDashboard();return}
    if(command.action==="search"){
      const next={...recentAdvancedRadarFilters(),...(command.filters??{})} as AdvancedRadarFilters;
      await searchAdvanced(next,1);return;
    }
    if(!selected){setMessage("Abra uma oportunidade no Radar antes de pedir esta ação à IA.");return}
    if(command.action==="triage"){await runTriage(selected);return}
    if(command.action==="sync_documents"){await syncDocuments(selected);return}
    if(command.action==="analyze")await startDetailedAnalysis();
  },[refreshDashboard,searchAdvanced,selected,triage,documents]);

  useEffect(()=>{
    const handler=(event:Event)=>void executeAiCommand((event as CustomEvent<AiRadarCommand>).detail);
    window.addEventListener("uni-ai-radar-command",handler);
    const queued=sessionStorage.getItem("uni-ai-radar-command");
    if(queued){sessionStorage.removeItem("uni-ai-radar-command");try{void executeAiCommand(JSON.parse(queued) as AiRadarCommand)}catch{/* invalid queued command */}}
    return()=>window.removeEventListener("uni-ai-radar-command",handler);
  },[executeAiCommand]);

  const syncText=documentSync.status==="running"?"Sincronizando documentos...":documentSync.status==="complete"?`Sincronização concluída (${documentSync.downloaded??0} novos).`:documentSync.status==="partial"?`Sincronização parcial (${documentSync.failed??0} falhas).`:documentSync.status==="manual_required"?"Use o upload manual para completar os documentos.":documentSync.status==="error"?"Falha na sincronização automática.":"Os documentos são sincronizados ao abrir a oportunidade.";

  return <div className="px-3 py-4 sm:px-4 xl:px-6"><div className="mx-auto max-w-[1540px]">
    <div className="mb-4 flex flex-col justify-between gap-3 xl:flex-row xl:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-blue-600">Monitoramento personalizado</p><h1 className="text-2xl font-bold">Radar de Licitações</h1><p className="mt-1 text-xs text-slate-500">Recorte padrão: oportunidades publicadas em {currentYear}. O histórico permanece pesquisável sob demanda.</p></div><div className="flex w-full flex-wrap gap-2 xl:max-w-2xl"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar órgão, processo, objeto..." className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"/><button onClick={()=>setRecentOnly(v=>!v)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${recentOnly?"border-blue-200 bg-blue-50 text-blue-700":"border-amber-200 bg-amber-50 text-amber-700"}`}>{recentOnly?`Recentes ${currentYear}`:"Histórico visível"}</button><button onClick={()=>setAdvancedOpen(v=>!v)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">Pesquisa avançada</button><button onClick={()=>void refreshDashboard()} disabled={refreshing} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">{refreshing?"Atualizando...":"Atualizar"}</button></div></div>

    {advancedOpen&&<section className="mb-3 rounded-xl border border-blue-100 bg-blue-50/55 p-3"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5"><input value={advancedDraft.query} onChange={e=>setAdvancedDraft({...advancedDraft,query:e.target.value})} placeholder="Objeto / palavra-chave" className="rounded-lg border border-slate-200 px-3 py-2 text-xs"/><input value={advancedDraft.buyerName} onChange={e=>setAdvancedDraft({...advancedDraft,buyerName:e.target.value})} placeholder="Órgão" className="rounded-lg border border-slate-200 px-3 py-2 text-xs"/><input value={advancedDraft.city} onChange={e=>setAdvancedDraft({...advancedDraft,city:e.target.value})} placeholder="Município" className="rounded-lg border border-slate-200 px-3 py-2 text-xs"/><input value={advancedDraft.state} onChange={e=>setAdvancedDraft({...advancedDraft,state:e.target.value.toUpperCase()})} maxLength={2} placeholder="UF" className="rounded-lg border border-slate-200 px-3 py-2 text-xs"/><select value={advancedDraft.source} onChange={e=>setAdvancedDraft({...advancedDraft,source:e.target.value})} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="">Todas fontes</option><option value="pncp">PNCP</option><option value="compras_gov_br">Compras.gov.br</option><option value="cptm_portal">CPTM</option></select><label className="text-[10px] font-semibold text-slate-600">Publicação inicial<input type="date" value={advancedDraft.publicationStart} onChange={e=>setAdvancedDraft({...advancedDraft,publicationStart:e.target.value})} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal"/></label><label className="text-[10px] font-semibold text-slate-600">Publicação final<input type="date" value={advancedDraft.publicationEnd} onChange={e=>setAdvancedDraft({...advancedDraft,publicationEnd:e.target.value})} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal"/></label><input value={advancedDraft.processNumber} onChange={e=>setAdvancedDraft({...advancedDraft,processNumber:e.target.value})} placeholder="Processo" className="self-end rounded-lg border border-slate-200 px-3 py-2 text-xs"/><input type="number" value={advancedDraft.minValue} onChange={e=>setAdvancedDraft({...advancedDraft,minValue:e.target.value})} placeholder="Valor mínimo" className="self-end rounded-lg border border-slate-200 px-3 py-2 text-xs"/><input type="number" value={advancedDraft.maxValue} onChange={e=>setAdvancedDraft({...advancedDraft,maxValue:e.target.value})} placeholder="Valor máximo" className="self-end rounded-lg border border-slate-200 px-3 py-2 text-xs"/></div><div className="mt-3 flex justify-end gap-2"><button onClick={()=>setAdvancedDraft(recentAdvancedRadarFilters())} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">Restaurar recentes</button><button onClick={()=>void searchAdvanced(advancedDraft,1)} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white">Pesquisar</button></div>{explorerError&&<p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{explorerError}</p>}{(explorerLoading||explorerRows.length>0)&&<div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="flex items-center justify-between border-b px-3 py-2 text-[10px]"><strong>Resultados oficiais</strong><span>{explorerTotal} encontrado(s) · pág. {explorerPage}</span></div>{explorerLoading?<p className="p-4 text-xs text-slate-500">Consultando...</p>:<div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-[10px]"><thead className="bg-slate-50"><tr>{["Fonte","Órgão","Modalidade","Processo","Objeto","Publicação","Valor"].map(h=><th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody>{explorerRows.map((row,index)=><tr key={txt(row.opportunity_id,String(index))} className="border-t"><td className="px-3 py-2">{txt(row.source_name??row.source_code)}</td><td className="px-3 py-2">{txt(row.buyer_name)}</td><td className="px-3 py-2">{txt(row.modality)}</td><td className="px-3 py-2">{txt(row.process_number)}</td><td className="max-w-[300px] px-3 py-2">{txt(row.object_text??row.title)}</td><td className="px-3 py-2">{fmtDate(row.publication_date)}</td><td className="px-3 py-2">{money(row.estimated_value)}</td></tr>)}</tbody></table></div>}<div className="flex justify-end gap-2 border-t p-2"><button disabled={explorerPage<=1||explorerLoading} onClick={()=>void searchAdvanced(advancedApplied,explorerPage-1)} className="rounded border px-2 py-1 text-[10px] disabled:opacity-40">Anterior</button><button disabled={explorerPage*pageSize>=explorerTotal||explorerLoading} onClick={()=>void searchAdvanced(advancedApplied,explorerPage+1)} className="rounded border px-2 py-1 text-[10px] disabled:opacity-40">Próxima</button></div></div>}</section>}

    {error&&<p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    <div className="mb-3 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-3"><div className="text-xl font-bold">{Number(dashboard?.summary?.live_count??0)}</div><div className="text-xs text-slate-500">Ativas</div></div><div className="rounded-xl border bg-white p-3"><div className="text-xl font-bold">{shownRows.length}</div><div className="text-xs text-slate-500">No recorte atual</div></div><div className="rounded-xl border bg-white p-3"><div className="text-xl font-bold">{Number(dashboard?.summary?.released_for_participation_count??0)}</div><div className="text-xs text-slate-500">Liberadas</div></div></div>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b px-4 py-3"><div><h2 className="text-sm font-bold">Oportunidades</h2><p className="text-[10px] text-slate-400">Associadas ao perfil atual.</p></div><span className="text-[10px] text-slate-500">{shownRows.length} exibida(s)</span></div>{loading?<p className="p-6 text-xs text-slate-500">Carregando...</p>:shownRows.length===0?<p className="p-6 text-xs text-slate-500">Nenhuma oportunidade encontrada.</p>:<div className="overflow-x-auto"><table className="min-w-[950px] w-full text-left text-[10px]"><thead className="bg-slate-50"><tr>{["Órgão","Modalidade","Processo","Objeto","Local","Publicação","Prazo","Valor","Ação"].map(h=><th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody>{shownRows.map((row,index)=><tr key={txt(row.opportunity_id,String(index))} className="border-t hover:bg-slate-50"><td className="px-3 py-2 font-semibold">{txt(row.buyer_name)}</td><td className="px-3 py-2">{txt(row.modality)}</td><td className="px-3 py-2">{txt(row.process_number)}</td><td className="max-w-[300px] px-3 py-2">{txt(row.object_text??row.title)}</td><td className="px-3 py-2">{[txt(row.city,""),txt(row.state,"")].filter(Boolean).join("/")||"—"}</td><td className="px-3 py-2">{fmtDate(row.publication_date)}</td><td className="px-3 py-2">{fmtDate(row.proposal_deadline,true)}</td><td className="px-3 py-2">{money(row.estimated_value)}</td><td className="px-3 py-2"><button onClick={()=>openOpportunity(row)} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-700">Abrir</button></td></tr>)}</tbody></table></div>}</section>

    {selected&&<section className="mt-3 grid gap-3 xl:grid-cols-[1.15fr_.85fr]"><div className="rounded-xl border bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase text-blue-600">Oportunidade aberta</p><h2 className="text-base font-bold">{txt(selected.buyer_name)} · {txt(selected.process_number)}</h2><p className="mt-1 text-xs text-slate-600">{txt(selected.object_text??selected.title)}</p></div><button onClick={()=>setSelected(null)} className="rounded border px-2 py-1 text-[10px]">Fechar</button></div><div className="mt-3 grid gap-2 sm:grid-cols-4"><div className="rounded-lg bg-slate-50 p-2"><p className="text-[9px] text-slate-400">Modalidade</p><p className="text-xs font-semibold">{txt(selected.modality)}</p></div><div className="rounded-lg bg-slate-50 p-2"><p className="text-[9px] text-slate-400">Local</p><p className="text-xs font-semibold">{[txt(selected.city,""),txt(selected.state,"")].filter(Boolean).join("/")||"—"}</p></div><div className="rounded-lg bg-slate-50 p-2"><p className="text-[9px] text-slate-400">Prazo</p><p className="text-xs font-semibold">{fmtDate(selected.proposal_deadline,true)}</p></div><div className="rounded-lg bg-slate-50 p-2"><p className="text-[9px] text-slate-400">Valor</p><p className="text-xs font-semibold">{money(selected.estimated_value)}</p></div></div><div className="mt-3 rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold">Triagem</p><p className="text-[10px] text-slate-500">Também pode ser acionada pelo Fale com a IA.</p></div><button onClick={()=>void runTriage(selected)} disabled={triageBusy} className="rounded-md bg-blue-700 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">{triageBusy?"Triando...":"Executar triagem"}</button></div>{triageError&&<p className="mt-2 text-[10px] text-rose-700">{triageError}</p>}{triage&&<div className="mt-2 grid gap-2 sm:grid-cols-3 text-[10px]"><p><strong>Resultado:</strong> {resultLabel(triage.result)}</p><p><strong>Compatibilidade:</strong> {resultLabel(triage.match_status)}</p><p><strong>Score:</strong> {triage.deterministic_score??"—"}</p></div>}</div><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>void syncDocuments(selected)} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-semibold text-blue-700">Sincronizar anexos</button><button onClick={()=>void startDetailedAnalysis()} disabled={analysisBusy||triage?.result!=="queued_for_ai"||documents.length===0} className="rounded-md bg-emerald-700 px-3 py-2 text-[10px] font-semibold text-white disabled:bg-emerald-300">{analysisBusy?"Registrando...":"Análise Detalhada"}</button>{Boolean(selected.source_url)&&<a href={String(selected.source_url)} target="_blank" rel="noreferrer" className="rounded-md border px-3 py-2 text-[10px] font-semibold">Fonte oficial ↗</a>}</div></div>
      <div className="rounded-xl border bg-white p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Documentos</h3><span className="text-[10px] text-slate-500">{documents.length} disponível(is)</span></div><p className="mt-2 text-[10px] text-slate-600">{syncText}</p>{documentSync.reason&&<p className="mt-1 text-[10px] text-amber-700">{documentSync.reason}</p>}<label className="mt-3 flex cursor-pointer justify-center rounded-lg border border-dashed bg-slate-50 px-3 py-4 text-[10px] font-semibold"><span>{uploading?"Enviando...":"Anexar PDF, ZIP, DOC ou XLS"}</span><input type="file" multiple className="hidden" accept=".pdf,.zip,.doc,.docx,.xls,.xlsx" disabled={uploading} onChange={e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value="";void uploadFiles(files)}}/></label><div className="mt-3 space-y-1">{docsLoading?<p className="text-[10px] text-slate-500">Consultando...</p>:documents.map(doc=><div key={doc.id} className="flex items-center justify-between rounded border px-2 py-1.5"><span className="truncate text-[10px] font-semibold">{doc.original_filename}</span><span className="text-[9px] text-slate-400">{fmtDate(doc.uploaded_at)}</span></div>)}</div>{message&&<p className="mt-3 rounded bg-slate-50 p-2 text-[10px] text-slate-700">{message}</p>}</div></section>}
  </div></div>
}
