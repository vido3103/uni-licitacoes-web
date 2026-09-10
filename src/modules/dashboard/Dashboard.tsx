interface DashboardProps {
  onNavigate?: (module: string) => void;
}

const opportunities = [
  ["SMS São Paulo", "Dispensa Eletrônica", "79/2026", "Carrinhos e paleteiras", "15/09/2026", "Em análise", "blue"],
  ["Mogi das Cruzes", "Pregão Eletrônico", "85/2026", "Pneus e baterias", "12/09/2026", "Viável", "green"],
  ["Metrô SP", "Dispensa", "319/2026", "Peças automotivas", "22/09/2026", "Aprovado", "green"],
  ["SEMASA Santo André", "Pregão Eletrônico", "19/2026", "Óleos lubrificantes", "10/09/2026", "Em análise", "blue"],
  ["Subpref. Brasilândia", "Dispensa Eletrônica", "26/2026", "Peças automotivas", "20/09/2026", "CFP", "amber"],
];

const deadlines = [
  ["12", "SET", "PE 85/2026", "Abertura da sessão", "Mogi das Cruzes/SP"],
  ["15", "SET", "Dispensa 79/2026", "Envio da proposta", "SMS São Paulo – CRS Leste"],
  ["18", "SET", "PE 23/2026", "Análise de recursos", "Prefeitura Municipal"],
  ["22", "SET", "Dispensa 319/2026", "Documentação de habilitação", "Metrô SP"],
];

const activities = [
  ["Novo edital encontrado", "Dispensa 79/2026 – SMS SP", "há 2 horas", "blue"],
  ["CFP iniciado", "PE 85/2026 – Mogi das Cruzes", "há 5 horas", "green"],
  ["Documento gerado", "Relatório de Viabilidade – Metrô SP", "há 1 dia", "amber"],
  ["Processo aprovado", "Dispensa 319/2026 – Metrô SP", "há 1 dia", "green"],
  ["Lembrete de prazo", "Envio da proposta – 15/09/2026", "há 1 dia", "amber"],
];

const toneClasses: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
};

