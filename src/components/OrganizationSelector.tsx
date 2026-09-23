"use client";

import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
import {organizationLabel,setActiveOrganizationId,type OrganizationMembership} from "@/lib/activeOrganization";

export default function OrganizationSelector(){
  const[organizations,setOrganizations]=useState<OrganizationMembership[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");

  useEffect(()=>{if(!supabase){setLoading(false);return}void(async()=>{try{const{data,error:e}=await supabase.rpc("get_my_uni_identity");if(e)throw e;const identity=data as{memberships?:OrganizationMembership[]}|null;setOrganizations(Array.isArray(identity?.memberships)?identity.memberships:[])}catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar as empresas.")}finally{setLoading(false)}})()},[]);

  function choose(id:string){setActiveOrganizationId(id);window.location.reload()}

  if(loading)return <p className="mt-4 text-sm text-amber-900">Carregando empresas...</p>;
  if(error)return <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if(!organizations.length)return <p className="mt-4 text-sm text-amber-900">Nenhuma empresa ativa está vinculada à sua conta.</p>;

  return <div className="mt-5 grid gap-3">{organizations.map(org=><button key={org.client_id} type="button" onClick={()=>choose(org.client_id)} className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"><span className="block text-sm font-black text-[#08245c]">{organizationLabel(org)}</span><span className="mt-1 block text-xs text-slate-500">Acessar esta organização</span></button>)}</div>;
}
