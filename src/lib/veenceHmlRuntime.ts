import { currentHmlIdentity, type HmlAuth, type HmlTransport } from "./veenceHmlSession.ts";

type RuntimeAction = "status" | "authorize_mock" | "run_mock" | "revoke_mock";
type RuntimeTransport = Pick<HmlTransport, "invoke">;

export async function hmlRuntimeRequest(
  auth: HmlAuth, transport: RuntimeTransport, action: RuntimeAction,
  data: Record<string, string> = {},
) {
  const { token } = await currentHmlIdentity(auth);
  const response = await transport.invoke("veence-hml-runtime", {
    body: { action, ...data }, headers: { Authorization: `Bearer ${token}` },
  });
  if (response.error) {
    const status = response.error.context?.status;
    throw new Error(status === 401 ? "session_expired" : status === 403 ? "forbidden" : "runtime_request_failed");
  }
  return response.data;
}
