"use client";

import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import BackendStatus from "@/components/BackendStatus";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";
import Dashboard from "@/modules/dashboard/Dashboard";
import Radar from "@/modules/radar/Radar";
import Editais from "@/modules/editais/Editais";
import CFP from "@/modules/cfp/CFP";
import GateEconomico from "@/modules/gates/GateEconomico";
import Disputa from "@/modules/disputa/Disputa";
import Relatorios from "@/modules/relatorios/Relatorios";

type HeaderNotification = {
  id: string;
  title: string;
  detail: string;
  kind: "pending" | "analysis";
  createdAt?: string | null;
};

function notificationTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [signingOut, setSigningOut] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);

  async function loadNotifications() {
    if (!supabase) return;
    setNotificationsLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setNotifications([]);
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("client_members")
        .select("client_id")
        .eq("user_id", auth.user.id)
        .limit(1)
        .maybeSingle();
      if (membershipError || !membership?.client_id) {
        setNotifications([]);
        return;
      }

      const [pendingResponse, queueResponse] = await Promise.all([
        supabase
          .from("client_pending_items")
          .select("id,title,description,impact,state,created_at")
          .eq("client_id", membership.client_id)
          .not("state", "in", "(resolvida,cancelada)")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("opportunity_ai_analysis_queue")
          .select("id,status,prompt_master_version,queued_at,completed_at,error_detail")
          .eq("client_id", membership.client_id)
          .in("status", ["queued", "processing", "failed"])
          .order("queued_at", { ascending: false })
          .limit(5),
      ]);

      const pending: HeaderNotification[] = (pendingResponse.data ?? []).map((row) => ({
        id: `pending-${row.id}`,
        title: String(row.title || "Pendência do cadastro"),
        detail: row.description ? String(row.description) : `Impacto: ${String(row.impact || "a verificar")}`,
        kind: "pending",
        createdAt: row.created_at,
      }));

      const queue: HeaderNotification[] = (queueResponse.data ?? []).map((row) => ({
        id: `analysis-${row.id}`,
        title: row.status === "failed" ? "Falha na Análise Detalhada" : row.status === "processing" ? "Análise Detalhada em execução" : "Análise Detalhada aguardando execução",
        detail: row.status === "failed"
          ? String(row.error_detail || "A execução precisa ser revisada.")
          : `Execução registrada com ${String(row.prompt_master_version || "Prompt Mestre")}.`,
        kind: "analysis",
        createdAt: row.queued_at,
      }));

      setNotifications([...queue, ...pending].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 8));
    } finally {
      setNotificationsLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, [active]);

  async function handleSignOut() {
    if (!supabase || signingOut) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
  }

  function openNotification(notification: HeaderNotification) {
    setNotificationsOpen(false);
    setActive(notification.kind === "analysis" ? "Radar" : "Configurações");
  }

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
      <main className="min-h-screen bg-[#f4f8fc] text-slate-900"><div className="flex min-h-screen"><Sidebar active={active} onNavigate={setActive} /><div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="flex h-[76px] items-center gap-4 px-4 sm:px-6 xl:px-8">
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm lg:hidden">☰</button><div className="hidden min-w-[260px] lg:block"><p className="text-sm font-semibold text-slate-900">Inteligência em Licitações</p><p className="text-xs text-slate-500">para o seu resultado</p></div>
          <label className="relative mx-auto w-full max-w-[560px]"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span><input type="search" placeholder="Buscar editais, órgãos, processos, palavras-chave..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /></label>
          <div className="relative hidden sm:block">
            <button type="button" onClick={() => { const next = !notificationsOpen; setNotificationsOpen(next); if (next) void loadNotifications(); }} aria-label="Notificações" title="Notificações" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">🔔{notifications.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{notifications.length > 9 ? "9+" : notifications.length}</span>}</button>
            {notificationsOpen && <div className="absolute right-0 top-12 w-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="text-sm font-bold text-slate-900">Notificações</p><p className="text-xs text-slate-500">Pendências e execuções do seu ambiente</p></div><button type="button" onClick={() => void loadNotifications()} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Atualizar</button></div>
              <div className="max-h-[420px] overflow-y-auto">
                {notificationsLoading ? <div className="p-5 text-sm text-slate-500">Atualizando notificações...</div> : notifications.length === 0 ? <div className="p-5 text-sm text-slate-500">Nenhuma notificação pendente no momento.</div> : notifications.map((notification) => <button key={notification.id} type="button" onClick={() => openNotification(notification)} className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"><div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.kind === "analysis" ? "bg-blue-500" : "bg-amber-500"}`} /><div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{notification.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{notification.detail}</p>{notification.createdAt && <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">{notificationTime(notification.createdAt)}</p>}</div></div></button>)}
              </div>
            </div>}
          </div><div className="hidden h-8 w-px bg-slate-200 sm:block" />
          <div className="flex shrink-0 items-center gap-2 rounded-xl px-2 py-1.5"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">U</span><span className="hidden xl:block"><span className="block text-sm font-semibold text-slate-900">Ambiente autenticado</span><span className="block text-xs text-slate-500">Tenant protegido</span></span><button type="button" onClick={handleSignOut} disabled={signingOut} title="Sair" aria-label="Sair da conta" className="ml-1 inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50">{signingOut ? "Saindo..." : "Sair"}</button></div>
        </div></header><BackendStatus /><section>{renderContent()}</section>
      </div></div></main>
    </AuthGate>
  );
}
