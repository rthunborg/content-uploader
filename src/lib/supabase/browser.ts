import { createBrowserClient } from "@supabase/ssr";

import { publicSupabaseEnvironment } from "./env";

export function createBrowserSupabaseClient() {
  const { url, publishableKey } = publicSupabaseEnvironment();
  return createBrowserClient(url, publishableKey);
}
