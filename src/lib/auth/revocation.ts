import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type AdminAuth = { auth: { admin: { signOut(userId: string, scope: "global"): Promise<{ error: unknown }> } } };

export async function revokeAllUserSessions(userId: string, client: AdminAuth = createAdminSupabaseClient()) {
  const { error } = await client.auth.admin.signOut(userId, "global");
  if (error) throw new Error("Global session revocation failed", { cause: error });
}
