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

function text(value: unknown, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function date(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? text(value) : new Intl.DateTimeFormat("pt-BR").format(d);
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
    setUploadMessage("");
    const { data: rows, error: docsError } = await supabase
      .from("opportunity_documents")
      .select("id, original_filename, validation_status, uploaded_at, file_size_bytes")
      .eq("client_id", data.client.id)
      .eq("opportunity_id", oid)
      .order("uploaded_at", { ascending: false });
    if (docsError) setUploadMessage("Não foi possível consultar os anexos desta oportunidade.");
    setDocuments((rows ?? []) as OpportunityDocument[]);
    setDocsLoading(false);
  }

  function openOpportunity(opportunity: Opportunity) {
    setSelected(opportunity);
    setDocuments([]);
    setAnalysisMessage("");
    setAnalysisQueued(false);
    void loadDocuments(opportunity);
  }

  async function uploadFiles(files: FileList | null) {
    const oid = opportunityId(selected);
    if (!files?.length || !supabase || !data?.client?.id || !selected || !oid) return;
    setUploading(true);
    setUploadMessage("");

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão não autenticada.");

      for (const file of Array.from(files)) {
        const path = `${data.client.id}/${oid}/${Date.now()}-${safeName(file.name)}`;
        const { error: storageError } = await supabase.storage
          .from("opportunity-documents")
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (storageError) throw storageError;

        const { error: dbError } = await supabase.from("opportunity_documents").insert({
          client_id: data.client.id,
          opportunity_id: oid,
          storage_bucket: "opportunity-documents",
          storage_path: path,
          original_filename: file.name,
          mime_type: file.type || null,
          file_size_bytes: file.size,
          source_kind: "user_upload",
          validation_status: "available",
          uploaded_by: auth.user.id,
          metadata: { origin: "pncp_fallback_manual_upload" },
        });
        if (dbError) {
          await supabase.storage.from("opportunity-documents").remove([path]);
          throw dbError;
        }
      }

      setUploadMessage("Arquivo(s) anexado(s). A análise pode usar estes documentos como complemento do edital.");
      await loadDocuments(selected);
    } catch {
      setUploadMessage("Falha ao anexar o arquivo. Nenhum documento incompleto foi mantido.");
    } finally {
      setUploading(false);
    }
  }

  async function startDetailedAnalysis() {
    if (!supabase || !selected) return;
    const oid = opportunityId(selected);
    const capabilityId = selected.capability_id ? String(selected.capability_id) : "";
    if (!oid || !capabilityId) {
      setAnalysisMessage("A oportunidade não possui identidade operacional suficiente para iniciar a análise.");
      return;
    }
    if (documents.length === 0) {
      setAnalysisMessage("Anexe ao menos um documento do edital antes de iniciar a análise detalhada.");
      return;
    }

    setAnalysisBusy(true);
    setAnalysisMessage("Executando a triagem determinística...");
    try {
      const { data: triage, error: triageError } = await supabase.rpc("run_deterministic_triage", {
        p_capability_id: capabilityId,
        p_opportunity_id: oid,
      });
      if (triageError) throw triageError;

      if (triage === "filtered_out") {
        setAnalysisMessage("A triagem determinística filtrou esta oportunidade. Ela não foi enviada ao agente de análise detalhada.");
        setAnalysisQueued(false);
        await refreshDashboard();
        return;
      }

      setAnalysisMessage("Triagem concluída. Enviando oportunidade para o Agente...");
      const { data: queueId, error: queueError } = await supabase.rpc("enqueue_opportunity_ai_analysis", {
        p_capability_id: capabilityId,
        p_opportunity_id: oid,
        p_prompt_master_version: "Prompt Mestre v1.17",
      });
      if (queueError) throw queueError;

      setAnalysisQueued(true);
      setAnalysisMessage(`Análise detalhada solicitada com sucesso. Fila operacional ${String(queueId).slice(0, 8)}… criada e vinculada ao Prompt Mestre v1.17.`);
      await refreshDashboard();
    } catch (err) {
      const message = err instanceof Error ? err.message : "erro não identificado";
      setAnalysisQueued(false);
      setAnalysisMessage(`Não foi possível iniciar a análise detalhada: ${message}`);
    } finally {
      setAnalysisBusy(false);
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 xl:px-8">
      <div className="mx-auto max-w-[1540px]">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Radar de Licitações</h1>
            <p className="mt-1 text-sm text-slate-500">Oportunidades reais vinculadas ao tenant autenticado.</p>
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
                        <td className="px-5 py-3 font-semibold text-slate-800">{text(row.buyer_name)}</td><td className="px-5 py-3 text-slate-600">{text(row.modality)}</td><td className="px-5 py-3 text-slate-600">{text(row.process_number)}</td><td className="max-w-[360px] px-5 py-3 text-slate-600"><div className="line-clamp-2">{text(row.object_text ?? row.title)}</div></td><td className="px-5 py-3 text-slate-600">{[text(row.city, ""), text(row.state, "")].filter(Boolean).join("/") || "—"}</td><td className="px-5 py-3 text-slate-600">{date(row.publication_date)}</td><td className="px-5 py-3 text-slate-600">{date(row.proposal_deadline)}</td><td className="px-5 py-3 text-slate-600">{money(row.estimated_value)}</td><td className="px-5 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${released ? "bg-emerald-50 text-emerald-700" : lifecycle === "live" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{released ? "Liberada" : lifecycle === "live" ? "Ativa" : "Histórica"}</span></td>
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
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Oportunidade selecionada</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{text(selected.buyer_name)} · {text(selected.process_number)}</h2>
                <p className="mt-2 max-w-4xl text-sm text-slate-600">{text(selected.object_text ?? selected.title)}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Fechar</button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-bold text-slate-900">Fonte oficial</h3>
                <p className="mt-2 text-sm text-slate-600">O agente tenta obter os anexos automaticamente. Se o PNCP bloquear ou falhar no download, use o link oficial abaixo, baixe os documentos e anexe-os no campo ao lado.</p>
                {selected.source_url ? <a href={String(selected.source_url)} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Abrir edital no PNCP ↗</a> : <p className="mt-4 text-sm font-semibold text-amber-700">Link oficial não disponível nesta oportunidade.</p>}
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><strong>Contingência:</strong> a falta do download automático não interrompe a triagem. O processo fica aguardando o anexo manual e continua assim que o documento for disponibilizado.</div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900">Anexos do edital</h3>
                <p className="mt-1 text-sm text-slate-500">PDF, ZIP, DOC/DOCX ou XLS/XLSX. Limite de 50 MB por arquivo.</p>
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center hover:border-blue-300 hover:bg-blue-50/40">
                  <span className="text-sm font-semibold text-slate-700">{uploading ? "Enviando arquivos..." : "Clique para anexar os arquivos baixados do PNCP"}</span>
                  <span className="mt-1 text-xs text-slate-400">O arquivo fica protegido no ambiente do cliente.</span>
                  <input type="file" multiple disabled={uploading} accept=".pdf,.zip,.doc,.docx,.xls,.xlsx,application/pdf,application/zip" onChange={(e) => { void uploadFiles(e.target.files); e.currentTarget.value = ""; }} className="hidden" />
                </label>

                {uploadMessage && <p className="mt-3 text-xs font-medium text-slate-600">{uploadMessage}</p>}

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Arquivos disponíveis</span><span className="text-xs text-slate-400">{documents.length}</span></div>
                  {docsLoading ? <p className="text-sm text-slate-500">Consultando anexos...</p> : documents.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Nenhum anexo foi associado ainda.</p> : (
                    <div className="space-y-2">{documents.map((doc) => <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-700">{doc.original_filename}</p><p className="text-[11px] text-slate-400">Anexado em {date(doc.uploaded_at)} · {doc.validation_status === "available" ? "disponível para análise" : doc.validation_status}</p></div><span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">ANEXADO</span></div>)}</div>
                  )}
                </div>

                <button type="button" onClick={() => void startDetailedAnalysis()} disabled={documents.length === 0 || analysisBusy} className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{analysisBusy ? "Preparando análise..." : documents.length > 0 ? "Iniciar / complementar Análise Detalhada" : "Anexe ao menos um documento para continuar"}</button>
                {analysisMessage && <div className={`mt-3 rounded-lg border p-3 text-xs ${analysisQueued ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>{analysisMessage}</div>}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
