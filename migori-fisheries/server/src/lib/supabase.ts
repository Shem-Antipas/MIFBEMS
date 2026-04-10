import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseAdminClient = (): SupabaseClient | null => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseClient;
};
