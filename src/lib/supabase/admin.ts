import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function required(name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

let client: SupabaseClient | undefined;
export function createAdminSupabaseClient() {
  client ??= createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
