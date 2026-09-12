"use client";

import { useEffect, useMemo, useState } from "react";
import { loadCurrentClientDashboard, BackendDashboard } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";

type ClientDoc = {
  id: string;
  document_type_id: string;
  version: number;
  is_current: boolean;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
  expiry_date: string | null;
  issuing_body: string | null;
  validation_status: string;
  observations: string | null;
};

type OppDoc = {
  id: string;
  opportunity_id: string;
  original_filename: string;
  validation_status: string;
  uploaded_at: string;
  file_size_bytes: number | null;
  source_kind: string;
};

type DocType = { id: string; code: string; name: string };

function text(v: unknown, f = "—") {
  return v === null || v === undefined || v === "" ? f : String(v);
}

function date(v: unknown) {
  if (!v) return "—";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? text(v) : new Intl.DateTimeFormat("pt-BR").format(d);
}

function err(v: unknown) {
  if (v instanceof Error) return v.message;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return [o.message, o.details, o.hint, o.code].filter(Boolean).map(String).join(" · ") || "Erro não identificado.";
  }
  return String(v);
}

function safeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function statusLabel(status: string) {
  const s = normalized(status || "pending");
  if (["approved", "validated", "valid", "ok"].includes(s)) return "Validado";
  if (["divergent", "invalid", "rejected"].includes(s)) return "Divergente";
  if (["pending_review", "review", "requested", "processing"].includes(s)) return "Em validação";
  return status ? status.replaceAll("_", " ") : "Pendente";
}

