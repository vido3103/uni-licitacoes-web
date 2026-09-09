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
    <aside className="w-72 min-h-screen bg-slate-950 text-white p-6">

      <div className="mb-10">
        <h1 className="text-3xl font-bold">
          UNI
        </h1>

        <p className="text-sm text-slate-400">
          Licitações Web
        </p>
      </div>


      <nav className="space-y-2">

        {items.map((item, index) => (

          <div
            key={item}
            className={`
              p-3 rounded-lg cursor-pointer
              transition
              ${
                index === 0
                ? "bg-slate-800"
                : "hover:bg-slate-800"
              }
            `}
          >

            {item}

          </div>

        ))}

      </nav>


      <div className="absolute bottom-6 text-xs text-slate-500">
        UNI v0.2
      </div>


    </aside>
  );
}