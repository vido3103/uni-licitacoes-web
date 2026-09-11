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

  const { data: membership, error: membershipError } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", auth.user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;

  let clientId = membership?.client_id ? String(membership.client_id) : "";
  if (!clientId) {
    const { data: owner, error: ownerError } = await supabase
      .from("platform_user_roles")
      .select("role")
      .eq("user_id", auth.user.id)
      .eq("role", "platform_owner")
      .eq("active", true)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (owner && typeof window !== "undefined") clientId = localStorage.getItem("uni-owner-client-id") || "";
  }

  if (!clientId) return null;

  const { data, error } = await supabase.functions.invoke("dashboard-backend", {
    body: { client_id: clientId },
  });

  if (error) throw error;
  if (!data?.ok || !data?.dashboard) throw new Error(data?.detail || data?.error || "Não foi possível carregar o dashboard.");
  return data.dashboard as BackendDashboard;
}
