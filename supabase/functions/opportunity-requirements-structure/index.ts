import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const U=Deno.env.get("SUPABASE_URL")!;
const S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL=Deno.env.get("GEMINI_MODEL")||"gemini-2.5-flash-lite";
const db=createClient(U,S,{auth:{persistSession:false,autoRefreshToken:false}});
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...C,"content-type":"application/json"}});
const fail=(code:string,message:string,detail?:unknown)=>json({ok:false,code,error:message,detail:detail??null},200);
const MAX_PDF_BYTES=8*1024*1024,MAX_TOTAL_BYTES=16*1024*1024;
const ALLOWED_KINDS=new Set(["technical","documentary","commercial","delivery","qualification","legal","other"]);
function base64(bytes:Uint8Array){let out="";for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));return btoa(out)}
function clean(v:unknown,max=1000){return String(v??"").replace(/\s+/g," ").trim().slice(0,max)}
function errorText(e:unknown){if(e instanceof Error)return e.message;if(e&&typeof e==="object"){const r=e as Record<string,unknown>;return [r.message,r.error,r.detail,r.details,r.hint,r.code].filter(Boolean).map(String).join(" · ")||"unknown_error"}return String(e??"unknown_error")}
async function gemini(parts:any[],key:string){const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":key},body:JSON.stringify({contents:[{parts}],generationConfig:{temperature:0,responseMimeType:"application/json"}})});const body=await res.json().catch(()=>null);if(!res.ok)throw new Error(`gemini_http_${res.status}:${body?.error?.message??"unknown"}`);const text=body?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text??"").join("")??"";if(!text)throw new Error("gemini_empty_response");try{return JSON.parse(text.replace(/^```json\s*/i,"").replace(/```$/i,"").trim())}catch{throw new Error("gemini_invalid_json")}}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:C});
 if(req.method!=="POST")return json({ok:false,error:"Método não permitido."},405);
 try{
  const geminiKey=Deno.env.get("GEMINI_API_KEY");if(!geminiKey)return fail("gemini_not_configured","O mecanismo de leitura das exigências não está configurado no momento.");
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)return fail("unauthorized","Sua sessão não foi localizada. Entre novamente no UNI.");
  const{data:userData,error:userError}=await db.auth.getUser(token);if(userError||!userData.user)return fail("unauthorized","Sua sessão expirou ou não é válida. Entre novamente no UNI.");
  const input=await req.json().catch(()=>({}));const clientId=clean(input.client_id,80),opportunityId=clean(input.opportunity_id,80),capabilityId=clean(input.capability_id,80);
  if(!clientId||!opportunityId||!capabilityId)return fail("missing_context","Não foi possível identificar corretamente cliente, edital e capacidade vinculada.");
  const[{data:member},{data:owner},{data:cap}]=await Promise.all([
   db.from("client_members").select("client_id").eq("client_id",clientId).eq("user_id",userData.user.id).maybeSingle(),
   db.from("platform_user_roles").select("user_id").eq("user_id",userData.user.id).eq("role","platform_owner").eq("active",true).maybeSingle(),
   db.from("client_capabilities").select("id,client_id").eq("id",capabilityId).eq("client_id",clientId).maybeSingle()
  ]);
  if(!member&&!owner)return fail("forbidden","Seu usuário não possui acesso a este cliente.");
  if(!cap)return fail("capability_not_in_client","A capacidade vinculada a este edital não pertence ao cliente selecionado. Atualize a página e tente novamente.");
  const[opRes,docsRes]=await Promise.all([
   db.from("public_opportunities").select("id,buyer_name,process_number,modality,title,object_text,publication_date,proposal_deadline,state,city").eq("id",opportunityId).maybeSingle(),
   db.from("opportunity_documents").select("id,storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,validation_status").eq("client_id",clientId).eq("opportunity_id",opportunityId).eq("validation_status","available").order("uploaded_at")
  ]);
  if(opRes.error||!opRes.data)return fail("opportunity_not_found","O edital não foi localizado no cadastro operacional.",opRes.error?.message);
  if(docsRes.error)return fail("documents_query_failed","Não foi possível consultar os documentos deste edital.",docsRes.error.message);
  const docs=docsRes.data??[];if(!docs.length)return fail("no_documents_available","Nenhum edital/TR está disponível para leitura. Sincronize ou anexe os documentos antes de validar a habilitação.");
  const parts:any[]=[{text:`TAREFA: Estruture SOMENTE as exigências objetivas do edital/TR/anexos oficiais para habilitação, qualificação, capacidade técnica, condições comerciais e entrega. Não invente requisitos. Não conclua se a empresa atende; apenas extraia o que o órgão exige. Retorne SOMENTE JSON: {"requirements":[{"title":"...","description":"...","requirement_kind":"technical|documentary|commercial|delivery|qualification|legal|other","blocking":true|false,"source_locator":"arquivo/página/seção quando identificável","notes":"observação curta"}]}. Consolide duplicidades sem perder exigências diferentes. Dados da contratação: ${JSON.stringify(opRes.data)}`}];
  let total=0;const included:string[]=[],omitted:{name:string;reason:string}[]=[];
  for(const d of docs){const mime=String(d.mime_type??"").toLowerCase(),size=Number(d.file_size_bytes??0);if(mime!=="application/pdf"){omitted.push({name:d.original_filename,reason:"unsupported_inline_mime"});continue}if(size<=0||size>MAX_PDF_BYTES||total+size>MAX_TOTAL_BYTES){omitted.push({name:d.original_filename,reason:"size_limit"});continue}const{data:file,error}=await db.storage.from(d.storage_bucket).download(d.storage_path);if(error||!file){omitted.push({name:d.original_filename,reason:"download_failed"});continue}const bytes=new Uint8Array(await file.arrayBuffer());total+=bytes.length;included.push(d.original_filename);parts.push({text:`DOCUMENTO OFICIAL: ${d.original_filename}`},{inlineData:{mimeType:"application/pdf",data:base64(bytes)}})}
  if(!included.length)return fail("no_supported_pdf_available","Os documentos encontrados não puderam ser lidos automaticamente. Verifique formato/tamanho ou anexe o edital/TR em PDF.",omitted);
  const parsed=await gemini(parts,geminiKey);const raw=Array.isArray(parsed?.requirements)?parsed.requirements:[];
  const seen=new Set<string>();const normalized=raw.map((x:any)=>{const title=clean(x?.title,300),description=clean(x?.description,2000),source=clean(x?.source_locator,500),note=clean(x?.notes,1000),kind=ALLOWED_KINDS.has(String(x?.requirement_kind))?String(x.requirement_kind):"other";return{title,description:description||null,requirement_kind:kind,blocking:Boolean(x?.blocking),source_locator:source||null,notes:`AUTO:gemini-requirements-v3${note?` | ${note}`:""}`}}).filter((x:any)=>{const k=x.title.toLowerCase();if(!x.title||seen.has(k))return false;seen.add(k);return true}).slice(0,100);
  const{data:manual,error:manualErr}=await db.from("opportunity_requirements").select("title").eq("client_id",clientId).eq("opportunity_id",opportunityId).eq("capability_id",capabilityId).not("notes","like","AUTO:gemini-requirements-v%");if(manualErr)return fail("requirements_query_failed","Não foi possível consultar as exigências já registradas.",manualErr.message);const manualTitles=new Set((manual??[]).map((x:any)=>String(x.title).toLowerCase()));
  const{error:deleteErr}=await db.from("opportunity_requirements").delete().eq("client_id",clientId).eq("opportunity_id",opportunityId).eq("capability_id",capabilityId).like("notes","AUTO:gemini-requirements-v%");if(deleteErr)return fail("requirements_refresh_failed","Não foi possível atualizar as exigências automáticas deste edital.",deleteErr.message);
  const rows=normalized.filter((x:any)=>!manualTitles.has(x.title.toLowerCase())).map((x:any)=>({...x,client_id:clientId,opportunity_id:opportunityId,capability_id:capabilityId,status:"pending",created_by:userData.user.id,updated_by:userData.user.id}));
  if(rows.length){const{error:insertErr}=await db.from("opportunity_requirements").insert(rows);if(insertErr)return fail("requirements_insert_failed","As exigências foram lidas, mas não puderam ser gravadas.",insertErr.message)}
  await db.from("audit_events").insert({client_id:clientId,actor_user_id:userData.user.id,event_type:"opportunity_requirements_structured",entity_type:"public_opportunities",entity_id:opportunityId,after_data:{capability_id:capabilityId,requirements:rows.length,documents_included:included,documents_omitted:omitted,model:MODEL,worker_version:"v3"}});
  return json({ok:true,requirements:rows.length,documents_included:included.length,documents_omitted:omitted.length,omitted});
 }catch(e){return fail("requirements_structure_failed","O UNI não conseguiu concluir a leitura das exigências deste edital.",errorText(e))}
});