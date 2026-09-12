"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Enterprise = { client_id: string; cnpj: string | null; legal_name: string; trade_name: string | null; validation_status: string };
type Lookup = { cnpj: string; legal_name: string | null; trade_name: string | null; registration_status: string | null; city: string | null; state: string | null; cnaes: unknown[]; source?: string };
const maskCnpj=(v:string)=>v.replace(/\D/g,"").replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2");

export default function ApprovedClientOnboarding({ onNavigate }: { onNavigate: (module: string) => void }) {
  const [enterprise, setEnterprise] = useState<Enterprise | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setLoading(false); return; }
    const { data: membership } = await supabase.from("client_members").select("client_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
    if (!membership?.client_id) { setLoading(false); return; }
    const { data } = await supabase.from("client_enterprise_data").select("client_id,cnpj,legal_name,trade_name,validation_status").eq("client_id", membership.client_id).eq("is_current", true).maybeSingle();
    setEnterprise((data ?? null) as Enterprise | null);
    setLoading(false);
  }

  async function consult() {
    if (!supabase || !enterprise?.cnpj || busy) return;
    setBusy(true); setMessage(""); setLookup(null);
    try {
      const { data, error } = await supabase.functions.invoke("cnpj-lookup", { body: { cnpj: enterprise.cnpj } });
      if (error || !data?.ok) throw new Error(data?.error || "Não foi possível consultar o CNPJ.");
      setLookup(data as Lookup);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Consulta indisponível."); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!supabase || !lookup || busy) return;
    setBusy(true); setMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("company-self-onboarding", { body: { cnpj: lookup.cnpj, legal_name: lookup.legal_name || lookup.trade_name || "Empresa", trade_name: lookup.trade_name, city: lookup.city, state: lookup.state, cnaes: lookup.cnaes, source_data: { provider: lookup.source || "cnpj-lookup", registration_status: lookup.registration_status, confirmed_at: new Date().toISOString() } } });
      if (error || !data?.ok) throw new Error(data?.detail || "Não foi possível atualizar o cadastro.");
      setDone(true);
      setMessage("Dados cadastrais confirmados. Agora anexe os documentos e conclua a habilitação.");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Atualização não concluída."); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="p-8 text-sm text-slate-500">Carregando cadastro inicial...</div>;
  if (!enterprise) return <div className="mx-auto max-w-3xl p-8"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Seu acesso foi autenticado, mas o tenant ainda não foi vinculado. Saia e entre novamente; se persistir, fale com o Owner do UNI.</div></div>;

  return <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 xl:p-8">
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-600">Configuração inicial da empresa</p><h1 className="mt-1 text-3xl font-bold">Valide seu cadastro</h1><p className="mt-2 text-sm text-slate-500">O Owner já aprovou seu acesso. A partir daqui, a própria empresa confirma seus dados e documentos.</p></div>
    {message && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-3"><Info label="CNPJ" value={enterprise.cnpj ? maskCnpj(enterprise.cnpj) : "—"}/><Info label="Razão social" value={enterprise.legal_name}/><Info label="Status" value="Onboarding"/></div>
      {!lookup && !done && <button onClick={() => void consult()} disabled={busy || !enterprise.cnpj} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Consultando..." : "Consultar dados oficiais do CNPJ"}</button>}
      {lookup && !done && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h2 className="font-bold text-emerald-900">Dados localizados</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><Info label="Razão social" value={lookup.legal_name || "—"}/><Info label="Nome fantasia" value={lookup.trade_name || "—"}/><Info label="Situação cadastral" value={lookup.registration_status || "—"}/><Info label="Município / UF" value={[lookup.city, lookup.state].filter(Boolean).join(" / ") || "—"}/></div><button onClick={() => void confirm()} disabled={busy} className="mt-4 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Confirmando..." : "Confirmar dados da empresa"}</button></div>}
    </section>
    {done && <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5"><h2 className="font-bold text-blue-900">Próximas etapas</h2><p className="mt-2 text-sm text-blue-900">Anexe novamente os documentos da empresa e depois revise a habilitação SICAF.</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => onNavigate("Documentos")} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Ir para Documentos</button><button onClick={() => onNavigate("SICAF")} className="rounded-xl border border-blue-300 bg-white px-4 py-2.5 text-sm font-bold text-blue-700">Ir para SICAF</button></div></section>}
  </div>;
}

function Info({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>}
