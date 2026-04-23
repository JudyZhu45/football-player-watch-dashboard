import { createClient } from "@supabase/supabase-js";

import { getWorkerEnv } from "./env";

export function createSupabaseAdmin() {
  const env = getWorkerEnv();
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

