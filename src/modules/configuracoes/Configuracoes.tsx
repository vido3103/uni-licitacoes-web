"use client";

import { useEffect, useState } from "react";
import {
  loadCurrentClientDashboard,
  type BackendDashboard,
} from "@/lib/dashboard";

type Theme = "light" | "dark" | "system";
const card = "rounded-xl border border-[#dbe7f2] bg-white shadow-sm";
function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = theme;
  return dark ? "Escuro" : "Claro";
}

export default function Configuracoes() {
  const [data, setData] = useState<BackendDashboard | null>(null),
    [theme, setTheme] = useState<Theme>("light"),
    [resolved, setResolved] = useState("Claro"),
    [message, setMessage] = useState("");
  useEffect(() => {
    const stored = localStorage.getItem("uni-theme");
    const initial: Theme =
      stored === "dark" || stored === "system" ? stored : "light";
    setTheme(initial);
    setResolved(applyTheme(initial));
    void loadCurrentClientDashboard()
      .then(setData)
      .catch(() => setData(null));
  }, []);
  function change(next: Theme) {
    localStorage.setItem("uni-theme", next);
    setTheme(next);
    setResolved(applyTheme(next));
    setMessage(
      `Tema ${next === "system" ? "automático" : next === "dark" ? "escuro" : "claro"} ativado.`,
    );
    window.dispatchEvent(new CustomEvent("uni-theme-change", { detail: next }));
  }
  return (
    <main className="mx-auto max-w-[1200px] p-5 text-[#08245c]">
      <div>
        <h1 className="text-[26px] font-black">Configurações</h1>
        <p className="mt-1 text-[12px] text-[#315a92]">
          Preferências da conta e da interface.
        </p>
      </div>
      <section className={`${card} mt-5 p-5`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black">Aparência</h2>
            <p className="mt-1 text-xs text-slate-500">
              Escolha como o UNI aparece neste dispositivo.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            Em uso: {resolved}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["light", "Claro"],
              ["dark", "Escuro"],
              ["system", "Automático"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              data-theme-choice={value}
              aria-pressed={theme === value}
              onClick={() => change(value)}
              className={`theme-choice rounded-xl border p-4 text-left text-sm font-bold ${theme === value ? "theme-choice-active" : ""}`}
            >
              <span className="theme-choice-preview" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="mt-3 block">{label}</span>
            </button>
          ))}
        </div>
      </section>
      <section className={`${card} mt-4 p-5`}>
        <h2 className="font-black">Informações da conta</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Empresa</dt>
            <dd className="mt-1 text-sm font-bold">
              {data?.client?.display_name || data?.client?.legal_name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Situação da conta</dt>
            <dd className="mt-1 text-sm font-bold">
              {data?.client?.status || "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          Documentos, anexos e pastas de clientes não são armazenados no UNI
          Web.
        </p>
      </section>
      <section className={`${card} mt-4 p-5`}>
        <h2 className="font-black">Notificações</h2>
        <p className="mt-1 text-xs text-slate-500">
          Alertas operacionais são administrados pelo UNI. O cliente recebe
          somente atualizações de editais aprovados, participações e resultados.
        </p>
      </section>
      {message && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      )}
    </main>
  );
}
