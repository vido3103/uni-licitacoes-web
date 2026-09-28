export type SessionLike = { access_token: string; expires_at?: number | null };
export type HmlAuth = {
  getSession(): Promise<{ data: { session: SessionLike | null }; error: { message: string } | null }>;
  refreshSession(): Promise<{ data: { session: SessionLike | null }; error: { message: string } | null }>;
  getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
};

export class HmlSessionError extends Error {
  readonly code: "login_required" | "refresh_failed" | "invalid_session";
  constructor(code: "login_required" | "refresh_failed" | "invalid_session") {
    super(code);
    this.code = code;
  }
}

// Refresh ahead of expiry, and verify the user with Auth before any execution request.
// A failed refresh or 401 is terminal for that button click: no automatic retry of inference.
export async function currentHmlIdentity(auth: HmlAuth, nowSeconds = Math.floor(Date.now() / 1000)) {
  const current = await auth.getSession();
  if (current.error || !current.data.session) throw new HmlSessionError("login_required");
  let session = current.data.session;
  if (!session.expires_at || session.expires_at <= nowSeconds + 90) {
    const refreshed = await auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) throw new HmlSessionError("refresh_failed");
    session = refreshed.data.session;
  }
  if (!session.access_token) throw new HmlSessionError("invalid_session");
  const checked = await auth.getUser(session.access_token);
  if (checked.error || !checked.data.user) throw new HmlSessionError("invalid_session");
  return { token: session.access_token, userId: checked.data.user.id };
}

export type HmlTransport = {
  invoke(name: string, options: { body: Record<string, string>; headers: { Authorization: string } }): Promise<{
    data: unknown;
    error: { message: string; context?: { status?: number } } | null;
  }>;
};

export async function invokeHmlOnce(auth: HmlAuth, transport: HmlTransport, queueId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(queueId)) {
    throw new Error("invalid_queue_id");
  }
  const { token } = await currentHmlIdentity(auth);
  const reply = await transport.invoke("veence-hml-single-shot", {
    body: { queue_id: queueId },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (reply.error) throw new Error(reply.error.context?.status === 401 ? "session_expired" : "execution_failed");
  return reply.data;
}
