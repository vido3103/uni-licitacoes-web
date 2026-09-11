import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser clients use only publishable configuration injected at build time.
// Secret/service-role credentials must never be exposed through NEXT_PUBLIC_*.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
