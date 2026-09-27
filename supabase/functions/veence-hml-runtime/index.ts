import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { dispatchMock } from "./mock-dispatcher.ts";
import { mockGateDecision, mockQueueReady } from "./gate-policy.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const headers = { "content-type": "application/json", "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
const uuid = (value: unknown) => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "unauthorized" }, 401);
  const queueId = Deno.env.get("VEENCE_HML_QUEUE_ID");
  if (!queueId) return json({ error: "hml_queue_not_configured" }, 503);
  const input = await request.json().catch(() => ({}));
  const action = String(input.action ?? "status");
  const { data: snapshot, error: snapshotError } = await db.rpc("hml_mock_snapshot_service", {
    p_user: auth.user.id, p_queue: queueId,
  });
  if (snapshotError) return json({ error: "runtime_unavailable" }, 503);
  if (!snapshot) return json({ error: "forbidden" }, 403);
  const globalAiEnabled = (Deno.env.get("VEENCE_AI_ENABLED") ?? "false").toLowerCase() === "true";
  if (action === "status") {
    const { data: queue } = await db.from("opportunity_ai_analysis_queue")
      .select("opportunity_id").eq("id", queueId).maybeSingle();
    const { data: opportunity } = queue?.opportunity_id
      ? await db.from("public_opportunities").select("id,title,buyer_name,process_number")
        .eq("id", queue.opportunity_id).maybeSingle()
      : { data: null };
    return json({ ...snapshot, opportunity, globalAiEnabled,
      mockAvailable: mockQueueReady({ userId: auth.user.id, clientId: snapshot.clientId,
        queueId, queue: snapshot.queue }) });
  }

  if (action === "authorize_mock") {
    if (!uuid(input.request_key)) return json({ error: "request_key_required" }, 400);
    if (!mockQueueReady({ userId: auth.user.id, clientId: snapshot.clientId, queueId,
      queue: snapshot.queue })) return json({ error: "gate_denied" }, 409);
    const { data, error } = await db.rpc("hml_issue_mock_authorization_service", {
      p_user: auth.user.id, p_queue: queueId, p_request_key: input.request_key,
      p_agent: "orchestracao_veence", p_max_cost: 0, p_ttl_minutes: 30,
    });
    if (error) return json({ error: "authorization_failed" }, 500);
    return data ? json({ authorization: data }) : json({ error: "gate_denied" }, 409);
  }

  if (action === "revoke_mock") {
    if (!uuid(input.authorization_id)) return json({ error: "authorization_id_required" }, 400);
    const { data, error } = await db.rpc("hml_revoke_mock_authorization_service", {
      p_user: auth.user.id, p_authorization: input.authorization_id,
    });
    if (error) return json({ error: "revoke_failed" }, 500);
    return data === true ? json({ revoked: true }) : json({ error: "revoke_denied" }, 409);
  }

  if (action === "run_mock") {
    if (!uuid(input.authorization_id)) return json({ error: "authorization_id_required" }, 400);
    if (snapshot.authorization?.id !== input.authorization_id ||
        mockGateDecision(snapshot.authorization, { userId: auth.user.id,
          clientId: snapshot.clientId, queueId, queue: snapshot.queue }, Date.now()) === "deny") {
      return json({ error: "gate_denied" }, 409);
    }
    const { data: reservation, error: reserveError } = await db.rpc("hml_consume_mock_authorization_service", {
      p_user: auth.user.id, p_queue: queueId, p_authorization: input.authorization_id,
    });
    if (reserveError) return json({ error: "gate_unavailable" }, 500);
    if (!reservation) return json({ error: "gate_denied" }, 409);
    if (reservation.replayed) return json({ replayed: true, executionId: reservation.executionId,
      status: reservation.status, result: reservation.result ?? null });
    try {
      const result = await dispatchMock({ executionId: reservation.executionId, queueId,
        clientId: reservation.clientId, queueStatus: snapshot.queue.status,
        attempts: snapshot.queue.attempts, maxAttempts: snapshot.queue.maxAttempts,
        agents: snapshot.agents });
      const { data: completed, error: completeError } = await db.rpc("hml_complete_mock_execution_service", {
        p_user: auth.user.id, p_execution: reservation.executionId, p_result: result,
      });
      if (completeError || completed !== true) return json({ error: "persistence_unconfirmed",
        executionId: reservation.executionId, retryAllowed: false }, 500);
      return json({ executionId: reservation.executionId, status: "completed", result });
    } catch {
      // The gate remains consumed on any failure. Never dispatch a second time.
      return json({ error: "mock_dispatch_failed", executionId: reservation.executionId,
        retryAllowed: false }, 500);
    }
  }
  return json({ error: "unknown_action" }, 400);
});
