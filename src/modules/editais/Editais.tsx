"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BackendDashboard, loadCurrentClientDashboard } from "@/lib/dashboard";

type Opportunity = Record<string, unknown>;
type Filters = {
  location: string;
  modality: string;
  category: string;
  buyer: string;
  minValue: string;
  maxValue: string;
  deadlineFrom: string;
  deadlineTo: string;
  source: string;
  analysisStatus: string;
  compatibility: string;
  publicationFrom: string;
  publicationTo: string;
  process: string;
  situation: string;
};

const emptyFilters: Filters = {
  location: "",
  modality: "",
  category: "",
  buyer: "",
  minValue: "",
  maxValue: "",
  deadlineFrom: "",
  deadlineTo: "",
  source: "",
  analysisStatus: "",
  compatibility: "",
  publicationFrom: "",
  publicationTo: "",
  process: "",
  situation: "",
};

function text(value: unknown, fallback = "") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function normalized(value: unknown) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dateValue(value: unknown) {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function money(value: unknown) {
  const n = numberValue(value);
  if (n === null) return "Valor não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function formatDate(value: unknown, withTime = false) {
  const d = dateValue(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(d);
}

function sourceLabel(row: Opportunity) {
  const raw = normalized(row.source_code ?? row.source ?? row.source_name);
  if (raw.includes("pncp")) return "PNCP";
  if (raw.includes("compras")) return "Compras.gov.br";
  if (raw.includes("cptm")) return "CPTM";
  return text(row.source_code ?? row.source ?? row.source_name, "Fonte oficial");
}

function compatibilityLabel(row: Opportunity) {
  const status = normalized(row.match_status ?? row.compatibility ?? row.match_result);
  if (status.includes("filtered") || status.includes("incompat")) return "Incompatível";
  if (status.includes("possible") || status.includes("possivel")) return "Possivelmente compatível";
  if (status.includes("match") || status.includes("queue") || status.includes("analysis")) return "Compatível";
  return "Compatibilidade pendente";
}

function situationLabel(row: Opportunity) {
  const lifecycle = normalized(row.lifecycle ?? row.lifecycle_class ?? row.situation);
  if (lifecycle === "live" || lifecycle.includes("active") || lifecycle.includes("ativa")) return "Ativa";
  if (lifecycle.includes("historic") || lifecycle.includes("encerr")) return "Histórica";
  return text(row.lifecycle ?? row.lifecycle_class ?? row.situation, "Não informada");
}

function analysisLabel(row: Opportunity) {
  const raw = normalized(row.match_status ?? row.analysis_status ?? row.status);
  if (raw.includes("queued") || raw.includes("fila")) return "Em fila";
  if (raw.includes("processing") || raw.includes("analise") || raw.includes("analysis")) return "Em análise";
  if (raw.includes("completed") || raw.includes("conclu")) return "Concluída";
  if (raw.includes("filtered")) return "Não aprovada";
  return "Não iniciada";
}

function includesFilter(value: unknown, filter: string) {
  if (!filter.trim()) return true;
  return normalized(value).includes(normalized(filter));
}

export default function Editais() {
  const [data, setData] = useState<BackendDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  useEffect(() => {
    loadCurrentClientDashboard()
      .then((result) => setData(result))
      .catch(() => setLoadError("Não foi possível carregar os editais do ambiente autenticado."))
      .finally(() => setLoading(false));
  }, []);

  const all = useMemo(() => (data?.opportunities ?? []) as Opportunity[], [data]);
  const unique = (key: keyof Opportunity) => Array.from(new Set(all.map((row) => text(row[key])).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const modalities = useMemo(() => unique("modality"), [all]); // eslint-disable-line react-hooks/exhaustive-deps
  const states = useMemo(() => Array.from(new Set(all.map((row) => text(row.state)).filter(Boolean))).sort(), [all]);
  const buyers = useMemo(() => unique("buyer_name"), [all]); // eslint-disable-line react-hooks/exhaustive-deps
  const sources = useMemo(() => Array.from(new Set(all.map(sourceLabel))).sort(), [all]);

  const results = useMemo(() => {
    const q = normalized(appliedQuery);
    const min = filters.minValue ? Number(filters.minValue) : null;
    const max = filters.maxValue ? Number(filters.maxValue) : null;
    const deadlineFrom = filters.deadlineFrom ? new Date(`${filters.deadlineFrom}T00:00:00`) : null;
    const deadlineTo = filters.deadlineTo ? new Date(`${filters.deadlineTo}T23:59:59`) : null;
    const publicationFrom = filters.publicationFrom ? new Date(`${filters.publicationFrom}T00:00:00`) : null;
    const publicationTo = filters.publicationTo ? new Date(`${filters.publicationTo}T23:59:59`) : null;

    return all.filter((row) => {
      if (q) {
        const haystack = [row.object_text, row.title, row.buyer_name, row.process_number, row.city, row.state, row.modality, row.source_external_id].map(normalized).join(" ");
        if (!haystack.includes(q)) return false;
      }
      if (filters.location && ![row.city, row.state].map(normalized).join(" ").includes(normalized(filters.location))) return false;
      if (filters.modality && normalized(row.modality) !== normalized(filters.modality)) return false;
      if (filters.category && !includesFilter(row.category_name ?? row.category ?? row.object_text, filters.category)) return false;
      if (filters.buyer && !includesFilter(row.buyer_name, filters.buyer)) return false;
      if (filters.process && !includesFilter(row.process_number, filters.process)) return false;
      if (filters.source && normalized(sourceLabel(row)) !== normalized(filters.source)) return false;
      if (filters.analysisStatus && normalized(analysisLabel(row)) !== normalized(filters.analysisStatus)) return false;
      if (filters.compatibility && normalized(compatibilityLabel(row)) !== normalized(filters.compatibility)) return false;
      if (filters.situation && normalized(situationLabel(row)) !== normalized(filters.situation)) return false;

      const value = numberValue(row.estimated_value);
      if (min !== null && (value === null || value < min)) return false;
      if (max !== null && (value === null || value > max)) return false;

      const deadline = dateValue(row.proposal_deadline);
      if (deadlineFrom && (!deadline || deadline < deadlineFrom)) return false;
      if (deadlineTo && (!deadline || deadline > deadlineTo)) return false;
      const publication = dateValue(row.publication_date);
      if (publicationFrom && (!publication || publication < publicationFrom)) return false;
      if (publicationTo && (!publication || publication > publicationTo)) return false;
      return true;
    });
  }, [all, appliedQuery, filters]);

  const summary = useMemo(() => {
    const compatible = all.filter((row) => compatibilityLabel(row) === "Compatível").length;
    const possible = all.filter((row) => compatibilityLabel(row) === "Possivelmente compatível").length;
    const now = Date.now();
    const soon = all.filter((row) => {
      const deadline = dateValue(row.proposal_deadline)?.getTime();
      return deadline ? deadline > now && deadline - now <= 72 * 60 * 60 * 1000 : false;
    }).length;
    const analysis = all.filter((row) => ["Em fila", "Em análise"].includes(analysisLabel(row))).length;
    return { compatible, possible, soon, analysis };
  }, [all]);

  const activeFilterCount = Object.values(filters).filter((value) => value !== "").length;

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setAppliedQuery(query.trim());
  }

  function setDraft<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters() {
    setFilters(draftFilters);
    setFiltersOpen(false);
  }

  function clearFilters() {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setQuery("");
    setAppliedQuery("");
  }

  const helper = appliedQuery ? `Pesquisa aplicada: “${appliedQuery}”` : "O UNI prioriza automaticamente oportunidades compatíveis com o perfil de capacidade da sua empresa.";

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 xl:p-8">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-7 text-center sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Editais personalizados</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Oportunidades compatíveis com sua empresa</h1>
          <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-slate-500">O UNI cruza as fontes oficiais com o perfil de capacidade do CNPJ logado. A busca abaixo serve para explorar e refinar o resultado sem substituir o monitoramento automático.</p>

          <form onSubmit={submitSearch} className="mx-auto mt-6 flex max-w-4xl items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 p-1.5 shadow-sm focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50">
              <span className="pl-3 text-slate-400">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Pesquisar objeto, produto, órgão, processo, UASG ou palavra-chave..." className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none" />
              <button type="submit" className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800">Pesquisar</button>
            </div>
            <button type="button" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen} className={`relative inline-flex h-[50px] shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${filtersOpen ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8"><path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" /></svg>
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-700 px-1 text-[10px] font-bold text-white">{activeFilterCount}</span>}
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-400">{helper}</p>

          {filtersOpen && (
            <div className="mx-auto mt-5 max-w-4xl rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-900">Refinar oportunidades</h2><p className="mt-1 text-xs text-slate-500">Os filtros abaixo atuam sobre as oportunidades reais do cliente.</p></div><button type="button" onClick={() => setFiltersOpen(false)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-white">Fechar</button></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <select value={draftFilters.location} onChange={(e) => setDraft("location", e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><option value="">Estado / município</option>{states.map((v) => <option key={v} value={v}>{v}</option>)}</select>
                <select value={draftFilters.modality} onChange={(e) => setDraft("modality", e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><option value="">Modalidade</option>{modalities.map((v) => <option key={v} value={v}>{v}</option>)}</select>
                <input value={draftFilters.category} onChange={(e) => setDraft("category", e.target.value)} placeholder="Categoria / produto" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" />
                <select value={draftFilters.buyer} onChange={(e) => setDraft("buyer", e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><option value="">Órgão / UASG</option>{buyers.map((v) => <option key={v} value={v}>{v}</option>)}</select>
                <input value={draftFilters.minValue} onChange={(e) => setDraft("minValue", e.target.value)} type="number" min="0" placeholder="Valor mínimo" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" />
                <input value={draftFilters.maxValue} onChange={(e) => setDraft("maxValue", e.target.value)} type="number" min="0" placeholder="Valor máximo" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" />
                <label className="text-xs font-semibold text-slate-500">Prazo de<input value={draftFilters.deadlineFrom} onChange={(e) => setDraft("deadlineFrom", e.target.value)} type="date" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal text-slate-700" /></label>
                <label className="text-xs font-semibold text-slate-500">Prazo até<input value={draftFilters.deadlineTo} onChange={(e) => setDraft("deadlineTo", e.target.value)} type="date" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal text-slate-700" /></label>
                <select value={draftFilters.source} onChange={(e) => setDraft("source", e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><option value="">Fonte oficial</option>{sources.map((v) => <option key={v} value={v}>{v}</option>)}</select>
                <select value={draftFilters.analysisStatus} onChange={(e) => setDraft("analysisStatus", e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><option value="">Status da análise</option>{["Não iniciada", "Em fila", "Em análise", "Concluída", "Não aprovada"].map((v) => <option key={v}>{v}</option>)}</select>
                <select value={draftFilters.compatibility} onChange={(e) => setDraft("compatibility", e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><option value="">Compatibilidade</option>{["Compatível", "Possivelmente compatível", "Incompatível", "Compatibilidade pendente"].map((v) => <option key={v}>{v}</option>)}</select>
                <input value={draftFilters.process} onChange={(e) => setDraft("process", e.target.value)} placeholder="Número do processo" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" />
                <label className="text-xs font-semibold text-slate-500">Publicação de<input value={draftFilters.publicationFrom} onChange={(e) => setDraft("publicationFrom", e.target.value)} type="date" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal text-slate-700" /></label>
                <label className="text-xs font-semibold text-slate-500">Publicação até<input value={draftFilters.publicationTo} onChange={(e) => setDraft("publicationTo", e.target.value)} type="date" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal text-slate-700" /></label>
                <select value={draftFilters.situation} onChange={(e) => setDraft("situation", e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"><option value="">Situação</option><option>Ativa</option><option>Histórica</option></select>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={clearFilters} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Limpar filtros</button><button type="button" onClick={applyFilters} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800">Aplicar filtros</button></div>
            </div>
          )}
        </div>

        <div className="grid gap-4 bg-slate-50/70 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
          {[["Compatíveis com o perfil", summary.compatible, "Priorizadas pelo UNI"], ["Possivelmente compatíveis", summary.possible, "Aguardando validação"], ["Encerrando em breve", summary.soon, "Próximas 72 horas"], ["Em análise", summary.analysis, "Fila ou processamento"]].map(([label, value, caption]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{loading ? "…" : value}</p><p className="mt-1 text-xs text-slate-500">{caption}</p></div>)}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4"><div><h2 className="text-lg font-bold text-slate-950">Editais selecionados para o seu perfil</h2><p className="mt-1 text-sm text-slate-500">{loading ? "Carregando..." : `${results.length} resultado(s) exibido(s)`}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Monitoramento personalizado</span></div>

        {loadError ? <div className="py-10 text-center text-sm text-rose-600">{loadError}</div> : loading ? <div className="py-10 text-center text-sm text-slate-500">Carregando oportunidades...</div> : results.length === 0 ? <div className="py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500">⌕</div><h3 className="mt-4 text-base font-bold text-slate-900">Nenhum edital encontrado</h3><p className="mt-2 text-sm text-slate-500">Ajuste a pesquisa ou limpe os filtros para ampliar os resultados.</p></div> : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {results.map((row, index) => {
              const compatibility = compatibilityLabel(row);
              const source = sourceLabel(row);
              return <article key={text(row.opportunity_id, String(index))} className="rounded-2xl border border-slate-200 p-5 transition hover:border-blue-200 hover:shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-blue-600">{source} · {text(row.modality, "Modalidade não informada")}</p><h3 className="mt-1 line-clamp-2 text-base font-bold text-slate-900">{text(row.object_text ?? row.title, "Objeto não informado")}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${compatibility === "Compatível" ? "bg-emerald-50 text-emerald-700" : compatibility === "Incompatível" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{compatibility}</span></div>
                <p className="mt-3 text-sm font-semibold text-slate-700">{text(row.buyer_name, "Órgão não informado")}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500"><div><span className="block font-semibold text-slate-400">Processo</span>{text(row.process_number, "—")}</div><div><span className="block font-semibold text-slate-400">Local</span>{[text(row.city), text(row.state)].filter(Boolean).join("/") || "—"}</div><div><span className="block font-semibold text-slate-400">Prazo</span>{formatDate(row.proposal_deadline, true)}</div><div><span className="block font-semibold text-slate-400">Valor estimado</span>{money(row.estimated_value)}</div></div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><div className="text-xs text-slate-500">{situationLabel(row)} · {analysisLabel(row)}</div>{row.source_url ? <a href={String(row.source_url)} target="_blank" rel="noreferrer" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">Abrir fonte oficial ↗</a> : <span className="text-xs text-slate-400">Fonte sem link disponível</span>}</div>
              </article>;
            })}
          </div>
        )}
      </section>

      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5"><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Como o UNI seleciona</p><p className="mt-2 text-sm leading-6 text-slate-600">CNPJ → perfil de capacidade → fontes oficiais → deduplicação → compatibilidade → Radar → triagem → análise.</p></div>
    </div>
  );
}
