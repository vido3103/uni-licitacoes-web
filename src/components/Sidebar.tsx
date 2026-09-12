"use client";

type SidebarProps = { active:string; onNavigate:(module:string)=>void; showCliente?:boolean; ownerWorkspaceOnly?:boolean };

export default function Sidebar({active,onNavigate,showCliente=false,ownerWorkspaceOnly=false}:SidebarProps){
  const items=ownerWorkspaceOnly
    ? [["Cliente","Painel Owner","◉"]]
    : [
      ["Dashboard","Dashboard","⌂"],
      ...(showCliente?[["Cliente","Cliente","◉"]]:[]),
      ["Empresas","Empresas","◇"],
      ["SICAF","Habilitação SICAF","✓"],
      ["Gate de Participação","Gate de Participação","◆"],
      ["Radar","Radar de Licitações","◎"],
      ["Editais","Editais","▤"],
      ["CFP","CFP","🛒"],
      ["Gate Econômico","Gate Econômico","▥"],
      ["Disputa","Disputa","⚒"],
      ["Relatórios","Relatórios","▣"],
      ["Documentos","Documentos","□"],
      ["Fornecedores","Fornecedores","♙"],
      ["Configurações","Configurações","⚙"],
    ];

  return <aside className="hidden min-h-screen w-[188px] shrink-0 flex-col bg-[#0d2742] text-white lg:flex">
    <div className="flex h-[64px] items-center gap-2.5 border-b border-white/10 px-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-lg font-black shadow-lg">U</div>
      <div><div className="text-base font-bold leading-none">UNI</div><div className="mt-1 text-xs text-slate-200">Licitações</div></div>
    </div>
    <nav className="flex-1 space-y-0.5 px-2 py-4">{items.map(([value,label,icon])=>{const selected=active===value;return <button key={value} type="button" onClick={()=>onNavigate(value)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition ${selected?"bg-blue-600 font-semibold text-white shadow-md shadow-blue-950/20":"text-slate-200 hover:bg-white/10 hover:text-white"}`}><span className="w-4 text-center text-sm">{icon}</span><span>{label}</span></button>})}</nav>
    <div className="mx-3 mb-3 rounded-lg border border-white/10 bg-white/5 p-3"><p className="text-xs font-semibold">{ownerWorkspaceOnly?"Ambiente do Owner":"Ambiente da empresa"}</p><p className="mt-1 text-[10px] leading-4 text-slate-300">{ownerWorkspaceOnly?"Selecione um cliente para acessar os módulos operacionais.":"Dados isolados pelo tenant autenticado."}</p></div>
    <div className="flex items-center justify-between px-4 pb-4 text-[10px] text-slate-400"><span>Ambiente UNI</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>Online</span></div>
  </aside>
}
