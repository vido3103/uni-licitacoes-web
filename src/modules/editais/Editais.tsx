"use client";

import { useMemo, useState } from "react";

type QuickFilter = "Todos" | "Compatíveis" | "Encerrando" | "Dispensas" | "Em análise";

const quickFilters: QuickFilter[] = ["Todos", "Compatíveis", "Encerrando", "Dispensas", "Em análise"];

export default function Editais() {
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState<QuickFilter>("Compatíveis");

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

          <div className="mx-auto mt-6 flex max-w-3xl items-center rounded-xl border border-slate-200 bg-slate-50 p-1.5 shadow-sm focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50">
            <span className="pl-3 text-slate-400">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Pesquisar objeto, produto, órgão, processo, UASG ou palavra-chave..." className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none" />
            <button type="button" className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800">Pesquisar</button>
          </div>
          <p className="mt-2 text-xs text-slate-400">{helper}</p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {quickFilters.map((filter) => (
              <button key={filter} type="button" onClick={() => setQuick(filter)} className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${quick === filter ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{filter}</button>
            ))}
            <button type="button" className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Filtros avançados</button>
          </div>
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4">
            <div><h2 className="text-lg font-bold text-slate-950">Editais selecionados para o seu perfil</h2><p className="mt-1 text-sm text-slate-500">Filtro atual: <span className="font-semibold text-slate-700">{quick}</span></p></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Monitoramento personalizado</span>
          </div>

          <div className="py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-700">⌕</div>
            <h3 className="mt-4 text-base font-bold text-slate-900">Resultados serão carregados do Radar do cliente</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Esta interface não cria editais fictícios. Na próxima integração, ela consumirá as oportunidades canônicas já deduplicadas e classificadas pelo perfil do CNPJ.</p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">Refinar oportunidades</h3>
            <div className="mt-4 space-y-3 text-sm">
              {["Estado / município", "Modalidade", "Categoria", "Órgão / UASG", "Faixa de valor", "Prazo da proposta", "Fonte oficial", "Status da análise"].map((item) => <button key={item} type="button" className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-left text-slate-600 hover:bg-slate-50"><span>{item}</span><span className="text-slate-300">›</span></button>)}
            </div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Como o UNI seleciona</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">CNPJ → perfil de capacidade → fontes oficiais → deduplicação → compatibilidade → Radar → triagem → análise.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
