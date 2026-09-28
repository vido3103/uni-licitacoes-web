"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveCurrentClientId } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";

type Row = Record<string, unknown>;
type Stage = "Oportunidade" | "Análise" | "Proposta" | "Disputa" | "Resultado";
type Meta = {
  hasRequirements: boolean;
  hasAnalysis: boolean;
  cfpCount: number;
  economicCount: number;
  strategyCount: number;
  activeCount: number;
  wonCount: number;
  lostCount: number;
};

const stages: Stage[] = ["Oportunidade", "Análise", "Proposta", "Disputa", "Resultado"];
const empty = (): Meta => ({ hasRequirements: false, hasAnalysis: false, cfpCount: 0, economicCount: 0, strategyCount: 0, activeCount: 0, wonCount: 0, lostCount: 0 });
const txt = (v: unknown, fallback = "—") => v === null || v === undefined || String(v).trim() === "" ? fallback : String(v);
const lower = (v: unknown) => String(v ?? "").toLowerCase();
const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n) : "—";
};
const date = (v: unknown) => {
  if (!v) return "—";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR").format(d);
};

function stageOf(r: Row, m: Meta): Stage {
  if (m.wonCount || m.lostCount) return "Resultado";
  if (m.activeCount || m.strategyCount) return "Disputa";
  if (m.economicCount || m.cfpCount) return "Proposta";
  if (m.hasRequirements || m.hasAnalysis) return "Análise";
  return "Oportunidade";
}

function tabFor(stage: Stage) {
  if (stage === "Análise") return "Análise";
  if (stage === "Proposta") return "Cotação";
  if (stage === "Disputa") return "Disputa";
  if (stage === "Resultado") return "Histórico";
  return "Resumo";
}

const stageClass: Record<Stage, string> = {
  Oportunidade: "bg-[#edf6ff]",
  Análise: "bg-[#fff4df]",
  Proposta: "bg-[#f2ecff]",
  Disputa: "bg-[#e9fbf2]",
  Resultado: "bg-[#f3f6f9]",
};
const badgeClass: Record<Stage, string> = {
  Oportunidade: "bg-[#e5f1ff] text-[#0a66f5]",
  Análise: "bg-[#fff0ce] text-[#a96500]",
  Proposta: "bg-[#eee4ff] text-[#6d35db]",
  Disputa: "bg-[#dcf8e9] text-[#087747]",
  Resultado: "bg-[#edf1f5] text-[#455a70]",
};

