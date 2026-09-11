"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthGate({ children }: { children: ReactNode }) {
  // Render the access screen immediately. This avoids a permanent
  // "Carregando UNI..." screen if session bootstrap is delayed on mobile browsers.
  const [ready, setReady] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    const bootstrap = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted) setAuthenticated(Boolean(data.session));
      } catch {
        // Keep the login screen usable even if session restoration fails.
        if (mounted) setAuthenticated(false);
      } finally {
        if (mounted) setReady(true);
      }
    };

    void bootstrap();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setAuthenticated(Boolean(session));
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase || loading) return;
    setLoading(true);
    setError("");

    try {
      const normalized = login.trim().toUpperCase();
      if (!normalized.startsWith("UNI-")) {
        setError("Informe seu usuário UNI. Ex.: UNI-EMPRESA");
        return;
      }

      const { data, error: invokeError } = await supabase.functions.invoke("uni-login", {
        body: { login: normalized, password },
      });

      if (invokeError || !data?.access_token || !data?.refresh_token) {
        setError("Não foi possível entrar. Confira usuário e senha.");
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionError) {
        setError("Não foi possível iniciar sua sessão. Tente novamente.");
        return;
      }

      setAuthenticated(true);
    } catch {
      setError("O acesso ao UNI está temporariamente indisponível. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 font-bold">U</div>
          <p className="text-sm text-slate-300">Carregando UNI...</p>
        </div>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
        <div className="max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8">
          <h1 className="text-xl font-bold">UNI indisponível</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            A conexão segura com o ambiente de dados não foi carregada. Atualize a página; se persistir, contate a administração do UNI.
          </p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 p-6">
        <form onSubmit={signIn} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
          <div className="mb-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">U</div>
            <h1 className="text-2xl font-bold text-slate-900">Acessar UNI</h1>
            <p className="mt-1 text-sm text-slate-500">Use seu usuário UNI e a senha cadastrada.</p>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Usuário
            <input
              autoComplete="username"
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="UNI-EMPRESA"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 uppercase outline-none focus:border-blue-500"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Senha
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
            />
          </label>
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
          <p className="mt-4 text-center text-xs text-slate-400">Acesso protegido · UNI Licitações</p>
        </form>
      </main>
    );
  }

  return <>{children}</>;
}
