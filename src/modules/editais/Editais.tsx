"use client";

import { useMemo, useState } from "react";

export default function Editais() {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const helper = useMemo(() => {
    if (query.trim()) return `Pesquisa complementar: “${query.trim()}”`;
    return "O UNI prioriza automaticamente oportunidades compatíveis com o perfil de capacidade da sua empresa.";
  }, [query]);

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 xl:p-8">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-7 text-center sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Editais personalizados</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Oportunidades compatíveis com sua empresa</h1>
          <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-slate-500">O UNI cruza as fontes oficiais com o perfil de capacidade do CNPJ logado. A busca abaixo serve para explorar e refinar o resultado sem substituir o monitoramento automático.</p>

          <div className="mx-auto mt-6 flex max-w-4xl items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 p-1.5 shadow-sm focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50">
              <span className="pl-3 text-slate-400">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Pesquisar objeto, produto, órgão, processo, UASG ou palavra-chave..." className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none" />
              <button type="button" className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800">Pesquisar</button>
            </div>
            <button type="button" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen} className={`inline-flex h-[50px] shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${filtersOpen ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8"><path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" /></svg>
              <span className="hidden sm:inline">Filtros</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">{helper}</p>

          {filtersOpen && (
            <div className="mx-auto mt-5 max-w-4xl rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="text-sm font-bold text-slate-900">Refinar oportunidades</h2><p className="mt-1 text-xs text-slate-500">Use os filtros apenas para aprofundar a pesquisa personalizada do UNI.</p></div>
                <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-white">Fechar</button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {["Estado / município", "Modalidade", "Categoria", "Órgão / UASG", "Faixa de valor", "Prazo da proposta", "Fonte oficial", "Status da análise", "Compatibilidade", "Publicação", "Processo", "Situação"].map((item) => (
                  <button key={item} type="button" className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50/40"><span>{item}</span><span className="text-slate-300">›</span></button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Limpar filtros</button>
                <button type="button" className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800">Aplicar filtros</button>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 bg-slate-50/70 p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
          {[
            ["Compatíveis com o perfil", "—", "Priorizadas pelo UNI"],
            ["Possivelmente compatíveis", "—", "Aguardando validação"],
            ["Encerrando em breve", "—", "Prioridade por prazo"],
            ["Em análise", "—", "Triagem ou análise detalhada"],
          ].map(([label, value, caption]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{caption}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4">
          <div><h2 className="text-lg font-bold text-slate-950">Editais selecionados para o seu perfil</h2><p className="mt-1 text-sm text-slate-500">Resultados personalizados para o CNPJ logado.</p></div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Monitoramento personalizado</span>
        </div>

        <div className="py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-700">⌕</div>
          <h3 className="mt-4 text-base font-bold text-slate-900">Resultados serão carregados do Radar do cliente</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Esta interface não cria editais fictícios. Na próxima integração, ela consumirá as oportunidades canônicas já deduplicadas e classificadas pelo perfil do CNPJ.</p>
        </div>
      </section>

      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Como o UNI seleciona</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">CNPJ → perfil de capacidade → fontes oficiais → deduplicação → compatibilidade → Radar → triagem → análise.</p>
      </div>
    </div>
  );
}
