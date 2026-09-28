import { currentHmlIdentity, type HmlAuth, type HmlTransport } from "./veenceHmlSession.ts";

type RuntimeAction = "status" | "authorize_mock" | "run_mock" | "revoke_mock" |
  "authorize_real" | "run_real" | "revoke_real";
type RuntimeTransport = Pick<HmlTransport, "invoke">;
type ErrorContext = {
  status?: number;
  clone?: () => ErrorContext;
  json?: () => Promise<unknown>;
};

async function remoteError(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: ErrorContext }).context;
  if (!context?.json) return null;
  try {
    const reader = context.clone?.() ?? context;
    const body = await reader.json?.();
    if (body && typeof body === "object") {
      const code = (body as Record<string, unknown>).error;
      return typeof code === "string" && code ? code : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function hmlRuntimeRequest(
  auth: HmlAuth, transport: RuntimeTransport, action: RuntimeAction,
  data: Record<string, string> = {},
) {
  const { token } = await currentHmlIdentity(auth);
  const response = await transport.invoke("veence-hml-runtime", {
    body: { action, ...data }, headers: { Authorization: `Bearer ${token}` },
  });
  if (response.error) {
    const code = await remoteError(response.error);
    if (code) throw new Error(code);
    const status = response.error.context?.status;
    throw new Error(status === 401 ? "session_expired" : status === 403 ? "forbidden" :
      status === 503 ? "runtime_disabled" : "runtime_request_failed");
  }
  return response.data;
}
