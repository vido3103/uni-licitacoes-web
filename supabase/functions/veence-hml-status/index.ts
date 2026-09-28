import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { authorizedForClient, mayInvoke } from "./policy.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const headers = { "content-type": "application/json", "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "unauthorized" }, 401);
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) return reply({ error: "unauthorized" }, 401);
  const queueId = Deno.env.get("VEENCE_HML_QUEUE_ID");
  if (!queueId) return reply({ error: "hml_queue_not_configured" }, 503);
  const { data: queue, error: queueError } = await db.from("opportunity_ai_analysis_queue")
    .select("id,client_id,status,attempt_count,max_attempts")
    .eq("id", queueId).maybeSingle();
  if (queueError || !queue) return reply({ error: "hml_queue_not_found" }, 503);
  const [{ data: member }, { data: owner }] = await Promise.all([
    db.from("client_members").select("role").eq("client_id", queue.client_id)
      .eq("user_id", userData.user.id).maybeSingle(),
    db.from("platform_user_roles").select("user_id").eq("user_id", userData.user.id)
      .eq("role", "platform_owner").eq("active", true).maybeSingle(),
  ]);
  if (!authorizedForClient(member, owner)) return reply({ error: "forbidden" }, 403);
  const { data: agents, error: catalogError } = await db.rpc("hml_agent_catalog_service");
  if (catalogError) return reply({ error: "catalog_unavailable" }, 503);
  const enabled = (Deno.env.get("VEENCE_AI_ENABLED") ?? "false").toLowerCase() === "true";
  return reply({
    queue: { id: queue.id, status: queue.status, attempts: queue.attempt_count, maxAttempts: queue.max_attempts },
    clientId: queue.client_id, userId: userData.user.id,
    enabled, runnable: mayInvoke(enabled, queue),
    agents, reviewRequired: true,
  });
});
