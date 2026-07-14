import { createBrowserClient } from "@supabase/ssr";

import { publicSupabaseEnvironment } from "./env";

export function createBrowserSupabaseClient() {
  const { url, publishableKey } = publicSupabaseEnvironment();
  const client = createBrowserClient(url, publishableKey);
  // Deliberately expose neither `.from()` nor broad Storage operations. TUS only
  // needs the current bearer token; upload transport owns the resumable endpoint.
  return {
    auth: client.auth,
    async getTusAccessToken() {
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error("Unable to load upload session", { cause: error });
      return data.session?.access_token ?? null;
    },
  } as const;
}
