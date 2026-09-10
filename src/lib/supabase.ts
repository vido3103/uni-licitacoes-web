import { createClient } from "@supabase/supabase-js";

// Public browser configuration. Environment variables remain the preferred
// deployment configuration; these publishable fallbacks keep the production
// login available if Vercel loses its public build-time variables.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://oaakuckvzxeekyqmvsza.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_V5jfluvamfHHf1_YWUEngA_MCr_yjlM";

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