export default function Negocios({ onNavigate }: { onNavigate?: (module: string) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Record<string, Meta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  async function load() {
    if (!supabase) return;
    setLoading(true);
    setError("");
    try {
      const cid = await resolveCurrentClientId();
      if (!cid) throw new Error("Cliente não associado.");
      const { data: radar, error: radarError } = await supabase.from("client_radar_dashboard").select("*").eq("client_id", cid).order("publication_date", { ascending: false }).limit(500);
      if (radarError) throw radarError;
      const base = (radar ?? []) as Row[];
      setRows(base);
      const ids = [...new Set(base.map(r => String(r.opportunity_id || "")).filter(Boolean))];
      if (!ids.length) { setMeta({}); return; }

      const [req, ana, cfp, econ, disp] = await Promise.all([
        supabase.from("opportunity_requirements").select("opportunity_id").eq("client_id", cid).in("opportunity_id", ids),
        supabase.from("opportunity_ai_analysis_queue").select("opportunity_id,status").eq("client_id", cid).in("opportunity_id", ids),
        supabase.from("cfp_items").select("opportunity_id").eq("client_id", cid).in("opportunity_id", ids),
        supabase.from("gate_economic_results").select("opportunity_id").eq("client_id", cid).in("opportunity_id", ids),
        supabase.from("dispute_strategies").select("opportunity_id,status").eq("client_id", cid).in("opportunity_id", ids),
      ]);
      for (const result of [req, ana, cfp, econ, disp]) if (result.error) throw result.error;

      const next: Record<string, Meta> = {};
      for (const id of ids) next[id] = empty();
      for (const x of req.data ?? []) if (next[String(x.opportunity_id)]) next[String(x.opportunity_id)].hasRequirements = true;
      for (const x of ana.data ?? []) if (next[String(x.opportunity_id)]) next[String(x.opportunity_id)].hasAnalysis = true;
      for (const x of cfp.data ?? []) if (next[String(x.opportunity_id)]) next[String(x.opportunity_id)].cfpCount++;
      for (const x of econ.data ?? []) if (next[String(x.opportunity_id)]) next[String(x.opportunity_id)].economicCount++;
      for (const x of disp.data ?? []) {
        const id = String(x.opportunity_id);
        const status = lower(x.status);
        if (!next[id]) continue;
        next[id].strategyCount++;
        if (status === "active") next[id].activeCount++;
        if (status === "won") next[id].wonCount++;
        if (status === "lost") next[id].lostCount++;
      }
      setMeta(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar os negócios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => [r.process_number, r.buyer_name, r.object_text, r.title, r.modality].some(v => String(v ?? "").toLowerCase().includes(q)));
  }, [rows, query]);

  const grouped = useMemo(() => Object.fromEntries(stages.map(stage => [stage, filtered.filter(r => stageOf(r, meta[String(r.opportunity_id)] ?? empty()) === stage)])) as Record<Stage, Row[]>, [filtered, meta]);
  const won = grouped.Resultado.filter(r => (meta[String(r.opportunity_id)] ?? empty()).wonCount > 0).length;
  const lost = grouped.Resultado.filter(r => (meta[String(r.opportunity_id)] ?? empty()).lostCount > 0).length;
  const decided = won + lost;
  const conversion = decided ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format((won / decided) * 100)}%` : "—";
  const estimatedPipeline = filtered.reduce((sum, r) => {
    const n = Number(r.estimated_total_value ?? r.estimated_value ?? 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const orgs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filtered) {
      const name = txt(r.buyer_name, "Órgão não informado");
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filtered]);
  const maxOrg = Math.max(1, ...orgs.map(([, count]) => count));

  function open(r: Row, stage: Stage) {
    const oid = String(r.opportunity_id || "");
    if (oid) {
      sessionStorage.setItem("uni-opportunity-open", oid);
      sessionStorage.setItem("uni-opportunity-tab", tabFor(stage));
    }
    onNavigate?.("Oportunidades");
  }

  if (loading) return <div className="p-8 text-sm text-slate-500">Carregando negócios...</div>;

  return <div className="mx-auto max-w-[1650px] p-5 text-[#08245c]">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-[#e8f3ff] text-2xl text-[#0a66f5]">▣</div><div><h1 className="text-[26px] font-black">Negócios</h1><p className="text-[12px] font-medium text-[#315a92]">Acompanhe o fluxo real das oportunidades da empresa.</p></div></div>
      <div className="flex gap-2"><button onClick={() => onNavigate?.("Oportunidades")} className="rounded-lg border border-[#bed8f0] bg-white px-4 py-2.5 text-[12px] font-bold text-[#0a5cc8]">Buscar oportunidades</button><button onClick={() => void load()} className="rounded-lg bg-[#0a66f5] px-4 py-2.5 text-[12px] font-black text-white">Atualizar</button></div>
    </div>
    {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

    <div className="mt-4 flex flex-col gap-3 border-b border-[#dce8f3] pb-3 lg:flex-row lg:items-center lg:justify-between"><div><b className="text-[12px]">Kanban operacional</b><p className="text-[10px] text-[#5b7393]">As etapas são derivadas somente dos registros persistidos no Veence.</p></div><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por número, órgão, objeto..." className="w-full rounded-lg border border-[#cfe0ef] px-3 py-2 text-[11px] lg:w-80" /></div>

    <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_360px]">
      <div className="overflow-x-auto"><div className="grid min-w-[1000px] grid-cols-5 gap-2">
        {stages.map(stage => <section key={stage} className={`rounded-xl p-2.5 ${stageClass[stage]}`}>
          <div className="flex items-center justify-between px-1"><h2 className="text-[13px] font-black">{stage}</h2><span className="rounded-md bg-white/80 px-2 py-1 text-[11px] font-black">{grouped[stage].length}</span></div>
          <p className="mt-1 min-h-8 px-1 text-[10px] text-[#435f8a]">{stage === "Oportunidade" ? "Identificada, sem avanço operacional persistido." : stage === "Análise" ? "Com requisitos ou análise registrada." : stage === "Proposta" ? "Com cotação ou gate econômico registrado." : stage === "Disputa" ? "Com estratégia de disputa registrada." : "Com resultado registrado."}</p>
          <div className="mt-2 space-y-2">{grouped[stage].slice(0, 7).map((r, i) => {
            const m = meta[String(r.opportunity_id)] ?? empty();
            const result = stage === "Resultado" ? (m.wonCount ? "Ganho" : m.lostCount ? "Perdido" : "Resultado") : stage;
            return <button key={`${String(r.opportunity_id)}-${i}`} onClick={() => open(r, stage)} className="block w-full rounded-lg bg-white p-3 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md"><b className="text-[11px]">{txt(r.process_number, "Sem número")}</b><p className="mt-0.5 line-clamp-1 text-[10px] text-[#3f5c88]">{txt(r.buyer_name)}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-[#3f5c88]">{txt(r.object_text, txt(r.title, "Objeto"))}</p><p className="mt-1 text-[10px]">Prazo: {date(r.proposal_deadline)}</p><span className={`mt-2 inline-flex rounded-md px-2 py-1 text-[9px] font-black ${result === "Perdido" ? "bg-red-50 text-red-600" : result === "Ganho" ? "bg-emerald-50 text-emerald-700" : badgeClass[stage]}`}>{result}</span></button>;
          })}{!grouped[stage].length && <div className="rounded-lg border border-dashed border-[#bfd1e3] bg-white/50 p-5 text-center text-[10px] text-[#7189a8]">Nenhum negócio nesta etapa.</div>}</div>
          <button onClick={() => onNavigate?.("Oportunidades")} className="mt-2 w-full rounded-md bg-white/55 py-2 text-[10px] font-black text-[#0a5cc8]">Buscar oportunidade</button>
        </section>)}
      </div></div>

      <aside className="space-y-3">
        <div className="rounded-xl border border-[#dbe7f2] bg-white p-4 shadow-sm"><h2 className="text-[13px] font-black">Resumo dos Negócios</h2><p className="mt-1 text-[9px] text-slate-500">Dados atuais do pipeline carregado.</p><div className="mt-3 grid grid-cols-4 gap-2">{[[filtered.length, "Total"], [filtered.length - grouped.Resultado.length, "Em andamento"], [won, "Ganhos"], [lost, "Perdidos"]].map(([n, label]) => <div key={String(label)} className="rounded-lg bg-[#f3f8fd] p-2 text-center"><b className="text-[15px]">{n}</b><p className="text-[9px]">{label}</p></div>)}</div><div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#e3edf6] pt-3"><div><p className="text-[10px]">Conversão dos resultados</p><b className="text-[23px] text-emerald-700">{conversion}</b><p className="text-[9px] text-slate-500">Ganhos ÷ resultados ganhos/perdidos</p></div><div><p className="text-[10px]">Valor estimado do pipeline</p><b className="text-[17px]">{money(estimatedPipeline)}</b><p className="text-[9px] text-slate-500">Soma dos valores estimados disponíveis</p></div></div></div>

        <div className="rounded-xl border border-[#dbe7f2] bg-white p-4 shadow-sm"><h2 className="text-[12px] font-black">Negócios por órgão</h2>{orgs.length ? orgs.map(([name, count]) => <div key={name} className="mt-3 grid grid-cols-[1fr_110px_28px] items-center gap-2 text-[9px]"><span className="truncate">{name}</span><div className="h-2 rounded bg-[#eef3f8]"><div className="h-2 rounded bg-blue-600" style={{ width: `${Math.max(5, (count / maxOrg) * 100)}%` }} /></div><b className="text-right">{count}</b></div>) : <p className="mt-3 text-[10px] text-slate-500">Sem dados para exibir.</p>}</div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-[10px] leading-5 text-blue-900"><b>Integridade do painel</b><p className="mt-1">O Veence não exibe projeções de crescimento, evolução histórica ou valores conquistados quando esses dados ainda não existem de forma persistida.</p></div>
      </aside>
    </div>
  </div>;
}
