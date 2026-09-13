"use client";

import { useMemo, useState } from "react";

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
};

const norm=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();

export default function MultiSelectFilter({label,options,selected,onChange,emptyLabel="Nenhuma selecionada"}:Props){
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState("");
  const uniqueOptions=useMemo(()=>[...new Set(options.filter(Boolean))],[options]);
  const visible=uniqueOptions.filter(o=>norm(o).includes(norm(search)));
  const allSelected=uniqueOptions.length>0&&uniqueOptions.every(o=>selected.includes(o));
  const summary=selected.length===0?emptyLabel:allSelected?"Todas":selected.length===1?selected[0]:`${selected[0]} +${selected.length-1}`;

  function toggle(value:string){
    onChange(selected.includes(value)?selected.filter(x=>x!==value):[...selected,value]);
  }

  function selectAll(){
    onChange([...uniqueOptions]);
  }

  return <div className="relative min-w-0">
    <button type="button" onClick={()=>setOpen(v=>!v)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-xs">
      <span className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</span><span className="block truncate font-semibold text-slate-700">{summary}</span></span><span className="text-slate-400">⌄</span>
    </button>
    {open&&<div className="absolute left-0 top-full z-40 mt-1 w-full min-w-[240px] rounded-xl border bg-white p-2 shadow-xl">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Buscar ${label.toLowerCase()}...`} className="mb-2 w-full rounded-lg border px-3 py-2 text-xs"/>
      <button type="button" onClick={selectAll} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold hover:bg-slate-50">
        <span className={`flex h-4 w-4 items-center justify-center rounded border ${allSelected?"border-blue-600 bg-blue-600 text-white":"border-slate-300"}`}>{allSelected?"✓":""}</span>Todas as opções
      </button>
      <div className="max-h-60 overflow-y-auto">{visible.map(o=><button key={o} type="button" onClick={()=>toggle(o)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-slate-50"><span className={`flex h-4 w-4 items-center justify-center rounded border ${selected.includes(o)?"border-blue-600 bg-blue-600 text-white":"border-slate-300"}`}>{selected.includes(o)?"✓":""}</span><span className="truncate">{o}</span></button>)}</div>
      <div className="mt-2 flex justify-between border-t pt-2"><button type="button" onClick={()=>onChange([])} className="px-2 py-1 text-[10px] font-semibold text-blue-700">Limpar</button><button type="button" onClick={()=>setOpen(false)} className="rounded-lg bg-blue-700 px-3 py-1.5 text-[10px] font-bold text-white">Aplicar</button></div>
    </div>}
  </div>;
}
