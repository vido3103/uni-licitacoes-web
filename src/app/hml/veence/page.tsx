"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { veenceHml } from "@/lib/veenceHmlClient";
import { hmlRuntimeRequest } from "@/lib/veenceHmlRuntime";

type Agent = { code: string; version: string; enabled: boolean; model: string | null; provider: string; maxCostUsd: number };
type Status = {
  queue: { id: string; status: string; attempts: number; maxAttempts: number };
  clientId: string; userId: string; globalAiEnabled: boolean; mockAvailable: boolean;
  opportunity: { id: string; title: string | null; buyer_name: string | null; process_number: string | null } | null;
  agents: Agent[];
  authorization: { id: string; status: string; max_cost_usd: number; max_calls: number;
    consumed_calls: number; expires_at: string; agent_code: string } | null;
  execution: { id: string; status: string; result: unknown; cost_usd: number;
    input_tokens: number; output_tokens: number } | null;
  audit: Array<{ type: string; at: string; details: Record<string, unknown> }>;
};

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
    } catch {
      setMessage("Acesso não autorizado. Confira os dados do usuário HML.");
    } finally { setBusy(false); }
  }

  async function command(action: "authorize_mock" | "run_mock" | "revoke_mock", data: Record<string, string>) {
    if (inFlight.current || busy) return;
    inFlight.current = true;
    setBusy(true); setMessage("");
    try {
      const result = await hmlRuntimeRequest(veenceHml.auth, veenceHml.functions, action, data);
      setMessage(action === "authorize_mock" ? "Autorização mock registrada. Nenhuma IA foi chamada."
        : action === "revoke_mock" ? "Autorização revogada."
          : `Simulação concluída: ${JSON.stringify(result)}. Decisão sujeita a revisão humana.`);
    } catch (error) {
      setMessage(error instanceof Error && /session|login|refresh/.test(error.message)
        ? "A sessão expirou antes do envio. Entre novamente; nenhuma repetição automática foi feita."
        : "A operação não foi confirmada. Verifique a auditoria antes de qualquer nova ação.");
    } finally {
      setBusy(false); inFlight.current = false;
      void loadStatus().catch(() => setStatus(null));
    }
  }

  function authorize() {
    const storageKey = `veence-hml-mock-authorization-${status?.queue.id}`;
    let key = sessionStorage.getItem(storageKey);
    if (!key || status?.authorization?.status === "revoked") {
      key = crypto.randomUUID(); sessionStorage.setItem(storageKey, key);
    }
    void command("authorize_mock", { request_key: key });
  }

  return <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
    <section className="mx-auto max-w-3xl space-y-6 rounded-xl border border-slate-700 bg-slate-900 p-6">
      <h1 className="text-2xl font-bold">Veence · Homologação isolada</h1>
      <p className="text-sm text-slate-300">Supabase Auth renova a sessão automaticamente. Este painel executa apenas simulações sem IA; a decisão permanece humana.</p>
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
              <p>Kill switch global: {status.globalAiEnabled ? "habilitado" : "desabilitado"}. Simulação: {status.mockAvailable ? "disponível" : "bloqueada"}.</p>
            </div>
            <div className="rounded border border-slate-700 p-3">
              <h2 className="font-bold">Gate operacional mock</h2>
              <p>Orquestradora Veence · teto US$ 0,00 · 1 execução · validade 30 minutos</p>
              <p>Estado: {status.authorization?.status || "sem autorização"} · consumidas: {status.authorization?.consumed_calls ?? 0}/{status.authorization?.max_calls ?? 1}</p>
              {status.authorization && <p>Expira: {new Date(status.authorization.expires_at).toLocaleString("pt-BR")}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded bg-blue-600 p-2 disabled:bg-slate-600" disabled={busy || !status.mockAvailable || Boolean(status.authorization && status.authorization.status !== "revoked")}
                  onClick={authorize}>Preparar autorização mock</button>
                <button className="rounded bg-emerald-700 p-2 disabled:bg-slate-600" disabled={busy || !status.mockAvailable || status.authorization?.status !== "pending" || new Date(status.authorization.expires_at).getTime() <= Date.now()}
                  onClick={() => void command("run_mock", { authorization_id: status.authorization!.id })}>Executar simulação uma vez</button>
                <button className="rounded bg-rose-800 p-2 disabled:bg-slate-600" disabled={busy || status.authorization?.status !== "pending"}
                  onClick={() => void command("revoke_mock", { authorization_id: status.authorization!.id })}>Revogar</button>
              </div>
            </div>
            <div className="rounded border border-slate-700 p-3"><h2 className="font-bold">Agentes</h2>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">{status.agents.map(agent => <li key={agent.code}>{agent.code} · real {agent.enabled ? "ativo" : "inativo"} · {agent.model || "modelo não definido"} · teto US$ {agent.maxCostUsd}</li>)}</ul>
            </div>
            <div className="rounded border border-slate-700 p-3"><h2 className="font-bold">Execução e resultado</h2>
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
