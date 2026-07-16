import "server-only";

import { revokeUserSessionsById } from "@/lib/auth";

type AdminAuth = { auth: { admin: { signOut(userId: string, scope: "global"): Promise<{ error: unknown }> } } };

export async function revokeAllUserSessions(userId: string, client?: AdminAuth) {
  if (client) {
    const { error } = await client.auth.admin.signOut(userId, "global");
    if (error) throw new Error("Global session revocation failed", { cause: error });
    return;
  }
  await revokeUserSessionsById(userId);
}
