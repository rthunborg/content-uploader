import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { revokeAllUserSessions } from "./revocation";
describe("global revocation", () => {
  it("uses global sign-out and is idempotent", async () => { const signOut = vi.fn().mockResolvedValue({ error: null }); const client = { auth: { admin: { signOut } } }; await revokeAllUserSessions("user-1", client); await revokeAllUserSessions("user-1", client); expect(signOut).toHaveBeenCalledTimes(2); expect(signOut).toHaveBeenCalledWith("user-1", "global"); });
});
