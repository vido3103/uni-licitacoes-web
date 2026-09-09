export default function Radar() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">
        Radar de Licitações
      </h1>

      <p className="text-slate-500 mb-8">
        Monitoramento e triagem de novas oportunidades.
      </p>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold mb-2">
          Oportunidades
        </h2>

        <p className="text-slate-500">
          Nenhuma oportunidade carregada no momento.
        </p>
      </div>
    </div>
  );
}
