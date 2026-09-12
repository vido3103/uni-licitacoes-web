"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "register";

const onlyDigits = (value: string) => value.replace(/\D/g, "").slice(0, 14);
const maskCnpj = (value: string) => onlyDigits(value)
  .replace(/^(\d{2})(\d)/, "$1.$2")
  .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
  .replace(/\.(\d{3})(\d)/, ".$1/$2")
  .replace(/(\d{4})(\d)/, "$1-$2");

export default function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const cnpjDigits = useMemo(() => onlyDigits(cnpj), [cnpj]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let mounted = true;
    void client.auth.getSession().then(({ data }) => {
      if (mounted) setAuthenticated(Boolean(data.session));
    }).catch(() => {
      if (mounted) setAuthenticated(false);
    }).finally(() => {
      if (mounted) setReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setAuthenticated(Boolean(session));
        setReady(true);
      }
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase || loading) return;
    setLoading(true); setError(""); setSuccess("");
    try {
      const normalized = login.trim().toUpperCase();
      if (!normalized.startsWith("UNI-")) {
        setError("Informe seu usuário UNI. Ex.: UNI-EMPRESA");
        return;
      }
      const { data, error: invokeError } = await supabase.functions.invoke("uni-login", { body: { login: normalized, password } });
      if (invokeError || !data?.access_token || !data?.refresh_token) {
        setError("Não foi possível entrar. Confira usuário e senha ou confirme se seu acesso já foi aprovado.");
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      if (sessionError) {
        setError("Não foi possível iniciar sua sessão. Tente novamente.");
        return;
      }
      setAuthenticated(true);
    } catch {
      setError("O acesso ao UNI está temporariamente indisponível. Tente novamente.");
    } finally { setLoading(false); }
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    if (!supabase || loading) return;
    setLoading(true); setError(""); setSuccess("");
    try {
      const normalized = login.trim().toUpperCase();
      if (cnpjDigits.length !== 14) throw new Error("Informe um CNPJ válido com 14 dígitos.");
      if (!normalized.startsWith("UNI-")) throw new Error("O usuário deve começar com UNI-. Ex.: UNI-LUVI");
      if (password.length < 8) throw new Error("A senha deve ter no mínimo 8 caracteres.");
      const { data, error: invokeError } = await supabase.functions.invoke("company-access-requests", {
        body: { action: "create", cnpj: cnpjDigits, email: email.trim().toLowerCase(), login: normalized, password },
      });
      if (invokeError || !data?.ok) throw new Error(data?.detail || "Não foi possível concluir a solicitação.");
      setSuccess("Cadastro recebido. Sua empresa está aguardando aprovação do Owner do UNI. Após a liberação, use seu usuário UNI e senha para entrar.");
      setCnpj(""); setEmail(""); setLogin(""); setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir a solicitação.");
    } finally { setLoading(false); }
  }

  if (!ready) return <div className="grid min-h-screen place-items-center bg-slate-950 text-white"><p className="text-sm text-slate-300">Carregando UNI...</p></div>;
  if (!supabase) return <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white"><div className="max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8"><h1 className="text-xl font-bold">UNI indisponível</h1><p className="mt-3 text-sm text-slate-300">A conexão segura com o ambiente de dados não foi carregada.</p></div></div>;
  if (authenticated) return <>{children}</>;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
        <div className="mb-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">U</div>
          <h1 className="text-2xl font-bold text-slate-900">{mode === "login" ? "Acessar UNI" : "Cadastrar empresa"}</h1>
          <p className="mt-1 text-sm text-slate-500">{mode === "login" ? "Use seu usuário UNI e a senha cadastrada." : "Solicite acesso. O ambiente só será liberado após aprovação do Owner."}</p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button type="button" onClick={() => { setMode("login"); setError(""); setSuccess(""); }} className={`rounded-lg px-3 py-2 ${mode === "login" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>Entrar</button>
          <button type="button" onClick={() => { setMode("register"); setError(""); setSuccess(""); }} className={`rounded-lg px-3 py-2 ${mode === "register" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>Cadastrar empresa</button>
        </div>

        <form onSubmit={mode === "login" ? signIn : register}>
          {mode === "register" && <>
            <label className="block text-sm font-semibold text-slate-700">CNPJ<input required inputMode="numeric" value={maskCnpj(cnpj)} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" /></label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">E-mail<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" /></label>
          </>}
          <label className={`${mode === "register" ? "mt-4" : ""} block text-sm font-semibold text-slate-700`}>Usuário UNI<input autoComplete="username" required value={login} onChange={(e) => setLogin(e.target.value)} placeholder={mode === "register" ? "UNI-LUVI" : "UNI-EMPRESA"} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 uppercase outline-none focus:border-blue-500" /></label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">Senha<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500" /></label>
          {error && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {success && <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-5 text-emerald-800">{success}</p>}
          <button type="submit" disabled={loading} className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{loading ? "Processando..." : mode === "login" ? "Entrar" : "Enviar solicitação"}</button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">Acesso protegido · UNI Licitações</p>
      </div>
    </main>
  );
}
