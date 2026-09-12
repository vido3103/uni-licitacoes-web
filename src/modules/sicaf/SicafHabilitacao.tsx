"use client";

import {useEffect,useMemo,useState} from "react";
import {resolveCurrentClientId} from "@/lib/dashboard";
import {supabase} from "@/lib/supabase";

type ClientDoc={id:string;document_type_id:string;version:number;is_current:boolean;storage_bucket:string;storage_path:string;original_filename:string;uploaded_at:string;expiry_date:string|null;validation_status:string};
type DocType={id:string;code:string;name:string};
type Review={client_id:string;habilitado:boolean;notes:string|null;validated_at:string|null};
const norm=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const safe=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_");
const fmt=(v:string|null)=>v?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(v)):"—";

export default function SicafHabilitacao(){
 const[clientId,setClientId]=useState("");
 const[docs,setDocs]=useState<ClientDoc[]>([]);
 const[types,setTypes]=useState<DocType[]>([]);
 const[review,setReview]=useState<Review|null>(null);
 const[isOwner,setIsOwner]=useState(false);
 const[loading,setLoading]=useState(true);
 const[busy,setBusy]=useState(false);
 const[saving,setSaving]=useState(false);
 const[msg,setMsg]=useState("");
 const[form,setForm]=useState({typeId:"",expiry_date:"",issuing_body:"",observations:""});
 const[notes,setNotes]=useState("");
 const currentDocs=useMemo(()=>docs.filter(d=>d.is_current),[docs]);

 async function load(){
  if(!supabase)return;setLoading(true);setMsg("");
  try{
   const id=await resolveCurrentClientId();if(!id)throw new Error("Cliente não associado.");setClientId(id);
   const[identity,docTypes,documents,reviewRow]=await Promise.all([
    supabase.rpc("get_my_uni_identity"),
    supabase.from("document_types").select("id,code,name").eq("active",true).order("name"),
    supabase.from("client_documents").select("id,document_type_id,version,is_current,storage_bucket,storage_path,original_filename,uploaded_at,expiry_date,validation_status").eq("client_id",id).order("uploaded_at",{ascending:false}),
    supabase.from("client_habilitation_reviews").select("client_id,habilitado,notes,validated_at").eq("client_id",id).maybeSingle()
   ]);
   if(docTypes.error)throw docTypes.error;if(documents.error)throw documents.error;if(reviewRow.error)throw reviewRow.error;
   const owner=Boolean(identity.data&&typeof identity.data==="object"&&(identity.data as{platform_role?:string}).platform_role==="platform_owner");setIsOwner(owner);
   const ts=(docTypes.data??[]) as DocType[];setTypes(ts);setDocs((documents.data??[]) as ClientDoc[]);
   const r=(reviewRow.data??null) as Review|null;setReview(r);setNotes(r?.notes??"");
   if(!form.typeId)setForm(v=>({...v,typeId:ts.find(t=>t.code==="generic_document")?.id??ts[0]?.id??""}));
  }catch(e){setMsg(e instanceof Error?e.message:String(e))}finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[]);

 async function upload(file:File|null){
  if(!file||!supabase||!clientId)return;setBusy(true);setMsg("");
  try{
   const target=types.find(t=>t.id===form.typeId);if(!target)throw new Error("Selecione o tipo do documento.");
   if(file.size>50*1024*1024)throw new Error("Arquivo acima do limite de 50 MB.");
   const{data:auth}=await supabase.auth.getUser();if(!auth.user)throw new Error("Sessão não autenticada.");
   const same=docs.filter(d=>d.document_type_id===target.id),current=same.filter(d=>d.is_current),version=Math.max(0,...same.map(d=>d.version))+1;
   const path=`${clientId}/${target.id}/${Date.now()}-${safe(file.name)}`;
   const{error:storageError}=await supabase.storage.from("client-documents").upload(path,file,{contentType:file.type||undefined});if(storageError)throw storageError;
   if(current.length){const{error}=await supabase.from("client_documents").update({is_current:false}).in("id",current.map(d=>d.id));if(error)throw error}
   const{error}=await supabase.from("client_documents").insert({client_id:clientId,document_type_id:target.id,version,is_current:true,storage_bucket:"client-documents",storage_path:path,original_filename:file.name,mime_type:file.type||null,file_size_bytes:file.size,uploaded_by:auth.user.id,expiry_date:form.expiry_date||null,issuing_body:form.issuing_body||null,observations:form.observations||null});if(error)throw error;
   setMsg("Documento anexado com sucesso.");setForm(v=>({...v,expiry_date:"",issuing_body:"",observations:""}));await load();
  }catch(e){setMsg(`Falha no envio: ${e instanceof Error?e.message:String(e)}`)}finally{setBusy(false)}
 }
 async function openDoc(d:ClientDoc){const{data,error}=await supabase!.storage.from(d.storage_bucket).createSignedUrl(d.storage_path,60);if(error||!data?.signedUrl){setMsg("Não foi possível abrir o documento.");return}window.open(data.signedUrl,"_blank","noopener,noreferrer")}
 async function setHabilitado(next:boolean){
  if(!supabase||!clientId||!isOwner)return;setSaving(true);setMsg("");
  try{const{data,error}=await supabase.rpc("set_client_habilitation_status",{p_client_id:clientId,p_habilitado:next,p_notes:notes||null});if(error)throw error;setReview(data as Review);setMsg(next?"Cadastro marcado como Cliente habilitado.":"Habilitação removida; cadastro voltou para análise.")}
  catch(e){setMsg(e instanceof Error?e.message:String(e))}finally{setSaving(false)}
 }

 if(loading)return <div className="p-8 text-sm text-slate-500">Carregando habilitação...</div>;
 return <div className="mx-auto max-w-[1300px] p-4 sm:p-6 xl:p-8">
  <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">Habilitação</p><h1 className="mt-1 text-3xl font-bold">Cadastro documental</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">O cliente anexa os documentos do cadastro. A conclusão é feita pelo Owner após a conferência do conjunto documental.</p></div>

  <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
   <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Situação do cadastro</h2><p className={`mt-1 text-sm font-semibold ${review?.habilitado?"text-emerald-700":"text-amber-700"}`}>{review?.habilitado?"Cliente habilitado":"Em análise"}</p>{review?.validated_at&&<p className="mt-1 text-xs text-slate-500">Validado em {fmt(review.validated_at)}</p>}</div>{isOwner&&<label className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3"><input type="checkbox" checked={Boolean(review?.habilitado)} disabled={saving} onChange={e=>void setHabilitado(e.target.checked)} className="h-5 w-5"/><span className="text-sm font-bold">Cliente habilitado</span></label>}</div>
   {isOwner&&<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observações do Owner sobre o cadastro..." className="mt-4 min-h-20 w-full rounded-xl border p-3 text-sm"/>}
  </section>

  <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
   <h2 className="font-bold">Anexar documentos</h2><p className="mt-1 text-xs text-slate-500">Selecione o tipo, informe os dados disponíveis e anexe o arquivo. Não há validação automática por níveis do SICAF.</p>
   <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><select value={form.typeId} onChange={e=>setForm(v=>({...v,typeId:e.target.value}))} className="rounded-xl border px-3 py-3 text-sm">{types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><input type="date" value={form.expiry_date} onChange={e=>setForm(v=>({...v,expiry_date:e.target.value}))} className="rounded-xl border px-3 py-3 text-sm"/><input placeholder="Órgão emissor" value={form.issuing_body} onChange={e=>setForm(v=>({...v,issuing_body:e.target.value}))} className="rounded-xl border px-3 py-3 text-sm"/><input placeholder="Observações" value={form.observations} onChange={e=>setForm(v=>({...v,observations:e.target.value}))} className="rounded-xl border px-3 py-3 text-sm"/></div>
   <label className="mt-3 flex cursor-pointer justify-center rounded-xl border-2 border-dashed p-6 text-sm font-semibold"><span>{busy?"Enviando...":"Selecionar arquivo para enviar"}</span><input type="file" disabled={busy} onChange={e=>{const f=e.currentTarget.files?.[0]??null;e.currentTarget.value="";void upload(f)}} className="hidden"/></label>
  </section>

  <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold">Arquivos anexados</h2><p className="mt-1 text-xs text-slate-500">{currentDocs.length} documento(s) atual(is)</p></div><button onClick={()=>void load()} className="rounded-lg border px-3 py-2 text-xs font-semibold">Atualizar</button></div><div className="mt-4 space-y-2">{currentDocs.length?currentDocs.map(d=>{const t=types.find(x=>x.id===d.document_type_id);return <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{d.original_filename}</p><p className="mt-1 text-xs text-slate-500">{t?.name??"Documento"} · versão {d.version} · validade {d.expiry_date?new Intl.DateTimeFormat("pt-BR").format(new Date(d.expiry_date)):"—"}</p></div><button onClick={()=>void openDoc(d)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">Abrir</button></div>}):<p className="text-sm text-slate-500">Nenhum documento anexado.</p>}</div></section>
  {msg&&<div className="mt-4 rounded-xl border bg-white p-4 text-sm">{msg}</div>}
 </div>
}
