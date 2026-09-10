"use client";

import { useEffect, useMemo, useState } from "react";
import { BackendDashboard, loadCurrentClientDashboard } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";

type Opportunity = Record<string, unknown>;
type OpportunityDocument = {
  id: string;
  original_filename: string;
  validation_status: string;
  uploaded_at: string;
  file_size_bytes: number | null;
};
type TriageStage = { stage?: string; result?: string };
type TriageSnapshot = {
  result: string;
  stages: TriageStage[];
  created_at?: string;
  match_status?: string;
  deterministic_score?: number | null;
  deterministic_reasons?: unknown;
  participation_allowed?: boolean;
};
type DocumentSync = {
  status: "idle" | "running" | "complete" | "partial" | "manual_required" | "error";
  found?: number;
  downloaded?: number;
  skipped?: number;
  failed?: number;
  reason?: string;
};

function text(value: unknown, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function date(value: unknown, withTime = false) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return text(value);
  return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(d);
}

function money(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function safeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function opportunityId(opportunity: Opportunity | null) {
  return opportunity?.opportunity_id ? String(opportunity.opportunity_id) : "";
}

function capabilityId(opportunity: Opportunity | null) {
  return opportunity?.capability_id ? String(opportunity.capability_id) : "";
}

function fileMime(file: File) {
  if (file.type) return file.type;
  const n = file.name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".zip")) return "application/zip";
  if (n.endsWith(".doc")) return "application/msword";
  if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (n.endsWith(".xls")) return "application/vnd.ms-excel";
  if (n.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "";
}

function stageLabel(stage?: string) {
  if (stage === "operational_prefilter") return "Filtro operacional";
  if (stage === "capability_match") return "Compatibilidade com o perfil";
  return stage || "Etapa";
}

function resultLabel(result?: string) {
  if (result === "queued_for_ai") return "APROVADO PARA ANÁLISE";
  if (result === "filtered_out") return "NÃO APROVADO NA TRIAGEM";
  if (result === "matched") return "COMPATÍVEL";
  if (result === "not_filtered") return "APROVADO";
  return text(result, "EM ANÁLISE").replaceAll("_", " ").toUpperCase();
}

function prettyReasons(value: unknown) {
  if (!value) return "Nenhuma justificativa adicional registrada.";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => typeof v === "string" ? v : JSON.stringify(v)).join(" · ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join(" · ");
  return String(value);
}

