"use client";

import { useState } from "react";

interface TopMenuProps {
  active: string;
  setActive: (menu: string) => void;
}

const groups = [
  { label: "Dashboard", value: "Dashboard" },
  { label: "Oportunidades", children: ["Radar", "Editais"] },
  { label: "Viabilidade", children: ["CFP", "Gate Econômico"] },
  { label: "Disputa", value: "Disputa" },
  { label: "Relatórios", value: "Relatórios" },
];

export default function TopMenu({ active, setActive }: TopMenuProps) {
  const [open, setOpen] = useState<string | null>(null);

  const activate = (value: string) => {
    setActive(value);
    setOpen(null);
  };

  return (
    <nav className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center gap-1 overflow-visible px-4 py-2 sm:px-6 lg:px-8">
        {groups.map((group) => {
          const childActive = group.children?.includes(active) ?? false;
          const isActive = group.value === active || childActive;

          if (group.children) {
            return (
              <div key={group.label} className="relative">
                <button
                  type="button"
                  onClick={() => setOpen(open === group.label ? null : group.label)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4 ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  {group.label}
                  <span className={`text-[10px] transition ${open === group.label ? "rotate-180" : ""}`}>▼</span>
                </button>

                {open === group.label && (
                  <div className="absolute left-0 top-full z-50 mt-2 min-w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    {group.children.map((item) => (
                      <button
                        type="button"
                        key={item}
                        onClick={() => activate(item)}
                        className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                          active === item
                            ? "bg-blue-50 font-semibold text-blue-700"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {item === "Radar" && "Radar de Licitações"}
                        {item === "Editais" && "Análise de Editais"}
                        {item === "CFP" && "CFP — Cotações e Fornecedores"}
                        {item === "Gate Econômico" && "Gate Econômico"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              type="button"
              key={group.label}
              onClick={() => activate(group.value!)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4 ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              {group.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
