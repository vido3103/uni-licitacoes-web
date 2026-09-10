"use client";

import { FormEvent, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Lookup = {
  cnpj:string; legal_name:string|null; trade_name:string|null; registration_status:string|null;
  opened_at:string|null; city:string|null; state:string|null; street:string|null; number:string|null;
  complement:string|null; district:string|null; postal_code:string|null; cnaes:Array<{codigo:string;descricao:string|null;principal:boolean}>;
  source:string; raw_reference?:Record<string,unknown>;
};

function formatCnpj(value:string){const d=value.replace(/\D/g,"").slice(0,14);return d.replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2")}
function errorText(e:unknown){if(e instanceof Error)return e.message; if(typeof e==="object"&&e&&"message" in e)return String((e as {message?:unknown}).message||"Erro inesperado");return String(e||"Erro inesperado")}

export default function CompanyOnboarding(){
  const [cnpj,setCnpj]=useState(""); const [lookup,setLookup]=useState<Lookup|null>(null); const [loading,setLoading]=useState(false); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const [done,setDone]=useState<{client_id:string;login:string;status:string}|null>(null);
  const digits=useMemo(()=>cnpj.replace(/\D/g,""),[cnpj]);

  async function consult(e:FormEvent){e.preventDefault();if(!supabase)return;setLoading(true);setError("");setLookup(null);setDone(null);try{if(digits.length!==14)throw new Error("Informe um CNPJ com 14 dígitos.");const {data,error}=await supabase.functions.invoke("cnpj-lookup",{body:{cnpj:digits}});if(error)throw error;if(!data?.ok)throw new Error(data?.error||"Não foi possível consultar o CNPJ.");setLookup(data as Lookup)}catch(e){setError(errorText(e))}finally{setLoading(false)}}
  async function confirm(){if(!supabase||!lookup)return;setSaving(true);setError("");try{const {data,error}=await supabase.rpc("start_company_onboarding",{p_cnpj:lookup.cnpj,p_legal_name:lookup.legal_name||lookup.trade_name||"Empresa",p_trade_name:lookup.trade_name,p_city:lookup.city,p_state:lookup.state,p_cnaes:lookup.cnaes,p_source_data:{provider:lookup.source,queried_at:new Date().toISOString(),registration_status:lookup.registration_status,opened_at:lookup.opened_at,address:{street:lookup.street,number:lookup.number,complement:lookup.complement,district:lookup.district,postal_code:lookup.postal_code}}});if(error)throw error;setDone(data as {client_id:string;login:string;status:string})}catch(e){setError(errorText(e))}finally{setSaving(false)}}

  return <div className="mx-auto max-w-5xl p-5 sm:p-8">
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Onboarding empresarial</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Cadastro inicial por CNPJ</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Consulte o CNPJ, confira os dados cadastrais encontrados e confirme a criação da empresa. A validação documental pelo Cartão CNPJ será a próxima etapa antes da habilitação SICAF.</p></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <form onSubmit={consult} className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-semibold text-slate-700">CNPJ<input value={cnpj} onChange={e=>setCnpj(formatCnpj(e.target.value))} inputMode="numeric" placeholder="00.000.000/0000-00" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/></label><button disabled={loading||digits.length!==14} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading?"Consultando...":"Consultar CNPJ"}</button></form>
      {error&&<div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    </div>
    {lookup&&<div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-600">CNPJ localizado</p><h2 className="mt-1 text-xl font-bold text-slate-900">{lookup.trade_name||lookup.legal_name}</h2><p className="mt-1 text-sm text-slate-500">{lookup.legal_name}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Fonte: {lookup.source}</span></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Info label="CNPJ" value={formatCnpj(lookup.cnpj)}/><Info label="Situação cadastral" value={lookup.registration_status||"Não informada"}/><Info label="Município / UF" value={[lookup.city,lookup.state].filter(Boolean).join(" / ")||"Não informado"}/><Info label="Início da atividade" value={lookup.opened_at||"Não informado"}/><Info label="CNAE principal" value={lookup.cnaes.find(x=>x.principal)?.descricao||lookup.cnaes.find(x=>x.principal)?.codigo||"Não informado"}/><Info label="Quantidade de CNAEs" value={String(lookup.cnaes.length)}/></div>
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Validação ainda pendente.</strong> Confirmar estes dados cria o cadastro em estado de onboarding. O Cartão CNPJ deverá ser anexado e confrontado antes de marcar o cadastro empresarial como validado.</div>
      <button onClick={confirm} disabled={saving} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving?"Criando cadastro...":"Confirmar e criar empresa"}</button></div>}
    {done&&<div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><p className="text-sm font-bold text-emerald-800">Cadastro criado com sucesso</p><p className="mt-2 text-sm text-emerald-900">Status: <strong>{done.status}</strong>. Acesso associado: <strong>{done.login}</strong>.</p><p className="mt-1 text-xs text-emerald-700">ID interno: {done.client_id}</p></div>}
  </div>
}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>}
