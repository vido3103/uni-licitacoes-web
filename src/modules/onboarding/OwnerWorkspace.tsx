"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ClientDossier from "@/modules/onboarding/ClientDossier";

type Client = { id: string; legal_name: string; display_name: string | null; status: string };
type AccessRequest = { id: string; cnpj: string; email: string; login: string; status: string; client_id: string | null; created_at: string; reviewed_at: string | null; rejection_reason: string | null };
const maskCnpj = (value: string) => value.replace(/\D/g, "").replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");

export default function OwnerWorkspace({ onOpenClient }: { onOpenClient: (id: string) => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function loadClients() {
    if (!supabase) return;
    const { data, error } = await supabase.from("clients").select("id,legal_name,display_name,status").neq("status", "inactive").order("legal_name");
    if (error) { setMessage(`Não foi possível carregar os clientes: ${error.message}`); return; }
    setClients((data ?? []) as Client[]);
  }

  async function loadRequests() {
    if (!supabase) return;
    const { data, error } = await supabase.functions.invoke("company-access-requests", { body: { action: "list" } });
    if (error || !data?.ok) { setMessage("Não foi possível carregar as solicitações de acesso."); return; }
    setRequests((data.requests ?? []) as AccessRequest[]);
  }

  useEffect(() => { void Promise.all([loadClients(), loadRequests()]); }, []);

  async function decide(requestId: string, action: "approve" | "reject") {
    if (!supabase || busyId) return;
    setBusyId(requestId); setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("company-access-requests", { body: { action, request_id: requestId } });
      if (error || !data?.ok) throw new Error(data?.detail || "A decisão não pôde ser concluída.");
      setMessage(action === "approve" ? "Solicitação aprovada. O cliente já pode entrar no UNI e iniciar o onboarding." : "Solicitação recusada.");
      await Promise.all([loadClients(), loadRequests()]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "A decisão não pôde ser concluída.");
    } finally { setBusyId(null); }
  }

  if (selected) return <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 xl:p-8"><ClientDossier clientId={selected} onClose={() => setSelected(null)} onOpenEnvironment={onOpenClient} /></div>;

  const pending = requests.filter((r) => r.status === "pending");
  const recent = requests.filter((r) => r.status !== "pending").slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 xl:p-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Administração da plataforma</p>
        <h1 className="mt-1 text-3xl font-bold">Clientes</h1>
        <p className="mt-2 text-sm text-slate-500">O Owner apenas aprova o acesso. Cada empresa completa e valida o próprio cadastro dentro do seu tenant.</p>
      </div>

      {pending.length > 0 && <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-lg text-white">!</span><div><p className="text-sm font-bold text-amber-950">{pending.length === 1 ? "Nova empresa aguardando sua aprovação" : `${pending.length} empresas aguardando sua aprovação`}</p><p className="mt-1 text-xs text-amber-800">Revise as solicitações abaixo para liberar o onboarding dos novos clientes.</p></div></div><a href="#solicitacoes-owner" className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-center text-xs font-bold text-white hover:bg-amber-700">Ver solicitações</a></div>}

      {message && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}

      <section id="solicitacoes-owner" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div><h2 className="font-bold">Solicitações de acesso</h2><p className="mt-1 text-xs text-slate-500">Cadastros aguardando decisão do Owner.</p></div>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{pending.length} pendente{pending.length === 1 ? "" : "s"}</span>
        </div>
        {pending.length === 0 ? <p className="p-5 text-sm text-slate-500">Nenhuma solicitação aguardando aprovação.</p> : <div className="divide-y">
          {pending.map((r) => <div key={r.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
            <div><b className="block text-sm">{maskCnpj(r.cnpj)}</b><span className="text-xs text-slate-500">Solicitado em {new Date(r.created_at).toLocaleString("pt-BR")}</span></div>
            <div><p className="text-xs font-semibold text-slate-700">{r.email}</p><p className="text-xs text-slate-500">E-mail</p></div>
            <div><p className="text-xs font-semibold text-slate-700">{r.login}</p><p className="text-xs text-slate-500">Usuário UNI</p></div>
            <div className="flex gap-2"><button onClick={() => void decide(r.id, "reject")} disabled={busyId === r.id} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">Recusar</button><button onClick={() => void decide(r.id, "approve")} disabled={busyId === r.id} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyId === r.id ? "Processando..." : "Aprovar"}</button></div>
          </div>)}
        </div>}
      </section>

      {recent.length > 0 && <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-bold">Decisões recentes</h2></div><div className="divide-y">{recent.map((r) => <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-4"><div><b className="block text-sm">{maskCnpj(r.cnpj)} · {r.login}</b><span className="text-xs text-slate-500">{r.email}</span></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{r.status === "approved" ? "Aprovado" : "Recusado"}</span></div>)}</div></section>}

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-5 py-4"><h2 className="font-bold">Clientes ativos / em onboarding</h2></div>
        {clients.length === 0 ? <p className="p-5 text-sm text-slate-500">Nenhum cliente disponível.</p> : <div className="divide-y">{clients.map((c) => <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-4"><span><b className="block text-sm">{c.display_name || c.legal_name}</b><span className="text-xs text-slate-500">{c.legal_name} · {c.status}</span></span><div className="flex gap-2"><button onClick={() => setSelected(c.id)} className="rounded-lg border px-3 py-2 text-xs font-semibold text-blue-700">Ver dossiê</button><button onClick={() => onOpenClient(c.id)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Abrir ambiente</button></div></div>)}</div>}
      </section>
    </div>
  );
}
