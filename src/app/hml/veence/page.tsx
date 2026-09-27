"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { veenceHml } from "@/lib/veenceHmlClient";
import { hmlRuntimeRequest } from "@/lib/veenceHmlRuntime";

type Agent = { code: string; version: string; enabled: boolean; model: string | null; provider: string; maxCostUsd: number };
type Authorization = { id: string; status: string; max_cost_usd: number; max_calls: number; consumed_calls: number; expires_at: string; agent_code: string; flow?: string };
type Status = {
  queue: { id: string; status: string; attempts: number; maxAttempts: number };
  clientId: string; userId: string; globalAiEnabled: boolean; mockAvailable: boolean; realAvailable: boolean;
  opportunity: { id: string; title: string | null; buyer_name: string | null; process_number: string | null } | null;
  agents: Agent[];
  authorization: Authorization | null;
  mockAuthorization: Authorization | null;
  gatewayAuthorization: Authorization | null;
  execution: { id: string; status: string; result: unknown; cost_usd: number; input_tokens: number; output_tokens: number } | null;
  audit: Array<{ type: string; at: string; details: Record<string, unknown> }>;
};

type CommandAction = "authorize_mock" | "run_mock" | "revoke_mock" | "authorize_real" | "run_real" | "revoke_real";

export default function VeenceHmlPage() {
  const [sessionReady, setSessionReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);

  const loadStatus = useCallback(async () => {
    const response = await hmlRuntimeRequest(veenceHml.auth, veenceHml.functions, "status");
    setStatus(response as Status);
  }, []);

  useEffect(() => {
    let mounted = true;
    void veenceHml.auth.getSession().then(({ data }) => {
      if (mounted) { setAuthenticated(Boolean(data.session)); setSessionReady(true); }
    }).catch(() => { if (mounted) setSessionReady(true); });
    const { data } = veenceHml.auth.onAuthStateChange((_event, session) => {
      if (mounted) { setAuthenticated(Boolean(session)); setSessionReady(true); }
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void loadStatus().catch(() => setMessage("Sessão expirada ou acesso HML indisponível. Entre novamente."));
  }, [authenticated, loadStatus]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await veenceHml.auth.signInWithPassword({ email: email.trim(), password });
      setPassword("");
      if (error) throw error;
      setAuthenticated(true);
    } catch { setMessage("Acesso não autorizado. Confira os dados do usuário HML."); }
    finally { setBusy(false); }
  }

  async function command(action: CommandAction, data: Record<string, string>) {
    if (inFlight.current || busy) return;
    inFlight.current = true; setBusy(true); setMessage("");
    try {
      const result = await hmlRuntimeRequest(veenceHml.auth, veenceHml.functions, action, data);
      if (action === "authorize_mock") {
        const authorization = (result as { authorization?: { status?: string } }).authorization;
        if (authorization?.status !== "pending") throw new Error("authorization_not_pending");
        setMessage("Autorização mock registrada. Nenhuma IA foi chamada.");
      }
      else if (action === "revoke_mock" || action === "revoke_real") setMessage("Autorização revogada.");
      else if (action === "run_mock") setMessage(`Simulação concluída: ${JSON.stringify(result)}. Decisão sujeita a revisão humana.`);
      else if (action === "authorize_real") {
        const authorization = (result as { authorization?: { status?: string } }).authorization;
        if (authorization?.status !== "pending") throw new Error("authorization_not_pending");
        setMessage("Autorização REAL registrada por 10 minutos. Nenhuma inferência foi feita ainda.");
      }
      else setMessage(`Execução real finalizada sem repetição automática: ${JSON.stringify(result)}. Confira resultado e auditoria.`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      setMessage(/session|login|refresh/.test(text)
        ? "A sessão expirou antes do envio. Entre novamente; nenhuma repetição automática foi feita."
        : text === "ai_disabled" || text === "runtime_disabled" ? "IA global está bloqueada pelo kill switch. Nenhuma inferência foi feita."
        : text.startsWith("ai_gateway_timeout") ? "TIMEOUT DA IA: a chamada real excedeu a janela de processamento. O estado é FAILED/AMBÍGUO e o gate foi consumido. Não repita a inferência; confira status e auditoria."
        : text === "single_shot_transport_unknown" ? "ESTADO AMBÍGUO: a resposta do worker não foi confirmada. Não repita a inferência; confira status e auditoria."
        : text === "authorization_not_pending" ? "A autorização não ficou pendente. Nenhuma inferência foi feita; atualize o status antes de continuar."
        : "A operação falhou ou não foi confirmada. Verifique status e auditoria antes de qualquer nova ação; não repita automaticamente.");
    } finally {
      setBusy(false); inFlight.current = false;
      void loadStatus().catch(() => setStatus(null));
    }
  }

  function authorizeMock() {
    const storageKey = `veence-hml-mock-authorization-${status?.queue.id}`;
    const key = crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
    void command("authorize_mock", { request_key: key });
  }

  function authorizeReal() {
    const storageKey = `veence-hml-real-authorization-${status?.queue.id}`;
    const key = crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
    void command("authorize_real", { request_key: key });
  }

  function runReal() {
    const gate = status?.gatewayAuthorization;
    if (!gate) return;
    const confirmed = window.confirm("CONFIRMAÇÃO DE INFERÊNCIA REAL\n\nSerá feita UMA única chamada ao AI Gateway para a fixture PE 18/2026. O gate será consumido e não haverá retry automático. Deseja executar agora?");
    if (confirmed) void command("run_real", { authorization_id: gate.id });
  }

  const mockGate = status?.mockAuthorization ?? (status?.authorization?.flow === "mock_orchestration" ? status.authorization : null);
  const realGate = status?.gatewayAuthorization;

  return <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
    <section className="mx-auto max-w-3xl space-y-6 rounded-xl border border-slate-700 bg-slate-900 p-6">
      <h1 className="text-2xl font-bold">Veence · Homologação isolada</h1>
      <p className="text-sm text-slate-300">Supabase Auth renova a sessão automaticamente. Mock e inferência real são fluxos separados; nenhuma chamada real ocorre sem autorização específica e confirmação humana.</p>
      {!sessionReady ? <p>Verificando sessão…</p> : !authenticated ?
        <form onSubmit={signIn} className="grid gap-3">
          <label>E-mail do usuário HML<input className="mt-1 block w-full rounded p-2 text-slate-900" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Senha<input className="mt-1 block w-full rounded p-2 text-slate-900" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <button className="rounded bg-blue-600 p-2 disabled:opacity-50" disabled={busy}>Entrar</button>
        </form> : <>
          <button className="text-sm underline" onClick={() => void veenceHml.auth.signOut()}>Sair</button>
          {status && <div className="space-y-5 text-sm">
            <div className="rounded border border-slate-700 p-3">
              <h2 className="font-bold">Identidade e fixture</h2>
              <p>Usuário: {status.userId} · Cliente: {status.clientId}</p>
              <p>Oportunidade: {status.opportunity?.title || "PE 18/2026"} · {status.opportunity?.buyer_name || "1º BEC"}</p>
              <p>Fila: {status.queue.id} · {status.queue.status} · tentativas {status.queue.attempts}/{status.queue.maxAttempts}</p>
              <p>Kill switch global: {status.globalAiEnabled ? "habilitado" : "desabilitado"}.</p>
            </div>

            <div className="rounded border border-slate-700 p-3">
              <h2 className="font-bold">Gate operacional mock</h2>
              <p>Orquestradora Veence · teto US$ 0,00 · 1 execução · validade 30 minutos</p>
              <p>Estado: {mockGate?.status || "sem autorização"} · consumidas: {mockGate?.consumed_calls ?? 0}/{mockGate?.max_calls ?? 1}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded bg-blue-600 p-2 disabled:bg-slate-600" disabled={busy || !status.mockAvailable || Boolean(mockGate && mockGate.status !== "revoked" && mockGate.status !== "consumed")} onClick={authorizeMock}>Preparar autorização mock</button>
                <button className="rounded bg-emerald-700 p-2 disabled:bg-slate-600" disabled={busy || !status.mockAvailable || mockGate?.status !== "pending" || new Date(mockGate.expires_at).getTime() <= Date.now()} onClick={() => void command("run_mock", { authorization_id: mockGate!.id })}>Executar simulação uma vez</button>
                <button className="rounded bg-rose-800 p-2 disabled:bg-slate-600" disabled={busy || mockGate?.status !== "pending"} onClick={() => void command("revoke_mock", { authorization_id: mockGate!.id })}>Revogar mock</button>
              </div>
            </div>

            <div className="rounded border border-amber-500/60 bg-amber-950/20 p-3">
              <h2 className="font-bold text-amber-200">Gate de inferência REAL</h2>
              <p>AI Gateway · máximo 1 chamada · teto operacional US$ 0,10 · validade 10 minutos · sem retry automático.</p>
              <p>Disponibilidade: {status.realAvailable ? "liberada pelo kill switch" : "bloqueada"}.</p>
              <p>Estado: {realGate?.status || "sem autorização"} · consumidas: {realGate?.consumed_calls ?? 0}/{realGate?.max_calls ?? 1}</p>
              {realGate && <p>Expira: {new Date(realGate.expires_at).toLocaleString("pt-BR")}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded bg-amber-600 p-2 disabled:bg-slate-600" disabled={busy || !status.realAvailable || Boolean(realGate && realGate.status === "pending")} onClick={authorizeReal}>Preparar autorização REAL</button>
                <button className="rounded bg-red-700 p-2 font-bold disabled:bg-slate-600" disabled={busy || !status.realAvailable || realGate?.status !== "pending" || new Date(realGate.expires_at).getTime() <= Date.now()} onClick={runReal}>Executar 1 inferência REAL</button>
                <button className="rounded bg-slate-700 p-2 disabled:bg-slate-600" disabled={busy || realGate?.status !== "pending"} onClick={() => void command("revoke_real", { authorization_id: realGate!.id })}>Revogar autorização real</button>
              </div>
            </div>

            <div className="rounded border border-slate-700 p-3"><h2 className="font-bold">Agentes</h2>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">{status.agents.map(agent => <li key={agent.code}>{agent.code} · real {agent.enabled ? "ativo" : "inativo"} · {agent.model || "modelo não definido"} · teto US$ {agent.maxCostUsd}</li>)}</ul>
            </div>
            <div className="rounded border border-slate-700 p-3"><h2 className="font-bold">Execução mock e resultado</h2>
              <p>{status.execution?.status || "não iniciada"} · custo US$ {status.execution?.cost_usd ?? 0} · tokens {status.execution?.input_tokens ?? 0}/{status.execution?.output_tokens ?? 0}</p>
              {status.execution?.result != null && <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(status.execution.result, null, 2)}</pre>}
            </div>
            <div className="rounded border border-slate-700 p-3"><h2 className="font-bold">Auditoria</h2>
              <ul className="mt-2 space-y-1">{status.audit.map((event, index) => <li key={`${event.at}-${index}`}>{new Date(event.at).toLocaleString("pt-BR")} · {event.type}</li>)}</ul>
            </div>
          </div>}
        </>}
      {message && <p role="status" className="rounded border border-amber-400 p-3 text-sm">{message}</p>}
    </section>
  </main>;
}
