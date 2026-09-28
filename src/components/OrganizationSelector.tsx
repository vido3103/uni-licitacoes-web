"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getActiveOrganizationId,
  organizationLabel,
  setActiveOrganizationId,
  type OrganizationMembership,
} from "@/lib/activeOrganization";

export default function OrganizationSelector() {
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSelection, setNeedsSelection] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;
    let mounted = true;

    const hideSelector = () => {
      if (!mounted) return;
      setOrganizations([]);
      setNeedsSelection(false);
      setLoading(false);
    };

    const loadOrganizations = async () => {
      if (!mounted) return;
      setLoading(true);
      try {
        const { data, error } = await client.rpc("get_my_uni_identity");
        if (error) throw error;

        const identity = data as {
          platform_role?: string;
          memberships?: OrganizationMembership[];
        } | null;
        const memberships = (
          Array.isArray(identity?.memberships) ? identity.memberships : []
        ).filter(
          (membership) =>
            typeof membership.client_id === "string" &&
            membership.client_id.length > 0,
        );

        if (!mounted) return;
        setOrganizations(memberships);
        const isPlatformOwner = identity?.platform_role === "platform_owner";
        setNeedsSelection(
          !isPlatformOwner &&
            memberships.length > 1 &&
            !getActiveOrganizationId(),
        );
      } catch (error) {
        // O seletor é auxiliar e nunca pode bloquear login/navegação quando a
        // sessão ainda não foi restaurada ou o RPC estiver temporariamente
        // indisponível. AuthGate continua sendo a autoridade de autenticação.
        console.error("organization_selector_identity_failed", error);
        if (mounted) setNeedsSelection(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void client.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        if (data.session) void loadOrganizations();
        else hideSelector();
      })
      .catch(hideSelector);

    const { data: authListener } = client.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        if (session) void loadOrganizations();
        else hideSelector();
      },
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  function choose(id: string) {
    setActiveOrganizationId(id);
    window.location.reload();
  }

  if (loading || !needsSelection) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="organization-selector-title"
    >
      <div className="w-full max-w-xl rounded-2xl border border-blue-100 bg-white p-6 shadow-2xl">
        <h1
          id="organization-selector-title"
          className="text-xl font-black text-[#08245c]"
        >
          Selecione a empresa ativa
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sua conta está vinculada a mais de uma organização. Escolha em qual
          empresa deseja trabalhar. O Veence não selecionará um CNPJ
          automaticamente.
        </p>
        <div className="mt-5 grid gap-3">
          {organizations.map((organization) => {
            const id = organization.client_id;
            if (!id) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <span className="block text-sm font-black text-[#08245c]">
                  {organizationLabel(organization)}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Acessar esta organização
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