function statusClass(status: string) {
  const s = normalized(status || "pending");
  if (["approved", "validated", "valid", "ok"].includes(s)) return "bg-emerald-100 text-emerald-800";
  if (["divergent", "invalid", "rejected"].includes(s)) return "bg-rose-100 text-rose-800";
  if (["pending_review", "review", "requested", "processing"].includes(s)) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export default function Documentos() {
  const [dashboard, setDashboard] = useState<BackendDashboard | null>(null);
  const [clientDocs, setClientDocs] = useState<ClientDoc[]>([]);
  const [oppDocs, setOppDocs] = useState<OppDoc[]>([]);
  const [types, setTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({ typeId: "", expiry_date: "", issuing_body: "", observations: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const d = await loadCurrentClientDashboard();
      if (!d?.client?.id) throw new Error("Tenant não associado.");
      setDashboard(d);

      const [cd, od, dt] = await Promise.all([
        supabase!.from("client_documents").select("id,document_type_id,version,is_current,storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,uploaded_at,expiry_date,issuing_body,validation_status,observations").eq("client_id", d.client.id).order("uploaded_at", { ascending: false }),
        supabase!.from("opportunity_documents").select("id,opportunity_id,original_filename,validation_status,uploaded_at,file_size_bytes,source_kind").eq("client_id", d.client.id).order("uploaded_at", { ascending: false }),
        supabase!.from("document_types").select("id,code,name").order("name"),
      ]);

      if (cd.error || od.error || dt.error) throw cd.error || od.error || dt.error;
      setClientDocs((cd.data ?? []) as ClientDoc[]);
      setOppDocs((od.data ?? []) as OppDoc[]);
      const typed = (dt.data ?? []) as DocType[];
      setTypes(typed);
      if (!form.typeId && typed.length) setForm((v) => ({ ...v, typeId: typed[0].id }));
    } catch (e) {
      setError(err(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleClient = useMemo(
    () => clientDocs.filter((d) => !filter || d.original_filename.toLowerCase().includes(filter.toLowerCase()) || types.find((t) => t.id === d.document_type_id)?.name.toLowerCase().includes(filter.toLowerCase())),
    [clientDocs, types, filter],
  );

  const visibleOpp = useMemo(
    () => oppDocs.filter((d) => !filter || d.original_filename.toLowerCase().includes(filter.toLowerCase())),
    [oppDocs, filter],
  );

  function docType(doc: ClientDoc) {
    return types.find((t) => t.id === doc.document_type_id);
  }

  function isCnpjDocument(doc: ClientDoc) {
    const type = docType(doc);
    const haystack = normalized(`${type?.code ?? ""} ${type?.name ?? ""} ${doc.original_filename}`);
    return haystack.includes("cnpj") || haystack.includes("cartao nacional da pessoa juridica");
  }

  async function upload(file: File | null) {
    if (!file || !supabase || !dashboard?.client?.id || !form.typeId) return;
    setBusy(true);
    setMessage("");
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error("Arquivo acima do limite de 50 MB.");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão não autenticada.");
      const current = clientDocs.filter((d) => d.document_type_id === form.typeId && d.is_current);
      const version = Math.max(0, ...clientDocs.filter((d) => d.document_type_id === form.typeId).map((d) => Number(d.version))) + 1;
      const path = `${dashboard.client.id}/${form.typeId}/${Date.now()}-${safeName(file.name)}`;
      const { error: se } = await supabase.storage.from("client-documents").upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (se) throw se;
      if (current.length) {
        const { error: ue } = await supabase.from("client_documents").update({ is_current: false }).in("id", current.map((d) => d.id));
        if (ue) {
          await supabase.storage.from("client-documents").remove([path]);
          throw ue;
        }
      }
      const { error: ie } = await supabase.from("client_documents").insert({
        client_id: dashboard.client.id,
        document_type_id: form.typeId,
        version,
        is_current: true,
        storage_bucket: "client-documents",
        storage_path: path,
        original_filename: file.name,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        uploaded_by: auth.user.id,
        expiry_date: form.expiry_date || null,
        issuing_body: form.issuing_body || null,
        observations: form.observations || null,
      });
      if (ie) {
        await supabase.storage.from("client-documents").remove([path]);
        throw ie;
      }
      setMessage("Documento enviado e versionado com sucesso.");
      setForm((v) => ({ ...v, expiry_date: "", issuing_body: "", observations: "" }));
      await load();
    } catch (e) {
      setMessage(`Falha no envio: ${err(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function download(doc: ClientDoc) {
    if (!supabase) return;
    const { data, error: e } = await supabase.storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path, 60);
    if (e || !data?.signedUrl) {
      setMessage(`Não foi possível abrir o documento: ${err(e)}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function validateCnpj(doc: ClientDoc) {
    if (!supabase || !dashboard?.client?.id || validatingId) return;
    setValidatingId(doc.id);
    setMessage("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("company-registry-validation-request", {
        body: { client_id: dashboard.client.id, document_id: doc.id },
      });
      if (invokeError || !data?.ok) throw new Error(data?.detail || invokeError?.message || "Não foi possível iniciar a validação do Cartão CNPJ.");
      setMessage("Validação do Cartão CNPJ iniciada. O status foi atualizado para acompanhamento.");
      await load();
    } catch (e) {
      setMessage(`Falha na validação do Cartão CNPJ: ${err(e)}`);
    } finally {
      setValidatingId(null);
    }
  }

  if (loading) return <div className="p-8"><div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Carregando documentos...</div></div>;

  return <div className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Documentos</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Central Documental</h1>
        <p className="mt-2 text-sm text-slate-500">Documentos do cliente e anexos de oportunidades, separados por tenant e com histórico de versões.</p>
      </div>
      <button onClick={() => void load()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold">Atualizar</button>
    </div>

    {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold">Enviar documento do cliente</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <select value={form.typeId} onChange={(e) => setForm((v) => ({ ...v, typeId: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-3 text-sm">{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <input value={form.expiry_date} onChange={(e) => setForm((v) => ({ ...v, expiry_date: e.target.value }))} type="date" className="rounded-xl border border-slate-200 px-3 py-3 text-sm" />
        <input value={form.issuing_body} onChange={(e) => setForm((v) => ({ ...v, issuing_body: e.target.value }))} placeholder="Órgão emissor" className="rounded-xl border border-slate-200 px-3 py-3 text-sm" />
        <input value={form.observations} onChange={(e) => setForm((v) => ({ ...v, observations: e.target.value }))} placeholder="Observações" className="rounded-xl border border-slate-200 px-3 py-3 text-sm" />
      </div>
      <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600 hover:border-blue-300">
        <span>{busy ? "Enviando..." : "Selecionar arquivo para enviar"}</span>
        <input type="file" disabled={busy} onChange={(e) => { const f = e.currentTarget.files?.[0] ?? null; e.currentTarget.value = ""; void upload(f); }} className="hidden" />
      </label>
    </section>

    <div className="mt-5 flex items-center gap-3">
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar documento..." className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
      <span className="text-xs text-slate-500">{clientDocs.length} do cliente · {oppDocs.length} de oportunidades</span>
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold">Documentos do cliente</h2>
        <div className="mt-4 space-y-2">
          {visibleClient.length ? visibleClient.map((d) => {
            const type = docType(d);
            const cnpj = isCnpjDocument(d);
            const validated = ["approved", "validated", "valid", "ok"].includes(normalized(d.validation_status || ""));
            return <div key={d.id} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{d.original_filename}</p>
                <p className="mt-1 text-xs text-slate-500">{type?.name ?? "Documento"} · versão {d.version} · validade {date(d.expiry_date)} · {d.is_current ? "atual" : "substituído"}</p>
                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(d.validation_status)}`}>{statusLabel(d.validation_status)}</span>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => void download(d)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">Abrir</button>
                {cnpj && d.is_current && !validated && <button onClick={() => void validateCnpj(d)} disabled={validatingId === d.id} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{validatingId === d.id ? "Validando..." : "Validar CNPJ"}</button>}
              </div>
            </div>;
          }) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum documento do cliente cadastrado.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold">Anexos de oportunidades</h2>
        <div className="mt-4 space-y-2">
          {visibleOpp.length ? visibleOpp.map((d) => <div key={d.id} className="rounded-xl border border-slate-100 p-3"><p className="truncate text-sm font-semibold">{d.original_filename}</p><p className="mt-1 text-xs text-slate-500">{d.source_kind} · {date(d.uploaded_at)} · {d.validation_status}</p></div>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum anexo de oportunidade encontrado.</p>}
        </div>
      </section>
    </div>

    {message && <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{message}</div>}
  </div>;
}
