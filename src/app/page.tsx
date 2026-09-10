"use client";

import { useState } from "react";
import TopMenu from "@/components/TopMenu";
import Dashboard from "@/modules/dashboard/Dashboard";
import Radar from "@/modules/radar/Radar";
import Editais from "@/modules/editais/Editais";
import CFP from "@/modules/cfp/CFP";
import GateEconomico from "@/modules/gates/GateEconomico";
import Disputa from "@/modules/disputa/Disputa";
import Relatorios from "@/modules/relatorios/Relatorios";

export default function Home() {
  const [active, setActive] = useState("Dashboard");

  function renderContent() {
    switch (active) {
      case "Dashboard":
        return <Dashboard onNavigate={setActive} />;
      case "Radar":
        return <Radar />;
      case "Editais":
        return <Editais />;
      case "CFP":
        return <CFP />;
      case "Gate Econômico":
        return <GateEconomico />;
      case "Disputa":
        return <Disputa />;
      case "Relatórios":
        return <Relatorios />;
      default:
        return <Dashboard onNavigate={setActive} />;
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black shadow-lg shadow-blue-950/30">
              U
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">UNI Licitações Web</h1>
              <p className="text-xs text-slate-400">Inteligência para decisões em licitações</p>
            </div>
          </div>

          <div className="flex flex-1 items-center gap-3 lg:max-w-3xl lg:justify-end">
            <label className="relative hidden flex-1 md:block">
              <span className="sr-only">Buscar</span>
              <input
                type="search"
                placeholder="Buscar edital, órgão, processo ou palavra-chave..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <div className="hidden h-8 w-px bg-slate-800 sm:block" />

            <button
              type="button"
              className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-left transition hover:border-slate-700"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">LU</span>
              <span className="hidden sm:block">
                <span className="block text-xs font-semibold text-white">Luvi Empilhadeiras</span>
                <span className="block text-[11px] text-slate-400">Cliente piloto</span>
              </span>
              <span className="text-[10px] text-slate-500">▼</span>
            </button>
          </div>
        </div>
      </header>

      <TopMenu active={active} setActive={setActive} />

      <section className="min-h-[calc(100vh-132px)]">{renderContent()}</section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-2 px-4 py-5 text-xs text-slate-400 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>UNI Licitações Web · Ambiente de desenvolvimento</span>
          <span>Arquitetura SaaS multiempresa</span>
        </div>
      </footer>
    </main>
  );
}
