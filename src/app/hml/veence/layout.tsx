import type { ReactNode } from "react";

export default function VeenceHmlLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="border-b border-slate-800 bg-slate-950 px-6 py-3 text-sm text-slate-200" aria-label="Navegação HML Veence">
        <div className="mx-auto flex max-w-4xl flex-wrap gap-4">
          <a className="underline underline-offset-4" href="/hml/veence">Painel HML</a>
          <a className="underline underline-offset-4" href="/hml/veence/executar">Execução multiagente REAL · HML</a>
        </div>
        <p className="mx-auto mt-2 max-w-4xl text-xs text-slate-400">
          Use estes links internos para permanecer no mesmo host HML; a sessão Supabase Auth é persistida por origem e compartilhada entre estas rotas.
        </p>
      </nav>
      {children}
    </div>
  );
}
