import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  revokeUserSessionsById: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  revokeUserSessionsById: mocks.revokeUserSessionsById,
}));
import { revokeAllUserSessions } from "./revocation";
describe("global revocation", () => {
  it("uses global sign-out and is idempotent", async () => { const signOut = vi.fn().mockResolvedValue({ error: null }); const client = { auth: { admin: { signOut } } }; await revokeAllUserSessions("user-1", client); await revokeAllUserSessions("user-1", client); expect(signOut).toHaveBeenCalledTimes(2); expect(signOut).toHaveBeenCalledWith("user-1", "global"); });
  it("revokes every application session for a user id by default", async () => {
    mocks.revokeUserSessionsById.mockResolvedValue(undefined);

    await revokeAllUserSessions("00000000-0000-4000-8000-000000000001");

    expect(mocks.revokeUserSessionsById).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
  });
});
