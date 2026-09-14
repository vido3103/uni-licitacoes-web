import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const U = Deno.env.get("SUPABASE_URL")!;
const legacyServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
const adminKey = legacyServiceRole || (secretKeys ? JSON.parse(secretKeys)["default"] : "");
if (!adminKey) throw new Error("admin_key_missing");

const db = createClient(U, adminKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const C = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...C, "content-type": "application/json", "cache-control": "no-store" },
  });

async function owner(req: Request) {
  const a = req.headers.get("authorization") || "";
  if (!a.toLowerCase().startsWith("bearer ")) return null;
  const token = a.slice(7).trim();
  if (!token) return null;
  const { data: u, error: ue } = await db.auth.getUser(token);
  if (ue || !u.user) return null;
  const { data: r, error: re } = await db
    .from("platform_user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "platform_owner")
    .eq("active", true)
    .maybeSingle();
  if (re || !r) return null;
  return u.user;
}

async function rm(bucket: string, paths: string[]) {
  let n = 0;
  for (let i = 0; i < paths.length; i += 1000) {
    const c = [...new Set(paths.slice(i, i + 1000).filter(Boolean))];
    if (!c.length) continue;
    const { error } = await db.storage.from(bucket).remove(c);
    if (error) throw new Error(`storage:${bucket}:${error.message}`);
    n += c.length;
  }
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: C });
  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);

  const u = await owner(req);
  if (!u) return j({ error: "platform_owner_required" }, 403);

  const b = await req.json().catch(() => ({}));
  if (b?.confirm !== "RESET_CLIENT_TENANT") return j({ error: "confirmation_required" }, 400);
  const ids = Array.isArray(b?.client_ids) ? b.client_ids.map(String).filter(Boolean) : [];
  if (!ids.length) return j({ error: "client_ids_required" }, 400);

  try {
    const { data: clients, error: ce } = await db
      .from("clients")
      .select("id,legal_name,display_name,status")
      .in("id", ids);
    if (ce) throw ce;
    if ((clients ?? []).length !== ids.length) return j({ error: "client_not_found", clients }, 404);

    const { data: members, error: me } = await db
      .from("client_members")
      .select("user_id")
      .in("client_id", ids);
    if (me) throw me;
    const authUsers = [...new Set((members ?? []).map((x: any) => x.user_id))];

    const [{ data: cd, error: cde }, { data: od, error: ode }] = await Promise.all([
      db.from("client_documents").select("storage_bucket,storage_path").in("client_id", ids),
      db.from("opportunity_documents").select("storage_bucket,storage_path").in("client_id", ids),
    ]);
    if (cde) throw cde;
    if (ode) throw ode;

    let physical_removed = 0;
    for (const rows of [cd ?? [], od ?? []]) {
      const by = new Map<string, string[]>();
      for (const x of rows as any[]) {
        if (!x.storage_bucket || !x.storage_path) continue;
        const a = by.get(x.storage_bucket) || [];
        a.push(x.storage_path);
        by.set(x.storage_bucket, a);
      }
      for (const [bucket, paths] of by) physical_removed += await rm(bucket, paths);
    }

    for (const uid of authUsers) {
      const { error: e } = await db.from("company_access_requests").delete().eq("user_id", uid);
      if (e) throw e;
    }

    const { error: del } = await db.from("clients").delete().in("id", ids);
    if (del) throw del;

    return j({
      ok: true,
      deleted_clients: clients,
      auth_users_preserved: authUsers,
      login_aliases_preserved: true,
      physical_files_removed: physical_removed,
    });
  } catch (e) {
    return j({ ok: false, error: "reset_failed", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
