"use client";

import {useEffect,useState} from "react";

type SidebarProps={active:string;onNavigate:(module:string)=>void;showCliente?:boolean;ownerWorkspaceOnly?:boolean;isPlatformOwner?:boolean};
type NavItem={value:string;label:string;icon:string};

function selected(active:string,value:string){
  if(active===value)return true;
  if(value==="Painel"&&active==="Dashboard")return true;
  if(value==="Oportunidades"&&(active==="Radar"||active==="Editais"))return true;
  if(value==="Negócios"&&(active==="CFP"||active==="Gate Econômico"||active==="Gate de Participação"||active==="Disputa"))return true;
  if(value==="Relatórios"&&active==="Inteligência")return false;
  if(value==="Empresa"&&active==="Empresas")return true;
  if(value==="Habilitação"&&active==="SICAF")return true;
  return false;
}

export default function Sidebar({active,onNavigate,ownerWorkspaceOnly=false,isPlatformOwner=false}:SidebarProps){
 const[collapsed,setCollapsed]=useState(false);
 useEffect(()=>{setCollapsed(window.localStorage.getItem("uni-sidebar-collapsed")==="1")},[]);
 function toggle(){setCollapsed(v=>{const next=!v;window.localStorage.setItem("uni-sidebar-collapsed",next?"1":"0");return next})}
 function goHome(){onNavigate(ownerWorkspaceOnly?"Administração":"Painel")}
 const owner:NavItem[]=[
  {value:"Administração",label:"Painel",icon:"⌂"},{value:"Clientes",label:"Clientes",icon:"●"},{value:"Oportunidades",label:"Oportunidades",icon:"⌕"},{value:"Negócios",label:"Negócios",icon:"▣"},{value:"Inteligência",label:"Inteligência",icon:"▥"},{value:"Habilitação",label:"Habilitação",icon:"▤"},{value:"Documentos",label:"Documentos",icon:"▱"},{value:"Usuários",label:"Usuários",icon:"♟"},{value:"Relatórios",label:"Relatórios",icon:"▥"},{value:"Configurações",label:"Configurações",icon:"⚙"}
 ];
 const client:NavItem[]=[
  {value:"Painel",label:"Painel",icon:"⌂"},{value:"Oportunidades",label:"Oportunidades",icon:"⌕"},{value:"Negócios",label:"Negócios",icon:"▣"},{value:"Inteligência",label:"Inteligência",icon:"▥"},{value:"Habilitação",label:"Habilitação",icon:"▤"},{value:"Documentos",label:"Documentos",icon:"▱"},{value:"Empresa",label:"Empresa",icon:"▦"},{value:"Fornecedores",label:"Fornecedores",icon:"◇"},{value:"Configurações",label:"Configurações",icon:"⚙"},...(isPlatformOwner?[{value:"Administração",label:"Voltar ao Owner",icon:"↩"}]:[])
 ];
 const items=ownerWorkspaceOnly?owner:client;
 return <aside className={`uni-sidebar hidden min-h-screen shrink-0 flex-col bg-[#002945] text-white transition-[width] duration-200 lg:flex ${collapsed?"w-[78px]":"w-[168px]"}`}>
  <div className={`flex min-h-[68px] items-center border-b border-white/10 ${collapsed?"justify-center px-2":"justify-between px-4"}`}>
   <button type="button" onClick={goHome} title="Voltar ao início" aria-label="Voltar ao Dashboard" className={`group flex items-center rounded-lg transition hover:bg-white/[.06] ${collapsed?"justify-center p-1":"gap-2 p-1"}`}>
    <div className="relative flex h-11 w-12 shrink-0 items-center justify-center text-[27px] font-black tracking-[-.08em] text-white">UNI<span className="absolute bottom-0 right-0 h-3 w-[3px] bg-[#f13b3f]"/></div>
    {!collapsed&&<div className="text-left"><div className="text-[10px] font-extrabold tracking-[.18em] text-white">LICITAÇÕES</div></div>}
   </button>
   {!collapsed&&<button type="button" onClick={toggle} title="Recolher menu" aria-label="Recolher menu lateral" className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">‹</button>}
  </div>
  {!collapsed&&<div className="border-b border-white/10 px-4 py-3"><div className="rounded-md border border-[#0a7dd8] bg-[#00395d] px-3 py-2 text-center"><p className="text-[11px] font-black tracking-wide">{ownerWorkspaceOnly?"OWNER":"LUVI"}</p><p className="text-[10px] text-slate-200">{ownerWorkspaceOnly?"Administração":"Cliente"}</p></div></div>}
  {collapsed&&<div className="flex justify-center py-2"><button type="button" onClick={toggle} title="Expandir menu" aria-label="Expandir menu lateral" className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10">›</button></div>}
  <nav className={`flex-1 overflow-y-auto py-2 ${collapsed?"px-2":"px-0"}`}>{items.map(item=>{const on=selected(active,item.value);return <button type="button" key={item.value} onClick={()=>onNavigate(item.value)} title={collapsed?item.label:undefined} aria-label={item.label} className={`flex w-full items-center text-left text-[13px] transition ${collapsed?"justify-center rounded-lg px-2 py-3":"gap-3 px-5 py-3"} ${on?"bg-[#0a66f5] font-semibold text-white":"font-medium text-slate-100 hover:bg-white/[.07]"}`}><span className="grid h-5 w-5 shrink-0 place-items-center text-[17px] leading-none text-white">{item.icon}</span>{!collapsed&&<span className="truncate">{item.label}</span>}</button>})}</nav>
  {!collapsed&&<div className="border-t border-white/10 px-4 py-3"><button type="button" className="mb-2 flex w-full items-center gap-3 py-1 text-left text-[13px] text-slate-100"><span className="text-base">?</span><span>Ajuda</span></button><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent("uni-request-signout"))} className="flex w-full items-center gap-3 py-1 text-left text-[13px] text-slate-100"><span className="text-base">↪</span><span>Sair</span></button><button type="button" onClick={goHome} className="mt-5 w-full text-left"><div className="relative inline-flex text-[26px] font-black tracking-[-.08em]">UNI<span className="absolute -right-1 bottom-1 h-3 w-[3px] bg-[#ef3d46]"/></div><div className="text-[9px] font-bold tracking-[.18em]">LICITAÇÕES</div><div className="mt-1 text-[10px] leading-4 text-cyan-300">Inteligência que<br/>gera resultados</div></button></div>}
 </aside>;
}
