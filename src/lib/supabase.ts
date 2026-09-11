import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser clients use only publishable configuration. These values are public by
// design and are safe to ship to the browser. Environment variables remain the
// preferred override, while the checked-in fallback prevents production from
// becoming unavailable if Vercel project variables are missing or not inherited.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://oaakuckvzxeekyqmvsza.supabase.co";

const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_V5jfluvamfHHf1_YWUEngA_MCr_yjlM";

export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
