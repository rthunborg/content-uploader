import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createAuthGuards } from "@/lib/auth";
import { revokeAllUserSessions } from "./revocation";

function env() {
  const output = execFileSync("npx", ["supabase", "status", "--output", "env"], { encoding: "utf8" });
  return Object.fromEntries(output.split("\n").map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/)).filter((match): match is RegExpMatchArray => Boolean(match)).map((match) => [match[1], match[2]]));
}

describe("local all-device revocation evidence", () => {
  it("denies the other device and reaches canonical revoked-session login behavior", async () => {
    const local = env();
    const service = createClient(local.API_URL, local.SERVICE_ROLE_KEY);
    const email = `revoke-${Date.now()}@example.test`;
    const created = await service.auth.admin.createUser({ email, email_confirm: true });
    expect(created.error).toBeNull(); const userId = created.data.user!.id;
    try {
      const clients = [];
      let devicesRemaining = 2;
      while (devicesRemaining > 0) {
        devicesRemaining -= 1;
        const link = await service.auth.admin.generateLink({ type: "magiclink", email });
        const client = createClient(local.API_URL, local.ANON_KEY);
        expect((await client.auth.verifyOtp({ token_hash: link.data.properties!.hashed_token, type: "magiclink" })).error).toBeNull();
        clients.push(client);
      }
      const session = await clients[0].auth.getSession();
      const jwt = session.data.session?.access_token;
      if (!jwt) throw new Error("First device session is missing");
      // supabase-js exposes the global logout endpoint by user JWT rather than
      // user id; adapt it here while retaining the application primitive's
      // user-id contract used by mutation owners.
      const localAdminAdapter = { auth: { admin: { signOut: (_userId: string, scope: "global") => service.auth.admin.signOut(jwt, scope) } } };
      await revokeAllUserSessions(userId, localAdminAdapter);
      const otherDevice = clients[1];
      const guards = createAuthGuards({
        getAuth: async () => {
          const session = await otherDevice.auth.getSession();
          const user = await otherDevice.auth.getUser();
          return { user: user.data.user, hadSession: Boolean(session.data.session) };
        },
        getProfile: vi.fn(), consent: { hasCurrentConsent: vi.fn() },
      });
      await expect(guards.requireUser()).rejects.toMatchObject({ code: "SESSION_REVOKED", remedy: { action: "login" } });
    } finally { await service.auth.admin.deleteUser(userId); }
  }, 30_000);
});
