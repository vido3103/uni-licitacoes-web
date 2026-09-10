"use client";

import { useEffect, useState } from "react";
import { loadCurrentClientDashboard, BackendDashboard } from "@/lib/dashboard";

export default function BackendStatus() {
  const [data, setData] = useState<BackendDashboard | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadCurrentClientDashboard().then(setData).catch(() => setError(true));
  }, []);

  if (error) return <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-800">Backend conectado, mas os dados do tenant não puderam ser carregados.</div>;
  if (!data) return <div className="border-b border-slate-200 bg-white px-6 py-2 text-xs text-slate-400">Validando empresa e dados operacionais...</div>;

  const live = Number(data.summary?.live_count ?? 0);
  const pending = Number(data.pending?.open_pending_count ?? 0);
  return <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-2 text-xs text-emerald-800"><strong>{data.client?.display_name || data.client?.legal_name || "Cliente"}</strong> · tenant validado · {live} oportunidades ativas · {pending} pendências abertas</div>;
}
