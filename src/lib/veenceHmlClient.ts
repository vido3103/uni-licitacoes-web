import { createClient } from "@supabase/supabase-js";

// This publishable key identifies only the isolated VEENCE-HML project.
// The service role and AI Gateway credentials exist exclusively in Edge Functions.
export const HML_URL = "https://tabuualydbcqnsdsgega.supabase.co";
export const HML_PUBLISHABLE_KEY = "sb_publishable_E1kbWnXYyV5YKNVIovzl7A_u0gNA30u";

export const veenceHml = createClient(HML_URL, HML_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
