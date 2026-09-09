import DashboardCard from "@/components/DashboardCard";

export default function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">
        Dashboard Operacional
      </h1>

      <p className="text-slate-500 mb-8">
        Visão geral da operação do UNI Licitações.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardCard
          title="Oportunidades Encontradas"
          value="0"
        />

        <DashboardCard
          title="Editais em Análise"
          value="0"
        />

        <DashboardCard
          title="Processos Aprovados"
          value="0"
        />
      </div>
    </div>
  );
}
