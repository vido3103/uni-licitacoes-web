"use client";

import { useState } from "react";
import AuthGate from "@/components/AuthGate";
import Sidebar from "@/components/Sidebar";
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
      case "Dashboard": return <Dashboard onNavigate={setActive} />;
      case "Radar": return <Radar />;
      case "Editais": return <Editais />;
      case "CFP": return <CFP />;
      case "Gate Econômico": return <GateEconomico />;
      case "Disputa": return <Disputa />;
      case "Relatórios": return <Relatorios />;
      default: return <div className="p-8"><h1 className="text-2xl font-bold text-slate-900">{active}</h1><p className="mt-2 text-sm text-slate-500">Módulo preparado para a próxima etapa de integração.</p></div>;
    }
  }

  return (
    <AuthGate>
      <main className="min-h-screen bg-[#f4f8fc] text-slate-900">
        <div className="flex min-h-screen">
          <Sidebar active={active} onNavigate={setActive} />
          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
              <div className="flex h-[76px] items-center gap-4 px-4 sm:px-6 xl:px-8">
                <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm lg:hidden">☰</button>
                <div className="hidden min-w-[260px] lg:block"><p className="text-sm font-semibold text-slate-900">Inteligência em Licitações</p><p className="text-xs text-slate-500">para o seu resultado</p></div>
                <label className="relative mx-auto w-full max-w-[560px]"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span><input type="search" placeholder="Buscar editais, órgãos, processos, palavras-chave..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /></label>
                <button type="button" className="relative hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 sm:flex">♢<span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">3</span></button>
                <div className="hidden h-8 w-px bg-slate-200 sm:block" />
                <button type="button" className="flex shrink-0 items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-slate-50"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">VN</span><span className="hidden xl:block"><span className="block text-sm font-semibold text-slate-900">Ambiente autenticado</span><span className="block text-xs text-slate-500">Cliente ativo</span></span><span className="hidden text-xs text-slate-400 sm:inline">⌄</span></button>
              </div>
            </header>
            <section>{renderContent()}</section>
          </div>
        </div>
      </main>
    </AuthGate>
  );
}
