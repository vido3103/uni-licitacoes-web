import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const PNCP_API = "https://pncp.gov.br/api/pncp";

type PncpIdentity = { cnpj:string; year:number; sequence:number; control:string };
type PncpDocument = { sequencialDocumento?:number; url?:string; uri?:string; titulo?:string; tipoDocumentoNome?:string; dataPublicacaoPncp?:string };

function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}})}
function safeName(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,180)}
function extensionFrom(url:string,title:string){const candidate=(title||url).split("?")[0].toLowerCase();const m=candidate.match(/\.(pdf|zip|doc|docx|xls|xlsx|txt|csv)$/);return m?.[1]||"bin"}
function mimeFrom(ext:string){return ({pdf:"application/pdf",zip:"application/zip",doc:"application/msword",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xls:"application/vnd.ms-excel",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",txt:"text/plain",csv:"text/csv"} as Record<string,string>)[ext]||"application/octet-stream"}
function collectStrings(value:unknown,out:string[]=[]):string[]{if(typeof value==="string")out.push(value);else if(Array.isArray(value))value.forEach(v=>collectStrings(v,out));else if(value&&typeof value==="object")Object.values(value as Record<string,unknown>).forEach(v=>collectStrings(v,out));return out}
function pncpIdentity(value:unknown):PncpIdentity|null{for(const s of collectStrings(value)){const m=s.match(/(\d{14})-\d-(\d+)\/(\d{4})/);if(m)return{cnpj:m[1],sequence:Number(m[2]),year:Number(m[3]),control:m[0]}}return null}
function officialPortal(id:PncpIdentity){return `https://pncp.gov.br/app/editais/${id.cnpj}/${id.year}/${id.sequence}`}
function documentUrl(d:PncpDocument,id:PncpIdentity){if(d.url?.startsWith("http"))return d.url;if(d.uri?.startsWith("http"))return d.uri;const seq=Number(d.sequencialDocumento);return Number.isFinite(seq)?`${PNCP_API}/v1/orgaos/${id.cnpj}/compras/${id.year}/${id.sequence}/arquivos/${seq}`:""}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const auth=req.headers.get("Authorization")||"";if(!supabaseUrl||!anon||!service||!auth)return json({error:"backend_not_configured"},500);
  const userClient=createClient(supabaseUrl,anon,{global:{headers:{Authorization:auth}}});const admin=createClient(supabaseUrl,service);
  const {data:userData,error:userError}=await userClient.auth.getUser();if(userError||!userData.user)return json({error:"unauthorized"},401);
  const body=await req.json().catch(()=>({}));const clientId=String(body.client_id||"");const opportunityId=String(body.opportunity_id||"");if(!clientId||!opportunityId)return json({error:"client_id_and_opportunity_id_required"},400);
  const {data:member}=await admin.from("client_members").select("client_id").eq("client_id",clientId).eq("user_id",userData.user.id).limit(1).maybeSingle();if(!member)return json({error:"forbidden"},403);
  const {data:opportunity,error:oppError}=await admin.from("opportunities").select("*").eq("id",opportunityId).limit(1).maybeSingle();if(oppError||!opportunity)return json({error:"opportunity_not_found",detail:oppError?.message},404);
  const {data:snapshots}=await admin.from("opportunity_source_snapshots").select("*").eq("opportunity_id",opportunityId).order("created_at",{ascending:false}).limit(10);
  const identity=pncpIdentity([opportunity,snapshots]);if(!identity)return json({status:"manual_required",found:0,downloaded:0,skipped:0,failed:0,reason:"Não foi possível resolver a identidade PNCP da contratação.",official_url:null});
  const official_url=officialPortal(identity);const listUrl=`${PNCP_API}/v1/orgaos/${identity.cnpj}/compras/${identity.year}/${identity.sequence}/arquivos`;
  let listResponse:Response;try{listResponse=await fetch(listUrl,{headers:{Accept:"application/json"}})}catch(e){return json({status:"manual_required",found:0,downloaded:0,skipped:0,failed:0,reason:`Falha ao consultar anexos no PNCP: ${String(e)}`,official_url})}
  if(!listResponse.ok)return json({status:"manual_required",found:0,downloaded:0,skipped:0,failed:0,reason:`PNCP respondeu HTTP ${listResponse.status} ao consultar anexos.`,official_url});
  const payload=await listResponse.json().catch(()=>[]);const docs:PncpDocument[]=Array.isArray(payload)?payload:Array.isArray(payload?.documentos)?payload.documentos:[];
  if(docs.length===0)return json({status:"manual_required",found:0,downloaded:0,skipped:0,failed:0,reason:"A contratação foi localizada, mas a API não retornou anexos disponíveis.",official_url});
  let downloaded=0,skipped=0,failed=0;
  for(const d of docs){const seq=Number(d.sequencialDocumento);const sourceUrl=documentUrl(d,identity);if(!sourceUrl){failed++;continue}const marker={pncp_control:identity.control,pncp_document_sequence:Number.isFinite(seq)?seq:null,official_source_url:sourceUrl,official_portal_url:official_url,document_type:d.tipoDocumentoNome||null,published_at:d.dataPublicacaoPncp||null,ingestion_state:"stored_for_reading"};
    const {data:existing}=await admin.from("opportunity_documents").select("id").eq("client_id",clientId).eq("opportunity_id",opportunityId).contains("metadata",{pncp_control:identity.control,pncp_document_sequence:Number.isFinite(seq)?seq:null}).limit(1);if(existing?.length){skipped++;continue}
    try{const r=await fetch(sourceUrl,{redirect:"follow"});if(!r.ok)throw new Error(`HTTP ${r.status}`);const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.byteLength===0)throw new Error("arquivo vazio");if(bytes.byteLength>50*1024*1024)throw new Error("arquivo excede 50 MB");const ext=extensionFrom(sourceUrl,d.titulo||"");const filename=safeName(d.titulo||`PNCP-${identity.control}-${seq||downloaded+1}.${ext}`);const finalName=filename.includes(".")?filename:`${filename}.${ext}`;const path=`${clientId}/${opportunityId}/pncp-${identity.control.replace(/[^0-9]/g,"")}-${seq||crypto.randomUUID()}-${finalName}`;const {error:storageError}=await admin.storage.from("opportunity-documents").upload(path,bytes,{contentType:r.headers.get("content-type")||mimeFrom(ext),upsert:false});if(storageError)throw storageError;const {error:dbError}=await admin.from("opportunity_documents").insert({client_id:clientId,opportunity_id:opportunityId,storage_bucket:"opportunity-documents",storage_path:path,original_filename:finalName,mime_type:r.headers.get("content-type")||mimeFrom(ext),file_size_bytes:bytes.byteLength,source_kind:"pncp_official",validation_status:"available",metadata:marker});if(dbError){await admin.storage.from("opportunity-documents").remove([path]);throw dbError}downloaded++}catch{failed++}
  }
  const status=failed===0?"complete":downloaded>0||skipped>0?"partial":"manual_required";return json({status,found:docs.length,downloaded,skipped,failed,official_url,reason:failed?"Um ou mais anexos existem no PNCP, mas não puderam ser absorvidos automaticamente. Acesse a fonte oficial e use o upload manual para completar a análise.":undefined});
});
