"use client";

import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import {getActiveOrganizationId,organizationLabel,setActiveOrganizationId,type OrganizationMembership} from "@/lib/activeOrganization";

export default function OrganizationSelector(){
  const[organizations,setOrganizations]=useState<OrganizationMembership[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[needsSelection,setNeedsSelection]=useState(false);

  useEffect(()=>{if(!supabase){setLoading(false);return}void(async()=>{try{const{data,error:e}=await supabase.rpc("get_my_uni_identity");if(e)throw e;const identity=data as{platform_role?:string;memberships?:OrganizationMembership[]}|null;const memberships=(Array.isArray(identity?.memberships)?identity.memberships:[]).filter(m=>typeof m.client_id==="string"&&m.client_id.length>0);setOrganizations(memberships);const isPlatformOwner=identity?.platform_role==="platform_owner";setNeedsSelection(!isPlatformOwner&&memberships.length>1&&!getActiveOrganizationId())}catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar as empresas.");setNeedsSelection(true)}finally{setLoading(false)}})()},[]);

  function choose(id:string){setActiveOrganizationId(id);window.location.reload()}

  if(loading||!needsSelection)return null;

  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="organization-selector-title"><div className="w-full max-w-xl rounded-2xl border border-blue-100 bg-white p-6 shadow-2xl"><h1 id="organization-selector-title" className="text-xl font-black text-[#08245c]">Selecione a empresa ativa</h1><p className="mt-2 text-sm leading-6 text-slate-600">Sua conta está vinculada a mais de uma organização. Escolha em qual empresa deseja trabalhar. O Veence não selecionará um CNPJ automaticamente.</p>{error?<p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>:<div className="mt-5 grid gap-3">{organizations.map(org=>{const id=org.client_id;if(!id)return null;return <button key={id} type="button" onClick={()=>choose(id)} className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"><span className="block text-sm font-black text-[#08245c]">{organizationLabel(org)}</span><span className="mt-1 block text-xs text-slate-500">Acessar esta organização</span></button>})}</div>}</div></div>;
}
