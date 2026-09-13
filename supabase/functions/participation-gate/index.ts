import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const U=Deno.env.get("SUPABASE_URL")!,S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const j=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...C,"content-type":"application/json"}});
const fail=(c:string,s=403)=>j({error:c,detail:"A operação não pôde ser concluída."},s);
Deno.serve(async r=>{
 if(r.method==="OPTIONS") return new Response("ok",{headers:C});
 if(r.method!=="POST") return j({error:"method_not_allowed"},405);
 const a=r.headers.get("authorization")||""; if(!a.startsWith("Bearer ")) return j({error:"unauthorized"},401);
 const db=createClient(U,S,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:u,error:ue}=await db.auth.getUser(a.slice(7)); if(ue||!u.user) return j({error:"unauthorized"},401);
 const actor=u.user.id,b=await r.json().catch(()=>({}));
 const {data:owner}=await db.from("platform_user_roles").select("user_id").eq("user_id",actor).eq("role","platform_owner").eq("active",true).maybeSingle();
 const {data:members}=await db.from("client_members").select("client_id,clients!inner(status)").eq("user_id",actor).neq("clients.status","inactive");
 const ids=(members??[]).map((x:any)=>x.client_id);
 const allowed=async(c:string)=>{if(!c)return false;const {data:cl}=await db.from("clients").select("id,status").eq("id",c).neq("status","inactive").maybeSingle();return !!cl&&(!!owner||ids.includes(c));};
 if(b.action==="list"){
   let q=db.from("client_capabilities").select("id,client_id,selected,status,capability_categories(name,code),clients!inner(display_name,legal_name,status)").neq("clients.status","inactive").eq("selected",true).order("created_at");
   if(!owner){if(!ids.length)return j({ok:true,items:[]});q=q.in("client_id",ids)}
   const {data,error}=await q;if(error)return fail("list_failed");return j({ok:true,items:data??[]});
 }
 const client=String(b.client_id||""); if(!(await allowed(client))) return j({error:"forbidden"},403);
 if(b.action==="history"){
   const {data,error}=await db.from("participation_gate_evaluations").select("id,status,checks,blockers,reservations,method_version,evaluated_at").eq("client_id",client).eq("capability_id",b.capability_id).order("evaluated_at",{ascending:false}).limit(20);
   if(error)return fail("history_failed");return j({ok:true,items:data??[]});
 }
 if(b.action==="evaluate"){
   const {data,error}=await db.rpc("evaluate_participation_gate_internal",{p_actor_user_id:actor,p_client_id:client,p_capability_id:b.capability_id});
   if(error)return fail("evaluation_failed");return j({ok:true,result:data});
 }
 return j({error:"invalid_request"},400);
});