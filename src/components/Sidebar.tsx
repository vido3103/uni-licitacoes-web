"use client";

type SidebarProps = { active:string; onNavigate:(module:string)=>void; showCliente?:boolean; ownerWorkspaceOnly?:boolean; isPlatformOwner?:boolean };

export default function Sidebar({active,onNavigate,showCliente=false,ownerWorkspaceOnly=false}:SidebarProps){
  const items=ownerWorkspaceOnly
    ? [["Cliente","Painel Owner","◉"]]
    : [
      ["Dashboard","Visão geral","⌂"],
      ...(showCliente?[["Cliente","Clientes","◉"]]:[]),
      ["SICAF","Habilitação","✓"],
      ["Radar","Radar","◎"],
      ["Editais","Oportunidades","▤"],
      ["CFP","Custos e preços","$"],
      ["Gate Econômico","Decisão econômica","◆"],
      ["Disputa","Disputa","↗"],
      ["Relatórios","Relatórios","▣"],
      ["Documentos","Documentos","□"],
      ["Fornecedores","Fornecedores","♙"],
      ["Configurações","Configurações","⚙"],
    ];

  return <aside className="hidden min-h-screen w-[212px] shrink-0 flex-col border-r border-slate-800 bg-[#091b2d] text-white lg:flex">
    <div className="flex h-[72px] items-center gap-3 border-b border-white/10 px-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-black shadow-lg shadow-blue-950/30">U</div>
      <div><div className="text-base font-black leading-none tracking-tight">UNI</div><div className="mt-1 text-[11px] font-medium text-slate-300">Licitações</div></div>
    </div>
    <div className="px-4 pt-5"><p className="px-2 text-[9px] font-bold uppercase tracking-[.18em] text-slate-500">{ownerWorkspaceOnly?"Administração":"Operação"}</p></div>
    <nav className="flex-1 space-y-1 px-3 py-3">{items.map(([value,label,icon])=>{const selected=active===value;return <button key={value} type="button" onClick={()=>onNavigate(value)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition ${selected?"bg-blue-600 font-bold text-white shadow-lg shadow-blue-950/20":"font-medium text-slate-300 hover:bg-white/[.07] hover:text-white"}`}><span className="w-4 text-center text-sm opacity-90">{icon}</span><span>{label}</span></button>})}</nav>
    <div className="m-3 rounded-xl border border-white/10 bg-white/[.04] p-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400"/><p className="text-[10px] font-bold">Sistema operacional</p></div><p className="mt-1.5 text-[9px] leading-4 text-slate-400">{ownerWorkspaceOnly?"Escolha um cliente para entrar no ambiente isolado.":"Ambiente isolado do cliente selecionado."}</p></div>
  </aside>
}
