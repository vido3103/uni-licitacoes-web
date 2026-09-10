"use client";

import { useEffect, useMemo, useState } from "react";
import { BackendDashboard, loadCurrentClientDashboard } from "@/lib/dashboard";

type Opportunity = Record<string, unknown>;

function text(value: unknown, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function date(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? text(value) : new Intl.DateTimeFormat("pt-BR").format(d);
}

export default function Radar() {
  const [data, setData] = useState<BackendDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadCurrentClientDashboard()
      .then((result) => {
        setData(result);
        setLoading(false);
      })
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

  return (
    <div className="px-4 py-6 sm:px-6 xl:px-8">
      <div className="mx-auto max-w-[1540px]">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Radar de Licitações</h1>
            <p className="mt-1 text-sm text-slate-500">Oportunidades reais vinculadas ao tenant autenticado.</p>
          </div>
          <div className="w-full lg:max-w-md">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar órgão, processo, objeto, cidade..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-2xl font-bold text-slate-900">{Number(data?.summary?.live_count ?? 0)}</div><div className="text-sm text-slate-500">Oportunidades ativas</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-2xl font-bold text-slate-900">{Number(data?.summary?.historical_count ?? 0)}</div><div className="text-sm text-slate-500">Históricas</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-2xl font-bold text-slate-900">{Number(data?.summary?.released_for_participation_count ?? 0)}</div><div className="text-sm text-slate-500">Liberadas para participação</div></div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-900">Oportunidades</h2>
            <span className="text-xs text-slate-500">{opportunities.length} exibida(s)</span>
          </div>

          {loading ? (
            <div className="p-8 text-sm text-slate-500">Carregando oportunidades...</div>
          ) : error ? (
            <div className="p-8 text-sm text-rose-600">{error}</div>
          ) : opportunities.length === 0 ? (
            <div className="p-8 text-sm text-slate-500">Nenhuma oportunidade encontrada para os filtros atuais.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {["Órgão", "Modalidade", "Processo", "Objeto", "Local", "Publicação", "Prazo", "Valor estimado", "Situação"].map((h) => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {opportunities.map((row, index) => {
                    const lifecycle = text(row.lifecycle_class, "unknown");
                    const released = Boolean(row.participation_allowed ?? row.released_for_participation ?? false);
                    return (
                      <tr key={text(row.id, String(index))} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3 font-semibold text-slate-800">{text(row.buyer_name)}</td>
                        <td className="px-5 py-3 text-slate-600">{text(row.modality)}</td>
                        <td className="px-5 py-3 text-slate-600">{text(row.process_number)}</td>
                        <td className="max-w-[360px] px-5 py-3 text-slate-600"><div className="line-clamp-2">{text(row.object_text ?? row.title)}</div></td>
                        <td className="px-5 py-3 text-slate-600">{[text(row.city, ""), text(row.state, "")].filter(Boolean).join("/") || "—"}</td>
                        <td className="px-5 py-3 text-slate-600">{date(row.publication_date)}</td>
                        <td className="px-5 py-3 text-slate-600">{date(row.proposal_deadline)}</td>
                        <td className="px-5 py-3 text-slate-600">{typeof row.estimated_value === "number" ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(row.estimated_value) : "—"}</td>
                        <td className="px-5 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${released ? "bg-emerald-50 text-emerald-700" : lifecycle === "live" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{released ? "Liberada" : lifecycle === "live" ? "Ativa" : "Histórica"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
