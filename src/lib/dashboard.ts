import { supabase } from "@/lib/supabase";

export type BackendDashboard = {
  client: { id: string; legal_name: string; display_name: string | null; status: string } | null;
  summary: Record<string, number | string | null>;
  pending: Record<string, number | string | null>;
  opportunities: Array<Record<string, unknown>>;
  market: Array<Record<string, unknown>>;
  enrollments: Array<Record<string, unknown>>;
};

export async function loadCurrentClientDashboard(): Promise<BackendDashboard | null> {
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: identity } = await supabase.rpc("get_my_uni_identity");
  const memberships = Array.isArray(identity?.memberships) ? identity.memberships as Array<{client_id?:string}> : [];
  let clientId = memberships.find(m=>m?.client_id)?.client_id ?? null;
  if (!clientId && identity?.platform_role === "platform_owner") {
    const { data: clients, error: clientError } = await supabase.from("clients").select("id").order("created_at",{ascending:true}).limit(1);
    if (clientError) throw clientError;
    clientId = clients?.[0]?.id ?? null;
  }
  if (!clientId) return null;
  const { data, error } = await supabase.functions.invoke("dashboard-backend", { body: { client_id: clientId } });
  if (error || data?.error) throw new Error("Não foi possível carregar o ambiente autenticado.");
  return data.dashboard as BackendDashboard;
}
