import DashboardCard from "@/components/DashboardCard";

interface DashboardProps {
  onNavigate?: (module: string) => void;
}

const flow = [
  "Radar",
  "Triagem",
  "Análise",
  "CFP",
  "Gate Econômico",
  "Disputa",
  "Relatório",
];

export default function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Visão operacional</span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Dashboard Operacional</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Acompanhe oportunidades, análises, cotações e decisões em um único ambiente.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Ambiente operacional
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Oportunidades Encontradas" value="0" helper="Radar ainda sem dados conectados" tone="blue" />
        <DashboardCard title="Editais em Análise" value="0" helper="Nenhuma análise ativa" tone="emerald" />
        <DashboardCard title="CFP em Cotação" value="0" helper="Nenhuma cotação ativa" tone="amber" />
        <DashboardCard title="Processos Aprovados" value="0" helper="Nenhuma decisão registrada" tone="violet" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Fluxo operacional</h2>
              <p className="mt-1 text-sm text-slate-500">A jornada principal do processo dentro da plataforma.</p>
            </div>
            <span className="text-xs font-medium text-slate-400">Método UNI</span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {flow.map((item, index) => (
              <div key={item} className="relative rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center">
                <span className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <p className="text-xs font-semibold text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Próximos prazos</h2>
              <p className="mt-1 text-sm text-slate-500">Alertas operacionais aparecerão aqui.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">0</span>
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-600">Nenhum prazo cadastrado</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">Os prazos dos processos aparecerão automaticamente após a integração.</p>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Acesso rápido</h2>
              <p className="mt-1 text-sm text-slate-500">Comece pelas ações mais frequentes.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Radar", "Buscar oportunidades"],
              ["Editais", "Iniciar análise"],
              ["CFP", "Abrir cotações"],
              ["Relatórios", "Consultar relatórios"],
            ].map(([module, label]) => (
              <button
                type="button"
                key={module}
                onClick={() => onNavigate?.(module)}
                className="group rounded-xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
              >
                <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">{label}</span>
                <span className="mt-1 block text-xs text-slate-400">Abrir módulo →</span>
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Inteligência aplicada</span>
          <h2 className="mt-3 max-w-lg text-2xl font-semibold leading-tight">Decisões de licitação com método, rastreabilidade e velocidade.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
            A interface será conectada ao motor metodológico, ao histórico do cliente e às evidências de cada processo.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-slate-700 px-3 py-1.5">Multiempresa</span>
            <span className="rounded-full border border-slate-700 px-3 py-1.5">Rastreável</span>
            <span className="rounded-full border border-slate-700 px-3 py-1.5">Modular</span>
          </div>
        </section>
      </div>
    </div>
  );
}
