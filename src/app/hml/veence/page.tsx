"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { veenceHml } from "@/lib/veenceHmlClient";
import { currentHmlIdentity, invokeHmlOnce } from "@/lib/veenceHmlSession";

type Agent = { code: string; version: string; enabled: boolean; model: string | null; provider: string; maxCostUsd: number };
type Status = {
  queue: { id: string; status: string; attempts: number; maxAttempts: number };
  clientId: string; userId: string; enabled: boolean; runnable: boolean;
  agents: Agent[]; reviewRequired: boolean;
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
    const { token } = await currentHmlIdentity(veenceHml.auth);
    const response = await veenceHml.functions.invoke<Status>("veence-hml-status", {
      body: {}, headers: { Authorization: `Bearer ${token}` },
    });
    if (response.error || !response.data) throw new Error("Não foi possível consultar o estado do HML.");
    setStatus(response.data);
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

  async function runOnce() {
    if (inFlight.current || busy || !status?.runnable) return;
    inFlight.current = true;
    setBusy(true); setMessage("");
    try {
      const result = await invokeHmlOnce(veenceHml.auth, veenceHml.functions, status.queue.id);
      setMessage(`Solicitação concluída: ${JSON.stringify(result)}. Decisão sujeita a revisão humana.`);
    } catch (error) {
      setMessage(error instanceof Error && /session|login|refresh/.test(error.message)
        ? "A sessão expirou antes do envio. Entre novamente; nenhuma repetição automática foi feita."
        : "A execução não foi confirmada. Verifique a auditoria antes de qualquer nova ação.");
    } finally {
      setBusy(false); inFlight.current = false;
      void loadStatus().catch(() => setStatus(null));
    }
  }

  return <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
    <section className="mx-auto max-w-3xl space-y-6 rounded-xl border border-slate-700 bg-slate-900 p-6">
      <h1 className="text-2xl font-bold">Veence · Homologação isolada</h1>
      <p className="text-sm text-slate-300">Supabase Auth renova a sessão automaticamente. O servidor verifica a vinculação à cliente antes de acessar a fila. A IA é consultiva; a decisão permanece humana.</p>
      {!sessionReady ? <p>Verificando sessão…</p> : !authenticated ?
        <form onSubmit={signIn} className="grid gap-3">
          <label>E-mail do usuário HML<input className="mt-1 block w-full rounded p-2 text-slate-900" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Senha<input className="mt-1 block w-full rounded p-2 text-slate-900" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <button className="rounded bg-blue-600 p-2 disabled:opacity-50" disabled={busy}>Entrar</button>
        </form> : <>
          <button className="text-sm underline" onClick={() => void veenceHml.auth.signOut()}>Sair</button>
          {status && <div className="space-y-3 text-sm">
            <p>Fila: {status.queue.status} · tentativas {status.queue.attempts}/{status.queue.maxAttempts}</p>
            <p>IA: {status.enabled ? "habilitada no HML" : "desabilitada (fail-closed)"}</p>
            <p>Agentes configuráveis: {status.agents.length} · ativos: {status.agents.filter(a => a.enabled).length}</p>
            <button className="rounded bg-blue-600 p-3 font-bold disabled:cursor-not-allowed disabled:bg-slate-600" disabled={!status.runnable || busy} onClick={() => void runOnce()}>
              Executar uma vez (requer autorização expressa)
            </button>
          </div>}
        </>}
      {message && <p role="status" className="rounded border border-amber-400 p-3 text-sm">{message}</p>}
    </section>
  </main>;
}
