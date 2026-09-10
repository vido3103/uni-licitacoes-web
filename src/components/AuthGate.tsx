"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(Boolean(data.session));
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setAuthenticated(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError("Não foi possível entrar. Confira e-mail e senha.");
    setLoading(false);
  }

  if (!ready) return <div className="grid min-h-screen place-items-center bg-slate-950 text-white">Carregando...</div>;

  if (!supabase) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
        <div className="max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8">
          <h1 className="text-xl font-bold">Ambiente de integração</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">A interface está pronta para o Supabase. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no ambiente de Preview para ativar autenticação e dados reais.</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 p-6">
        <form onSubmit={signIn} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
          <div className="mb-6"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">U</div><h1 className="text-2xl font-bold text-slate-900">Acessar UNI</h1><p className="mt-1 text-sm text-slate-500">Entre para acessar o ambiente da sua empresa.</p></div>
          <label className="block text-sm font-semibold text-slate-700">E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" /></label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">Senha<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" /></label>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          <button disabled={loading} className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{loading ? "Entrando..." : "Entrar"}</button>
        </form>
      </main>
    );
  }

  return <>{children}</>;
}
