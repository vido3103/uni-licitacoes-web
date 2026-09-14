"use client";

type SidebarProps={active:string;onNavigate:(module:string)=>void;showCliente?:boolean;ownerWorkspaceOnly?:boolean;isPlatformOwner?:boolean};
type NavItem={value:string;label:string;code:string};

function selected(active:string,value:string){
  if(active===value)return true;
  if(value==="Painel"&&active==="Dashboard")return true;
  if(value==="Radar"&&(active==="Oportunidades"||active==="Editais"))return true;
  if(value==="Negócios"&&(active==="CFP"||active==="Gate Econômico"||active==="Gate de Participação"||active==="Disputa"))return true;
  if(value==="Inteligência"&&active==="Relatórios")return true;
  if(value==="Empresa"&&active==="Empresas")return true;
  if(value==="Habilitação"&&active==="SICAF")return true;
  return false;
}

export default function Sidebar({active,onNavigate,ownerWorkspaceOnly=false,isPlatformOwner=false}:SidebarProps){
 const owner:NavItem[]=[
  {value:"Administração",label:"Visão geral",code:"VG"},{value:"Clientes",label:"Clientes",code:"CL"},{value:"Oportunidades",label:"Oportunidades",code:"OP"},{value:"Negócios",label:"Negócios",code:"NG"},{value:"Habilitação",label:"Habilitação",code:"HB"},{value:"Documentos",label:"Documentos",code:"DC"},{value:"Usuários",label:"Usuários",code:"US"},{value:"Inteligência",label:"Inteligência",code:"IA"},{value:"Configurações",label:"Configurações",code:"CF"}
 ];
 const client:NavItem[]=[
  {value:"Painel",label:"Painel",code:"PN"},{value:"Radar",label:"Radar",code:"RD"},{value:"Oportunidades",label:"Oportunidades",code:"OP"},{value:"Negócios",label:"Negócios",code:"NG"},{value:"Habilitação",label:"Habilitação",code:"HB"},{value:"Documentos",label:"Documentos",code:"DC"},{value:"Empresa",label:"Empresa",code:"EM"},{value:"Fornecedores",label:"Fornecedores",code:"FN"},{value:"Inteligência",label:"Inteligência",code:"IA"},{value:"Configurações",label:"Configurações",code:"CF"},...(isPlatformOwner?[{value:"Administração",label:"Voltar ao Owner",code:"OW"}]:[])
 ];
 const items=ownerWorkspaceOnly?owner:client;
 return <aside className="hidden min-h-screen w-[236px] shrink-0 flex-col border-r border-slate-800 bg-[#091b2d] text-white lg:flex">
  <div className="flex h-[72px] items-center gap-3 border-b border-white/10 px-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-black shadow-lg shadow-blue-950/30">U</div><div><div className="text-base font-black leading-none tracking-tight">UNI</div><div className="mt-1 text-[11px] font-medium text-slate-300">LICITAÇÕES</div></div></div>
  <div className="px-4 pt-5"><p className="px-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{ownerWorkspaceOnly?"Gestão da plataforma":"Operação"}</p></div>
  <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">{items.map(item=>{const on=selected(active,item.value);return <button key={item.value} onClick={()=>onNavigate(item.value)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${on?"bg-blue-600 font-bold text-white shadow-lg shadow-blue-950/20":"font-medium text-slate-300 hover:bg-white/[.07] hover:text-white"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-black ${on?"bg-white/15":"bg-white/[.06] text-slate-400"}`}>{item.code}</span><span className="truncate">{item.label}</span></button>})}</nav>
  <div className="m-3 rounded-xl border border-white/10 bg-white/[.04] p-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400"/><p className="text-xs font-bold">UNI operacional</p></div><p className="mt-1.5 text-[11px] leading-4 text-slate-400">{ownerWorkspaceOnly?"Supervisione clientes e acesse cada ambiente sem misturar dados.":"Acompanhe prioridades e avance pelo método UNI."}</p></div>
 </aside>;
}
