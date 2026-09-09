export default function Editais() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">
        Análise de Editais
      </h1>

      <p className="text-slate-500 mb-8">
        Central de análise técnica e documental dos processos.
      </p>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-semibold mb-2">
          Processos em análise
        </h2>

        <p className="text-slate-500">
          Nenhum edital carregado no momento.
        </p>
      </div>
    </div>
  );
}
