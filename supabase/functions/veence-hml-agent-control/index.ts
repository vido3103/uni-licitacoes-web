import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { buildAgentPlan, supportedWorkflows } from "./plan.mjs";

const U=Deno.env.get("SUPABASE_URL")!,S=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(U,S,{auth:{persistSession:false,autoRefreshToken:false}});
const headers={"content-type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info"};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
const uuid=(value:unknown)=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

Deno.serve(async(request)=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers});
 if(request.method!=="POST")return json({error:"method_not_allowed"},405);
 const token=(request.headers.get("authorization")??"").replace(/^Bearer\s+/i,"");
 const{data:auth,error:authError}=await db.auth.getUser(token);if(authError||!auth.user)return json({error:"unauthorized"},401);
 const queueId=Deno.env.get("VEENCE_HML_QUEUE_ID")??"";if(!queueId)return json({error:"hml_queue_not_configured"},503);
 const{data:snapshot,error:snapshotError}=await db.rpc("hml_mock_snapshot_service",{p_user:auth.user.id,p_queue:queueId});
 if(snapshotError)return json({error:"control_unavailable"},503);if(!snapshot)return json({error:"forbidden"},403);
 const input=await request.json().catch(()=>({}));const action=String(input.action??"status");
 const globalAiEnabled=(Deno.env.get("VEENCE_AI_ENABLED")??"false").toLowerCase()==="true";
 if(action==="status"){
  const{data:authorization}=await db.rpc("hml_agent_workflow_authorization_snapshot_service",{p_user:auth.user.id,p_queue:queueId});
  return json({globalAiEnabled,supportedWorkflows,authorization,agents:snapshot.agents});
 }
 if(action==="plan"){
  try{return json({plan:buildAgentPlan(String(input.workflow??""),snapshot.agents)});}catch{return json({error:"unknown_workflow",supportedWorkflows},400);}
 }
 if(action==="authorize"){
  if(!globalAiEnabled)return json({error:"ai_disabled"},503);
  if(!uuid(input.request_key))return json({error:"request_key_required"},400);
  let plan;try{plan=buildAgentPlan(String(input.workflow??""),snapshot.agents);}catch{return json({error:"unknown_workflow",supportedWorkflows},400);}
  if(!plan.ready)return json({error:"agents_not_ready",plan},409);
  if(plan.maxCalls<1||plan.maxCalls>10||plan.maxCostUsd<=0||plan.maxCostUsd>0.50)return json({error:"workflow_budget_invalid",plan},409);
  const{data,error}=await db.rpc("hml_issue_agent_workflow_authorization_service",{
   p_user:auth.user.id,p_queue:queueId,p_request_key:input.request_key,p_allowed_agents:plan.gatewayAgents,
   p_max_calls:plan.maxCalls,p_max_cost:plan.maxCostUsd,p_ttl_minutes:15,
  });
  if(error)return json({error:"authorization_failed"},500);return data?json({authorization:data,plan}):json({error:"gate_denied",plan},409);
 }
 if(action==="revoke"){
  if(!uuid(input.authorization_id))return json({error:"authorization_id_required"},400);
  const{data,error}=await db.rpc("hml_revoke_agent_workflow_authorization_service",{p_user:auth.user.id,p_authorization:input.authorization_id});
  if(error)return json({error:"revoke_failed"},500);return data===true?json({revoked:true}):json({error:"revoke_denied"},409);
 }
 return json({error:"unknown_action"},400);
});
