export type MockGate = {
  id: string; authorized_by: string; client_id: string; queue_id: string;
  status: string; expires_at: string; consumed_calls: number; max_calls: number;
  max_cost_usd: number; flow: string;
};
export type GateContext = {
  userId: string; clientId: string; queueId: string;
  queue: { status: string; attempts: number; maxAttempts: number };
};

export function mockQueueReady(context: GateContext) {
  return context.queue.status === "pending" && context.queue.attempts === 0 && context.queue.maxAttempts === 1;
}

export function mockGateDecision(gate: MockGate | null, context: GateContext, nowMs: number): "reserve" | "replay" | "deny" {
  if (!gate || !mockQueueReady(context) || gate.authorized_by !== context.userId ||
      gate.client_id !== context.clientId || gate.queue_id !== context.queueId ||
      gate.flow !== "mock_orchestration" || gate.max_calls !== 1 || gate.max_cost_usd !== 0) return "deny";
  if (gate.status === "consumed" && gate.consumed_calls === 1) return "replay";
  if (gate.status !== "pending" || gate.consumed_calls !== 0 ||
      !Number.isFinite(Date.parse(gate.expires_at)) || Date.parse(gate.expires_at) <= nowMs) return "deny";
  return "reserve";
}
