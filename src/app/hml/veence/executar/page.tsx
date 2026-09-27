"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { veenceHml } from "@/lib/veenceHmlClient";
import { currentHmlIdentity } from "@/lib/veenceHmlSession";
import { hmlAgentControlStatus, type HmlAgentWorkflowAuthorization } from "@/lib/veenceHmlAgentControl";

type RunResult = {
  ok?: boolean;
  status?: string;
  error?: string;
  workflow?: string;
  calls?: number;
  callsCompleted?: number;
  totalCalls?: number;
  completedAgent?: string;
  nextAgent?: string | null;
  totalCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  failedAgent?: string;
  retryAllowed?: boolean;
  agents?: unknown[];
};

function expired(gate: HmlAgentWorkflowAuthorization | null) {
  return !gate || new Date(gate.expiresAt).getTime() <= Date.now();
}

async function invokeWorkflow(authorizationId: string) {
  const { token } = await currentHmlIdentity(veenceHml.auth);
  const response = await veenceHml.functions.invoke("veence-hml-agent-workflow-runner", {
    body: { authorization_id: authorizationId },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.error) {
    let code = "workflow_transport_unknown";
    try {
      const context = response.error.context as { clone?: () => Response; json?: () => Promise<unknown> } | undefined;
      const reader = context?.clone?.() ?? context;
      const body = await reader?.json?.();
      if (body && typeof body === "object" && typeof (body as Record<string, unknown>).error === "string") code = String((body as Record<string, unknown>).error);
    } catch { /* estado permanece não confirmado */ }
    throw new Error(code);
  }
  return response.data as RunResult;
}

export default function ExecutarMultiagentePage() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gate, setGate] = useState<HmlAgentWorkflowAuthorization | null>(null);
  const [globalAiEnabled, setGlobalAiEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    const status = await hmlAgentControlStatus(veenceHml.auth, veenceHml.functions);
    setGate(status.authorization);
    setGlobalAiEnabled(status.globalAiEnabled);
  }, []);

  useEffect(() => {
    let mounted = true;
    void veenceHml.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthenticated(Boolean(data.session));
      setReady(true);
    }).catch(() => { if (mounted) setReady(true); });
    const { data } = veenceHml.auth.onAuthStateChange((_event, session) => {
      if (mounted) { setAuthenticated(Boolean(session)); setReady(true); }
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void refresh().catch(() => setMessage("Não foi possível consultar o gate. Entre novamente nesta tela ou volte ao painel HML."));
  }, [authenticated, refresh]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await veenceHml.auth.signInWithPassword({ email: email.trim(), password });
      setPassword("");
      if (error) throw error;
      setAuthenticated(true);
      setMessage("Sessão HML autenticada. Nenhuma IA foi executada.");
    } catch {
      setMessage("Acesso não autorizado. Confira os dados do usuário HML.");
    } finally {
      setBusy(false);
    }
  }

  const executable = Boolean(gate && gate.status === "pending" && gate.executionReleased && !expired(gate) && globalAiEnabled && gate.consumedCalls < gate.maxCalls);

  async function execute() {
    if (!gate || !executable || busy || inFlight.current) return;
    const confirmed = window.confirm(`EXECUÇÃO MULTIAGENTE REAL — HML\n\nFluxo: ${gate.workflow}\nProgresso durável: ${gate.consumedCalls}/${gate.maxCalls}\nTeto: US$ ${gate.maxCostUsd.toFixed(2)}\n\nA execução continuará somente a partir dos agentes ainda não executados. Chamadas já concluídas não serão repetidas. Deseja continuar agora?`);
    if (!confirmed) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("Execução em andamento por etapas duráveis. Chamadas já concluídas não serão repetidas.");
    setResult(null);
    try {
      let output: RunResult | null = null;
      for (let step = 0; step < gate.maxCalls; step += 1) {
        output = await invokeWorkflow(gate.id);
        setResult(output);
        if (output.ok !== true) throw new Error(output.error ?? "workflow_state_unknown");
        if (output.status === "completed") break;
        if (output.status !== "in_progress") throw new Error(output.error ?? "workflow_state_unknown");
        setMessage(`Etapa concluída com persistência durável: ${output.callsCompleted ?? "?"}/${output.totalCalls ?? gate.maxCalls}. Próximo agente: ${output.nextAgent ?? "a confirmar"}.`);
      }
      if (!output || output.status !== "completed") throw new Error("workflow_not_completed");
      setResult(output);
      setMessage(`Execução concluída: ${output.calls ?? 0} chamadas totais, custo reportado US$ ${(output.totalCostUsd ?? 0).toFixed(6)}. Resultado consultivo; decisão final permanece humana.`);
    } catch (error) {
      const code = error instanceof Error ? error.message : "workflow_transport_unknown";
      setMessage(code === "workflow_gate_expired"
        ? "O gate expirou. Nenhuma chamada concluída será repetida; confira auditoria antes de qualquer nova autorização."
        : code === "workflow_gate_not_released" ? "O gate não está liberado para execução. Nenhuma nova chamada foi iniciada."
        : code === "workflow_agent_state_unconfirmed" ? "Existe uma chamada com estado ainda não confirmado. Nenhuma repetição foi feita. Confira a auditoria."
        : code === "ai_disabled" ? "O kill switch está fechado. Nenhuma nova chamada foi iniciada."
        : code === "login_required" || code === "refresh_failed" || code === "invalid_session" ? "A sessão HML expirou antes da próxima etapa. Entre novamente; chamadas já concluídas permanecem registradas e não serão repetidas."
        : "O estado da execução não foi confirmado. NÃO repita manualmente o fluxo. Confira auditoria e consumo antes de qualquer nova ação.");
    } finally {
      setBusy(false);
      inFlight.current = false;
      void refresh().catch(() => undefined);
    }
  }

  return <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
    <section className="mx-auto max-w-4xl space-y-5 rounded-xl border border-slate-700 bg-slate-900 p-6">
      <h1 className="text-2xl font-bold">Veence · Execução multiagente REAL · HML</h1>
      <p className="text-sm text-slate-300">A execução usa progresso durável por agente. Se uma requisição atingir o limite de tempo, chamadas concluídas permanecem registradas e a continuação parte somente do próximo agente.</p>
      <a className="text-sm underline" href="/hml/veence">Voltar ao painel HML</a>
      {!ready ? <p>Verificando sessão…</p> : !authenticated ? <>
        <p className="text-sm text-amber-200">A sessão desta tela não foi encontrada. Entre novamente abaixo. O login não prepara gate e não executa IA.</p>
        <form onSubmit={signIn} className="grid gap-3 rounded border border-slate-700 p-4">
          <label>E-mail do usuário HML<input className="mt-1 block w-full rounded p-2 text-slate-900" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label>Senha<input className="mt-1 block w-full rounded p-2 text-slate-900" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
          <button className="rounded bg-blue-600 p-2 font-semibold disabled:opacity-50" disabled={busy}>{busy ? "Entrando…" : "Entrar no HML"}</button>
        </form>
      </> : <>
        <div className="rounded border border-cyan-700 p-4 text-sm">
          <h2 className="font-bold">Gate atual</h2>
          {!gate ? <p>Nenhum gate multiagente encontrado.</p> : <div className="mt-2 space-y-1">
            <p>ID: {gate.id}</p>
            <p>Fluxo: {gate.workflow}</p>
            <p>Estado: {gate.status}{expired(gate) ? " · expirado" : ""}</p>
            <p>Liberação humana: {gate.executionReleased ? "REGISTRADA" : "pendente"}</p>
            <p>Kill switch: {globalAiEnabled ? "habilitado" : "desabilitado"}</p>
            <p>Consumo: {gate.consumedCalls}/{gate.maxCalls} · reservado US$ {gate.reservedCostUsd.toFixed(2)} de US$ {gate.maxCostUsd.toFixed(2)}</p>
            <p>Expira: {new Date(gate.expiresAt).toLocaleString("pt-BR")}</p>
          </div>}
        </div>
        <button className="rounded bg-red-700 p-3 font-bold disabled:bg-slate-600" disabled={!executable || busy} onClick={() => void execute()}>{busy ? "Executando por etapas — não repetir" : gate && gate.consumedCalls > 0 ? "Continuar fluxo multiagente REAL" : "Executar fluxo multiagente REAL uma vez"}</button>
        {!executable && <p className="text-sm text-amber-200">Execução bloqueada. O gate precisa estar pendente, dentro da validade, com liberação humana registrada, kill switch habilitado e ainda possuir chamadas disponíveis.</p>}
        {result && <div className="rounded border border-slate-700 p-4"><h2 className="font-bold">Resultado técnico</h2><pre className="mt-2 max-h-[60vh] overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(result, null, 2)}</pre></div>}
      </>}
      {message && <p role="status" className="rounded border border-amber-400 p-3 text-sm">{message}</p>}
    </section>
  </main>;
}