export default function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="px-4 py-6 sm:px-6 xl:px-8">
      <div className="mx-auto max-w-[1540px]">
        <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Olá, Vidrão!</h1>
            <p className="mt-1 text-base text-slate-500">Aqui está o resumo da sua operação em licitações.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white">▣</div>
            <div>
              <p className="font-semibold text-slate-800">Quarta-feira, 09 de setembro de 2026</p>
              <p className="text-xs text-slate-500">São Paulo/SP</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.1fr]">
          {[
            ["⌕", "12", "Oportunidades", "Encontradas", "+33%", "Últimos 7 dias", "from-blue-500 to-blue-600"],
            ["▣", "5", "Editais em Análise", "", "+25%", "Em andamento", "from-emerald-500 to-green-600"],
            ["🛒", "3", "CFP em Cotação", "", "+50%", "Fornecedores", "from-orange-500 to-amber-500"],
            ["▥", "2", "Processos Aprovados", "", "+100%", "No mês", "from-violet-500 to-purple-600"],
          ].map(([icon, value, title, subtitle, trend, helper, gradient]) => (
            <section key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-lg font-bold text-white shadow-sm`}>{icon}</div>
                <div className="min-w-0">
                  <div className="text-2xl font-bold text-slate-900">{value}</div>
                  <div className="text-sm text-slate-600">{title}</div>
                  {subtitle && <div className="text-sm text-slate-600">{subtitle}</div>}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-emerald-600">↑ {trend}</span>
                <span className="text-slate-400">{helper}</span>
              </div>
            </section>
          ))}

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2 xl:col-span-1">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Próximos Prazos</h2>
              <button className="text-xs font-semibold text-blue-600">Ver todos</button>
            </div>
            <div className="space-y-3">
              {deadlines.slice(0, 2).map(([day, month, code, action]) => (
                <div key={code} className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                    <span className="text-sm font-bold leading-none">{day}</span>
                    <span className="mt-1 text-[9px] font-bold">{month}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-800">{code}</p>
                    <p className="truncate text-[11px] text-slate-500">{action}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.95fr_0.55fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Evolução de Oportunidades</h2>
              <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">Últimos 6 meses⌄</button>
            </div>
            <div className="mt-5 h-[190px] rounded-xl bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:14.28%_25%] p-4">
              <svg viewBox="0 0 600 180" className="h-full w-full" aria-label="Gráfico de evolução">
                <defs>
                  <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity=".25" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M15 145 L105 125 L195 107 L285 90 L375 68 L465 84 L585 55 L585 170 L15 170 Z" fill="url(#area)" />
                <polyline points="15,145 105,125 195,107 285,90 375,68 465,84 585,55" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {["15,145","105,125","195,107","285,90","375,68","465,84","585,55"].map((p) => {
                  const [cx, cy] = p.split(",");
                  return <circle key={p} cx={cx} cy={cy} r="5" fill="#3b82f6" stroke="white" strokeWidth="2" />;
                })}
              </svg>
            </div>
            <div className="mt-2 flex justify-between px-3 text-[11px] text-slate-400"><span>Set</span><span>Out</span><span>Nov</span><span>Dez</span><span>Jan</span><span>Fev</span><span>Mar</span></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Status dos Processos</h2>
            <div className="mt-5 flex items-center gap-6">
              <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: "conic-gradient(#3b82f6 0 41%, #22c55e 41% 64%, #f59e0b 64% 82%, #8b5cf6 82% 91%, #ef4444 91% 100%)" }}>
                <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-2xl font-bold text-slate-900">22</span>
                  <span className="text-xs text-slate-500">Total</span>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2.5 text-xs">
                {[["blue","Em análise","9"],["green","Aguardando CFP","5"],["amber","Viáveis","4"],["violet","Aprovados","2"],["rose","Não viáveis","2"]].map(([c,l,v]) => (
                  <div key={l} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full bg-${c}-500`} />{l}</span><strong>{v}</strong></div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold">Próximos Prazos</h2><button className="text-xs text-blue-600">Ver todos</button>
            </div>
            <div className="space-y-3">
              {deadlines.map(([day, month, code, action, city]) => (
                <div key={code} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-rose-50 text-rose-600"><span className="font-bold leading-none">{day}</span><span className="mt-1 text-[9px] font-bold">{month}</span></div>
                  <div className="min-w-0"><p className="text-[11px] font-bold text-slate-800">{code}</p><p className="truncate text-[10px] text-slate-500">{action}</p><p className="truncate text-[10px] text-slate-400">{city}</p></div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_0.8fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between px-5 py-4"><h2 className="font-bold">Últimas Oportunidades</h2><button className="text-xs font-semibold text-blue-600">Ver todas</button></div>
            <div className="overflow-x-auto">
              <table className="min-w-[850px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500"><tr>{["Órgão","Modalidade","Número","Objeto","Prazo","Status"].map((h) => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {opportunities.map(([org, modality, number, object, deadline, status, tone]) => (
                    <tr key={org} className="hover:bg-slate-50/70"><td className="px-5 py-3 font-semibold text-slate-800">{org}</td><td className="px-5 py-3 text-slate-500">{modality}</td><td className="px-5 py-3 text-slate-600">{number}</td><td className="px-5 py-3 text-slate-600">{object}</td><td className="px-5 py-3 text-slate-600">{deadline}</td><td className="px-5 py-3"><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${toneClasses[tone]}`}>{status}</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Atividades Recentes</h2><button className="text-xs font-semibold text-blue-600">Ver todas</button></div>
            <div className="space-y-4">
              {activities.map(([title, detail, time, tone]) => (
                <div key={title} className="flex gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone === "blue" ? "bg-blue-500" : tone === "green" ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold text-slate-800">{title}</p><span className="whitespace-nowrap text-[10px] text-slate-400">{time}</span></div><p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p></div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold">Acesso Rápido</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[["Radar","⌕","Buscar Editais"],["Editais","▣","Nova Análise"],["Relatórios","▥","Gerar Relatório"],["Documentos","□","Meus Documentos"],["Fornecedores","♙","Fornecedores"]].map(([module, icon, label]) => (
                <button key={label} type="button" onClick={() => onNavigate?.(module)} className="rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-600">{icon}</span>
                  <span className="mt-2 block text-xs font-semibold text-slate-700">{label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-100 via-white to-slate-900 p-5 shadow-sm">
            <div className="relative z-10 max-w-[52%]"><div className="text-5xl leading-none text-slate-300">“</div><p className="mt-1 text-lg italic leading-6 text-slate-700">Disciplina hoje, resultados amanhã.</p><p className="mt-3 text-xs text-slate-500">UNI Licitações</p></div>
            <div className="absolute inset-y-0 right-0 flex w-[48%] items-end justify-end bg-[radial-gradient(circle_at_center,#334155_0,#0f172a_70%)] p-5 text-right text-white"><div><div className="text-4xl">🏗️</div><p className="mt-2 text-sm font-semibold">Movendo o seu negócio</p><p className="text-xs text-slate-300">com oportunidades.</p></div></div>
          </section>
        </div>

        <footer className="mt-5 flex flex-col justify-between gap-3 border-t border-slate-200 py-5 text-xs text-slate-400 sm:flex-row"><span><strong className="text-slate-500">UNI</strong> Licitações © 2026. Todos os direitos reservados.</span><span>Termos de Uso　|　Política de Privacidade　|　Suporte</span></footer>
      </div>
    </div>
  );
}
