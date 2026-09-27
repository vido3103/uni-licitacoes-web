"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { veenceHml } from "@/lib/veenceHmlClient";
import { currentHmlIdentity } from "@/lib/veenceHmlSession";
import { hmlAgentControlStatus, type HmlAgentWorkflowAuthorization } from "@/lib/veenceHmlAgentControl";

type RunResult = {
  ok?: boolean;
  status?: string;
  error?: string;
  workflow?: string;
  calls?: number;
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
    void refresh().catch(() => setMessage("Não foi possível consultar o gate. Volte à tela principal e entre novamente."));
  }, [authenticated, refresh]);

  const executable = Boolean(gate && gate.status === "pending" && gate.executionReleased && !expired(gate) && globalAiEnabled && gate.consumedCalls === 0);

  async function execute() {
    if (!gate || !executable || busy || inFlight.current) return;
    const confirmed = window.confirm(`EXECUÇÃO MULTIAGENTE REAL — HML\n\nFluxo: ${gate.workflow}\nChamadas máximas: ${gate.maxCalls}\nTeto: US$ ${gate.maxCostUsd.toFixed(2)}\n\nA execução é única, sem retry automático, sem fallback e sem reentrada após consumo parcial. Deseja iniciar agora?`);
    if (!confirmed) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("Execução iniciada. Não recarregue a página e não repita o comando.");
    setResult(null);
    try {
      const output = await invokeWorkflow(gate.id);
      setResult(output);
      setMessage(output.ok === true
        ? `Execução concluída: ${output.calls ?? 0} chamadas, custo reportado US$ ${(output.totalCostUsd ?? 0).toFixed(6)}. Resultado consultivo; decisão final permanece humana.`
        : "A execução retornou estado não concluído. Não repita; confira o resultado abaixo e a auditoria.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "workflow_transport_unknown";
      setMessage(code === "workflow_gate_expired"
        ? "O gate expirou antes do disparo. Nenhuma nova tentativa foi feita; prepare e libere um novo gate na tela principal."
        : code === "workflow_gate_not_released" ? "O gate não está liberado para execução. Nenhuma chamada foi iniciada."
        : code === "ai_disabled" ? "O kill switch está fechado. Nenhuma chamada foi iniciada."
        : "O estado da execução não foi confirmado. NÃO repita o comando. Confira auditoria e consumo antes de qualquer nova ação.");
    } finally {
      setBusy(false);
      inFlight.current = false;
      void refresh().catch(() => undefined);
    }
  }

  return <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
    <section className="mx-auto max-w-4xl space-y-5 rounded-xl border border-slate-700 bg-slate-900 p-6">
      <h1 className="text-2xl font-bold">Veence · Execução multiagente REAL · HML</h1>
      <p className="text-sm text-slate-300">Esta tela apenas dispara um gate já preparado e liberado por humano. Não cria autorização, não abre o kill switch e não executa retry.</p>
      <a className="text-sm underline" href="/hml/veence">Voltar ao painel HML</a>
      {!ready ? <p>Verificando sessão…</p> : !authenticated ? <p>Você precisa entrar primeiro em <a className="underline" href="/hml/veence">/hml/veence</a>.</p> : <>
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
        <button className="rounded bg-red-700 p-3 font-bold disabled:bg-slate-600" disabled={!executable || busy} onClick={() => void execute()}>{busy ? "Executando — não repetir" : "Executar fluxo multiagente REAL uma vez"}</button>
        {!executable && <p className="text-sm text-amber-200">Execução bloqueada. O gate precisa estar pendente, dentro da validade, com liberação humana registrada, kill switch habilitado e consumo 0/{gate?.maxCalls ?? 0}.</p>}
        {result && <div className="rounded border border-slate-700 p-4"><h2 className="font-bold">Resultado técnico</h2><pre className="mt-2 max-h-[60vh] overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(result, null, 2)}</pre></div>}
      </>}
      {message && <p role="status" className="rounded border border-amber-400 p-3 text-sm">{message}</p>}
    </section>
  </main>;
}
