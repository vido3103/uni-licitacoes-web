"use client";

import { FormEvent, useMemo, useState } from "react";

type RadarAction = "search" | "triage" | "sync_documents" | "analyze" | "refresh";
type RadarCommand = {
  action: RadarAction;
  text: string;
  filters?: Record<string, string>;
};

type Message = { role: "user" | "assistant"; text: string };

type Props = {
  open: boolean;
  onClose: () => void;
  activeModule: string;
  onNavigate: (module: string) => void;
};

function localIso(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseRadarCommand(input: string): RadarCommand {
  const raw = input.trim();
  const value = raw.toLocaleLowerCase("pt-BR");

  if (/triagem|triar|faça a triagem|fazer a triagem/.test(value)) {
    return { action: "triage", text: raw };
  }
  if (/análise detalhada|analise detalhada|enviar.*análise|enviar.*analise|motor ia/.test(value)) {
    return { action: "analyze", text: raw };
  }
  if (/anexo|documento|baixar.*edital|sincronizar/.test(value)) {
    return { action: "sync_documents", text: raw };
  }
  if (/atualizar.*radar|recarregar.*radar/.test(value)) {
    return { action: "refresh", text: raw };
  }

  const now = new Date();
  const filters: Record<string, string> = {};
  const year = raw.match(/\b(20\d{2})\b/)?.[1];
  const lastDays = value.match(/(?:últimos|ultimos)\s+(\d{1,3})\s+dias/)?.[1];

  if (year) {
    filters.publicationStart = `${year}-01-01`;
    filters.publicationEnd = `${year}-12-31`;
  } else if (/este ano|desse ano|deste ano/.test(value)) {
    filters.publicationStart = `${now.getFullYear()}-01-01`;
    filters.publicationEnd = localIso(now);
  } else if (/este mês|este mes|desse mês|desse mes/.test(value)) {
    filters.publicationStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    filters.publicationEnd = localIso(now);
  } else if (lastDays) {
    const start = new Date(now);
    start.setDate(start.getDate() - Math.max(1, Number(lastDays)));
    filters.publicationStart = localIso(start);
    filters.publicationEnd = localIso(now);
  }

  if (/grande sp|grande são paulo|grande sao paulo|estado de são paulo|estado de sao paulo|\bsp\b/.test(value)) {
    filters.state = "SP";
  }
  if (/pncp/.test(value)) filters.source = "pncp";
  if (/compras\.gov|compras gov/.test(value)) filters.source = "compras_gov_br";
  if (/cptm/.test(value)) filters.source = "cptm_portal";

  const query = raw
    .replace(/\b20\d{2}\b/g, "")
    .replace(/(?:últimos|ultimos)\s+\d{1,3}\s+dias/gi, "")
    .replace(/(?:este|desse|deste)\s+(?:ano|mês|mes)/gi, "")
    .replace(/(?:na|no|da|do|de)?\s*(?:grande\s+(?:são|sao)\s+paulo|grande\s+sp|estado\s+de\s+(?:são|sao)\s+paulo)/gi, "")
    .replace(/\b(?:pesquise|pesquisar|procure|procurar|mostre|mostrar|apenas|somente|editais?|oportunidades?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (query) filters.query = query;
  return { action: "search", text: raw, filters };
}

function actionReply(command: RadarCommand) {
  if (command.action === "triage") return "Vou executar a triagem da oportunidade atualmente aberta no Radar.";
  if (command.action === "sync_documents") return "Vou sincronizar os anexos da oportunidade atualmente aberta.";
  if (command.action === "analyze") return "Vou solicitar a Análise Detalhada da oportunidade aberta, respeitando os gates do UNI.";
  if (command.action === "refresh") return "Vou atualizar os dados do Radar.";
  const period = command.filters?.publicationStart
    ? ` Período: ${command.filters.publicationStart} a ${command.filters.publicationEnd || "hoje"}.`
    : "";
  return `Vou pesquisar o Radar com os filtros identificados.${period}`;
}

export default function UniAiPanel({ open, onClose, activeModule, onNavigate }: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Olá! Sou o assistente operacional do UNI. Posso pesquisar o Radar, aplicar período e filtros, executar triagem, sincronizar anexos e solicitar Análise Detalhada.",
    },
  ]);

  const context = useMemo(
    () => (activeModule === "Radar" ? "Contexto atual: Radar de Licitações" : `Contexto atual: ${activeModule}`),
    [activeModule],
  );

  function execute(command: RadarCommand) {
    const payload = JSON.stringify(command);
    sessionStorage.setItem("uni-ai-radar-command", payload);
    if (activeModule !== "Radar") onNavigate("Radar");
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("uni-ai-radar-command", { detail: command }));
    }, activeModule === "Radar" ? 0 : 120);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    const command = parseRadarCommand(value);
    setMessages((current) => [
      ...current,
      { role: "user", text: value },
      { role: "assistant", text: actionReply(command) },
    ]);
    setInput("");
    execute(command);
  }

  if (!open) return null;

  return (
    <aside className="fixed bottom-4 right-4 top-[68px] z-50 flex w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white">IA</span><h2 className="text-sm font-bold text-slate-900">Fale com a IA</h2></div>
          <p className="mt-1 text-[11px] text-slate-500">{context}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar Fale com a IA" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">×</button>
      </div>

      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-[11px] leading-5 text-slate-600">
        <strong>Exemplos:</strong> “editais de 2026 para peças automotivas”, “últimos 30 dias em SP”, “faça a triagem”, “baixe os anexos” ou “envie para análise detalhada”.
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-5 ${message.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="border-t border-slate-100 p-3">
        <div className="flex gap-2">
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Pergunte ou peça uma ação..." className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          <button type="submit" className="rounded-xl bg-blue-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-800">Enviar</button>
        </div>
        <p className="mt-2 text-[10px] text-slate-400">Ações operacionais respeitam os gates e permissões já existentes no UNI.</p>
      </form>
    </aside>
  );
}
