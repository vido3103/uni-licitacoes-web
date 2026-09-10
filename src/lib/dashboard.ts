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
  if (!membership?.client_id) return null;

  const { data, error } = await supabase.rpc("get_client_dashboard_backend", {
    p_client_id: membership.client_id,
  });

  if (error) throw error;
  return data as BackendDashboard;
}
