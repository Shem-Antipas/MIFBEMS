import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";
let supabaseClient = null;
export const getSupabaseAdminClient = () => {
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
