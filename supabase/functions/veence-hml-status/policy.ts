export type QueueState = { status: string; attempt_count: number; max_attempts: number };

export function authorizedForClient(member: { role: string } | null, owner: { user_id: string } | null) {
  return Boolean(member?.role || owner?.user_id);
}

export function mayInvoke(enabled: boolean, queue: QueueState) {
  return enabled && queue.status === "pending" && queue.attempt_count === 0 && queue.max_attempts === 1;
}