export default function Radar() {
  const [data, setData] = useState<BackendDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [documents, setDocuments] = useState<OpportunityDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [triageBusy, setTriageBusy] = useState(false);
  const [triage, setTriage] = useState<TriageSnapshot | null>(null);
  const [triageError, setTriageError] = useState("");
  const [documentSync, setDocumentSync] = useState<DocumentSync>({ status: "idle" });
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [analysisQueued, setAnalysisQueued] = useState(false);

  async function refreshDashboard() {
    const result = await loadCurrentClientDashboard();
    setData(result);
    return result;
  }

  useEffect(() => {
    refreshDashboard()
      .then(() => setLoading(false))
      .catch(() => {
        setError("Não foi possível carregar as oportunidades do seu ambiente.");
        setLoading(false);
      });
  }, []);

  const opportunities = useMemo(() => {
    const rows = (data?.opportunities ?? []) as Opportunity[];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.buyer_name, row.modality, row.process_number, row.title, row.object_text, row.city, row.state]
        .map((v) => text(v, "").toLowerCase())
        .some((v) => v.includes(q)),
    );
  }, [data, query]);

  async function loadDocuments(opportunity: Opportunity) {
    const oid = opportunityId(opportunity);
    if (!supabase || !data?.client?.id || !oid) return;
    setDocsLoading(true);
    const { data: rows, error: docsError } = await supabase
      .from("opportunity_documents")
      .select("id, original_filename, validation_status, uploaded_at, file_size_bytes")
      .eq("client_id", data.client.id)
      .eq("opportunity_id", oid)
      .order("uploaded_at", { ascending: false });
    if (docsError) setUploadMessage(`Não foi possível consultar os anexos: ${docsError.message}`);
    setDocuments((rows ?? []) as OpportunityDocument[]);
    setDocsLoading(false);
  }

  async function runTriage(opportunity: Opportunity) {
    if (!supabase) return;
    const oid = opportunityId(opportunity);
    const cid = capabilityId(opportunity);
    if (!oid || !cid) {
      setTriageError("A oportunidade ainda não possui os identificadores necessários para executar a triagem.");
      return;
    }
    setTriageBusy(true);
    setTriageError("");
    try {
      const { data: result, error: runError } = await supabase.rpc("run_deterministic_triage", {
        p_capability_id: cid,
        p_opportunity_id: oid,
      });
      if (runError) throw runError;

      const [runResponse, matchResponse] = await Promise.all([
        supabase.from("opportunity_triage_runs").select("result,stages,created_at").eq("capability_id", cid).eq("opportunity_id", oid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("client_opportunity_matches").select("match_status,deterministic_score,deterministic_reasons,participation_allowed").eq("capability_id", cid).eq("opportunity_id", oid).limit(1).maybeSingle(),
      ]);
      if (runResponse.error) throw runResponse.error;
      if (matchResponse.error) throw matchResponse.error;
      const run = runResponse.data as { result?: string; stages?: TriageStage[]; created_at?: string } | null;
      const match = matchResponse.data as { match_status?: string; deterministic_score?: number | null; deterministic_reasons?: unknown; participation_allowed?: boolean } | null;
      setTriage({
        result: String(run?.result ?? result ?? "unknown"),
        stages: Array.isArray(run?.stages) ? run!.stages! : [],
        created_at: run?.created_at,
        match_status: match?.match_status,
        deterministic_score: match?.deterministic_score ?? null,
        deterministic_reasons: match?.deterministic_reasons,
        participation_allowed: match?.participation_allowed,
      });
      await refreshDashboard();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTriageError(`A triagem não pôde ser concluída: ${msg}`);
    } finally {
      setTriageBusy(false);
    }
  }

  async function syncPncpDocuments(opportunity: Opportunity) {
    if (!supabase || !data?.client?.id) return;
    const oid = opportunityId(opportunity);
    if (!oid) return;
    setDocumentSync({ status: "running" });
    try {
      const { data: result, error: syncError } = await supabase.functions.invoke("opportunity-document-sync", {
        body: { client_id: data.client.id, opportunity_id: oid },
      });
      if (syncError) throw syncError;
      const status = result?.status === "complete" || result?.status === "partial" || result?.status === "manual_required" ? result.status : "error";
      setDocumentSync({
        status,
        found: Number(result?.found ?? 0),
        downloaded: Number(result?.downloaded ?? 0),
        skipped: Number(result?.skipped ?? 0),
        failed: Number(result?.failed ?? 0),
        reason: result?.reason ? String(result.reason) : undefined,
      });
      await loadDocuments(opportunity);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDocumentSync({ status: "error", reason: msg });
      await loadDocuments(opportunity);
    }
  }

  function openOpportunity(opportunity: Opportunity) {
    setSelected(opportunity);
    setDocuments([]);
    setUploadMessage("");
    setAnalysisMessage("");
    setAnalysisQueued(false);
    setTriage(null);
    setTriageError("");
    setDocumentSync({ status: "idle" });
    void Promise.all([runTriage(opportunity), syncPncpDocuments(opportunity)]);
  }

  async function uploadFiles(files: FileList | null) {
    const oid = opportunityId(selected);
    if (!files?.length || !supabase || !data?.client?.id || !selected || !oid) return;
    setUploading(true);
    setUploadMessage("");

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão não autenticada.");

      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name}: o arquivo excede o limite de 50 MB.`);
        const mime = fileMime(file);
        if (!mime) throw new Error(`${file.name}: formato não permitido.`);
        const path = `${data.client.id}/${oid}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName(file.name)}`;
        const { error: storageError } = await supabase.storage
          .from("opportunity-documents")
          .upload(path, file, { upsert: false, contentType: mime });
        if (storageError) throw new Error(`Falha no armazenamento de ${file.name}: ${storageError.message}`);

        const { error: dbError } = await supabase.from("opportunity_documents").insert({
          client_id: data.client.id,
          opportunity_id: oid,
          storage_bucket: "opportunity-documents",
          storage_path: path,
          original_filename: file.name,
          mime_type: mime,
          file_size_bytes: file.size,
          source_kind: "user_upload",
          validation_status: "available",
          uploaded_by: auth.user.id,
          metadata: { origin: "pncp_fallback_manual_upload" },
        });
        if (dbError) {
          await supabase.storage.from("opportunity-documents").remove([path]);
          throw new Error(`Falha ao registrar ${file.name}: ${dbError.message}`);
        }
      }

      setUploadMessage("Arquivo(s) anexado(s) com sucesso e disponíveis para complementar a análise.");
      await loadDocuments(selected);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadMessage(msg);
    } finally {
      setUploading(false);
    }
  }

  async function startDetailedAnalysis() {
    if (!supabase || !selected) return;
    const oid = opportunityId(selected);
    const cid = capabilityId(selected);
    if (!oid || !cid) {
      setAnalysisMessage("A oportunidade não possui identidade operacional suficiente para iniciar a análise.");
      return;
    }
    if (documents.length === 0) {
      setAnalysisMessage("Nenhum documento está disponível. Use a contingência e anexe o edital/TR antes de continuar.");
      return;
    }
    if (triage?.result === "filtered_out") {
      setAnalysisMessage("Esta oportunidade foi NÃO APROVADA na triagem preliminar e não será enviada à análise detalhada.");
      return;
    }

    setAnalysisBusy(true);
    setAnalysisMessage("Enviando a oportunidade e seus documentos para a fila do Agente...");
    try {
      if (!triage || triage.result !== "queued_for_ai") await runTriage(selected);
      const { data: queueId, error: queueError } = await supabase.rpc("enqueue_opportunity_ai_analysis", {
        p_capability_id: cid,
        p_opportunity_id: oid,
        p_prompt_master_version: "Prompt Mestre v1.17",
      });
      if (queueError) throw queueError;
      setAnalysisQueued(true);
      setAnalysisMessage(`Análise detalhada solicitada. Execução ${String(queueId).slice(0, 8)}… registrada com o Prompt Mestre v1.17.`);
      await refreshDashboard();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAnalysisQueued(false);
      setAnalysisMessage(`Não foi possível iniciar a análise detalhada: ${msg}`);
    } finally {
      setAnalysisBusy(false);
    }
  }

  const syncMessage = documentSync.status === "running"
    ? "Tentando localizar e baixar os documentos oficiais no PNCP..."
    : documentSync.status === "complete"
      ? `Download automático concluído. ${documentSync.downloaded ?? 0} novo(s) arquivo(s) obtido(s) e ${documentSync.skipped ?? 0} já existente(s).`
      : documentSync.status === "partial"
        ? `Download automático parcial: ${documentSync.downloaded ?? 0} obtido(s), ${documentSync.failed ?? 0} falha(s). Use o upload manual para completar o conjunto.`
        : documentSync.status === "manual_required"
          ? "O PNCP foi consultado, mas os anexos não puderam ser obtidos automaticamente. Baixe-os pelo link oficial e envie no campo de anexos."
          : documentSync.status === "error"
            ? "A tentativa automática falhou. A contingência manual está disponível abaixo."
            : "A tentativa automática será feita ao abrir a oportunidade.";

  return (
    <div className="px-4 py-6 sm:px-6 xl:px-8">
      <div className="mx-auto max-w-[1540px]">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Radar de Licitações</h1>
            <p className="mt-1 text-sm text-slate-500">Oportunidades reais vinculadas ao ambiente autenticado.</p>
          </div>
          <div className="w-full lg:max-w-md">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar órgão, processo, objeto, cidade..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
          </div>
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-2xl font-bold text-slate-900">{Number(data?.summary?.live_count ?? 0)}</div><div className="text-sm text-slate-500">Oportunidades ativas</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-2xl font-bold text-slate-900">{Number(data?.summary?.historical_count ?? 0)}</div><div className="text-sm text-slate-500">Históricas</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-2xl font-bold text-slate-900">{Number(data?.summary?.released_for_participation_count ?? 0)}</div><div className="text-sm text-slate-500">Liberadas para participação</div></div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Oportunidades</h2><span className="text-xs text-slate-500">{opportunities.length} exibida(s)</span></div>
          {loading ? <div className="p-8 text-sm text-slate-500">Carregando oportunidades...</div> : error ? <div className="p-8 text-sm text-rose-600">{error}</div> : opportunities.length === 0 ? <div className="p-8 text-sm text-slate-500">Nenhuma oportunidade encontrada para os filtros atuais.</div> : (
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500"><tr>{["Órgão", "Modalidade", "Processo", "Objeto", "Local", "Publicação", "Prazo", "Valor estimado", "Situação", "Ação"].map((h) => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {opportunities.map((row, index) => {
                    const lifecycle = text(row.lifecycle, "unknown");
                    const released = Boolean(row.participation_allowed ?? false);
                    return (
                      <tr key={text(row.opportunity_id, String(index))} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3 font-semibold text-slate-800">{text(row.buyer_name)}</td>
                        <td className="px-5 py-3 text-slate-600">{text(row.modality)}</td>
                        <td className="px-5 py-3 text-slate-600">{text(row.process_number)}</td>
                        <td className="max-w-[360px] px-5 py-3 text-slate-600"><div className="line-clamp-2">{text(row.object_text ?? row.title)}</div></td>
                        <td className="px-5 py-3 text-slate-600">{[text(row.city, ""), text(row.state, "")].filter(Boolean).join("/") || "—"}</td>
                        <td className="px-5 py-3 text-slate-600">{date(row.publication_date)}</td>
                        <td className="px-5 py-3 text-slate-600">{date(row.proposal_deadline, true)}</td>
                        <td className="px-5 py-3 text-slate-600">{money(row.estimated_value)}</td>
                        <td className="px-5 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${released ? "bg-emerald-50 text-emerald-700" : lifecycle === "live" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{released ? "Liberada" : lifecycle === "live" ? "Ativa" : "Histórica"}</span></td>
                        <td className="px-5 py-3"><button type="button" onClick={() => openOpportunity(row)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-100">Abrir</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selected && (
          <section className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Triagem preliminar da oportunidade</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{text(selected.buyer_name)} · {text(selected.process_number)}</h2>
                  <p className="mt-2 max-w-5xl text-sm text-slate-600">{text(selected.object_text ?? selected.title)}</p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Fechar</button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase text-slate-400">Modalidade</p><p className="mt-1 text-sm font-semibold text-slate-800">{text(selected.modality)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase text-slate-400">Local</p><p className="mt-1 text-sm font-semibold text-slate-800">{[text(selected.city, ""), text(selected.state, "")].filter(Boolean).join("/") || "—"}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase text-slate-400">Prazo da proposta</p><p className="mt-1 text-sm font-semibold text-slate-800">{date(selected.proposal_deadline, true)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase text-slate-400">Valor estimado</p><p className="mt-1 text-sm font-semibold text-slate-800">{money(selected.estimated_value)}</p></div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="font-bold text-slate-900">Resultado da triagem</h3><p className="text-xs text-slate-500">Executada automaticamente ao abrir a oportunidade.</p></div>
                  {triageBusy ? <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">TRIANDO...</span> : triage ? <span className={`rounded-lg px-3 py-2 text-xs font-bold ${triage.result === "filtered_out" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{resultLabel(triage.result)}</span> : null}
                </div>
                {triageError && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{triageError}</div>}
                {triage && (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                    <div className="space-y-2 text-sm text-slate-600">
                      <p><strong className="text-slate-800">Status operacional:</strong> {resultLabel(triage.result)}</p>
                      <p><strong className="text-slate-800">Match atual:</strong> {resultLabel(triage.match_status)}</p>
                      <p><strong className="text-slate-800">Score determinístico:</strong> {triage.deterministic_score ?? "—"}</p>
                      <p><strong className="text-slate-800">Participação liberada:</strong> {triage.participation_allowed ? "Sim" : "Não"}</p>
                      <p><strong className="text-slate-800">Execução:</strong> {date(triage.created_at, true)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Etapas e fundamentos</p>
                      <div className="mt-2 space-y-2">
                        {triage.stages.map((stage, idx) => <div key={`${stage.stage}-${idx}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="font-semibold text-slate-700">{stageLabel(stage.stage)}</span><span className="font-bold text-slate-600">{resultLabel(stage.result)}</span></div>)}
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><strong>Justificativas do matching:</strong> {prettyReasons(triage.deterministic_reasons)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-900">Fonte oficial</h3>
                <p className="mt-2 text-sm text-slate-600">Ao abrir a oportunidade, o sistema também tenta localizar e baixar automaticamente os arquivos publicados no PNCP.</p>
                <div className={`mt-4 rounded-lg border p-3 text-xs ${documentSync.status === "complete" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : documentSync.status === "running" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                  <strong>Download automático:</strong> {syncMessage}
                  {documentSync.reason && <div className="mt-1 opacity-75">Diagnóstico: {documentSync.reason}</div>}
                </div>
                {selected.source_url ? <a href={String(selected.source_url)} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Abrir edital no PNCP ↗</a> : <p className="mt-4 text-sm font-semibold text-amber-700">Link oficial não disponível nesta oportunidade.</p>}
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><strong>Contingência permanente:</strong> falha no download automático não encerra a análise. O edital permanece acessível pela fonte oficial e pode ser anexado manualmente ao lado.</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-900">Anexos do edital</h3>
                <p className="mt-1 text-sm text-slate-500">PDF, ZIP, DOC/DOCX ou XLS/XLSX. Limite de 50 MB por arquivo.</p>
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center hover:border-blue-300 hover:bg-blue-50/40">
                  <span className="text-sm font-semibold text-slate-700">{uploading ? "Enviando arquivos..." : "Clique para anexar os arquivos baixados do PNCP"}</span>
                  <span className="mt-1 text-xs text-slate-400">Os arquivos ficam protegidos no ambiente do cliente e vinculados a esta oportunidade.</span>
                  <input type="file" multiple disabled={uploading} accept=".pdf,.zip,.doc,.docx,.xls,.xlsx,application/pdf,application/zip" onChange={(e) => { void uploadFiles(e.target.files); e.currentTarget.value = ""; }} className="hidden" />
                </label>
                {uploadMessage && <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-700">{uploadMessage}</div>}

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Arquivos disponíveis</span><span className="text-xs text-slate-400">{documents.length}</span></div>
                  {docsLoading ? <p className="text-sm text-slate-500">Consultando anexos...</p> : documents.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Nenhum anexo disponível ainda. Se a tentativa automática falhou, utilize o campo acima.</p> : (
                    <div className="space-y-2">{documents.map((doc) => <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-700">{doc.original_filename}</p><p className="text-[11px] text-slate-400">{date(doc.uploaded_at, true)} · {doc.file_size_bytes ? `${(doc.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : "tamanho não informado"}</p></div><span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">DISPONÍVEL</span></div>)}</div>
                  )}
                </div>

                <button type="button" onClick={() => void startDetailedAnalysis()} disabled={documents.length === 0 || analysisBusy || triageBusy || triage?.result === "filtered_out"} className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{analysisBusy ? "Preparando análise..." : triage?.result === "filtered_out" ? "Oportunidade não aprovada na triagem" : documents.length > 0 ? "Iniciar / complementar Análise Detalhada" : "Aguardando documentos do edital"}</button>
                {analysisMessage && <div className={`mt-3 rounded-lg border p-3 text-xs ${analysisQueued ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>{analysisMessage}</div>}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
