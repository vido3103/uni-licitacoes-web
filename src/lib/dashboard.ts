import { supabase } from "@/lib/supabase";

export type BackendDashboard={client:{id:string;legal_name:string;display_name:string|null;status:string}|null;summary:Record<string,number|string|null>;pending:Record<string,number|string|null>;opportunities:Array<Record<string,unknown>>;market:Array<Record<string,unknown>>;enrollments:Array<Record<string,unknown>>};

type ClientRef={id:string;status?:string|null};

export async function resolveCurrentClientId():Promise<string|null>{
  if(!supabase)return null;
  const{data:auth}=await supabase.auth.getUser();
  if(!auth.user)return null;

  const selected=typeof window!=="undefined"?sessionStorage.getItem("uni-owner-client-id"):null;
  if(selected){
    const{data,error}=await supabase.from("clients").select("id,status").eq("id",selected).maybeSingle();
    if(!error&&data?.id&&data.status!=="inactive")return String(data.id);
    sessionStorage.removeItem("uni-owner-client-id");
  }

  const{data:memberships,error}=await supabase.from("client_members").select("client_id").eq("user_id",auth.user.id);
  if(error)throw error;
  const ids=Array.from(new Set((memberships??[]).map(m=>String(m.client_id)).filter(Boolean)));
  if(ids.length===0)return null;
  const{data:clients,error:clientError}=await supabase.from("clients").select("id,status").in("id",ids);
  if(clientError)throw clientError;
  const rows=(clients??[]) as ClientRef[];
  const active=rows.find(c=>c.status!=="inactive");
  return active?.id??rows[0]?.id??null;
}

export async function loadCurrentClientDashboard():Promise<BackendDashboard|null>{
  if(!supabase)return null;
  const clientId=await resolveCurrentClientId();
  if(!clientId)return null;
  const{data,error}=await supabase.rpc("get_client_dashboard_backend",{p_client_id:clientId});
  if(error)throw error;
  return data as BackendDashboard;
}
