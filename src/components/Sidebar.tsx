export default function Sidebar() {
  const items = [
    "Dashboard",
    "Radar de Licitações",
    "Análise de Editais",
    "CFP",
    "Gate Econômico",
    "Estratégia de Disputa",
    "Relatórios",
    "Configurações",
  ];

  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-white p-5">
      <h1 className="text-2xl font-bold mb-8">
        UNI Licitações
      </h1>

      <nav className="space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className="p-3 rounded-lg hover:bg-slate-700 cursor-pointer"
          >
            {item}
          </div>
        ))}
      </nav>
    </aside>
  );
}