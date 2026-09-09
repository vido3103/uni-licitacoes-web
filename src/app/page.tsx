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
        return <Dashboard />;

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
        return <Dashboard />;
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-white px-8 py-5 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              UNI Licitações Web
            </h1>

            <p className="text-sm text-slate-500">
              Plataforma de Inteligência em Licitações
            </p>
          </div>

          <div className="text-sm text-slate-500">
            Sistema Online
          </div>
        </div>
      </header>

      <TopMenu
        active={active}
        setActive={setActive}
      />

      <section>
        {renderContent()}
      </section>
    </main>
  );
}
