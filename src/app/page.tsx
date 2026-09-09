import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import DashboardCard from "@/components/DashboardCard";

export default function Home() {
  return (
    <main className="flex min-h-screen bg-gray-100">

      <Sidebar />

      <section className="flex-1">

        <Header />

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

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

          <DashboardCard
            title="Pendências"
            value="0"
          />

          <DashboardCard
            title="Relatórios Gerados"
            value="0"
          />

          <DashboardCard
            title="Status do Sistema"
            value="Online"
          />

        </div>

      </section>

    </main>
  );
}
