import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { requireUser, where, limit } = vi.hoisted(() => ({ requireUser: vi.fn(), where: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser }));
vi.mock("@/db/client", () => ({ getDatabase: () => ({ select: () => ({ from: () => ({ where }) }) }) }));
import { getOwnProfile } from "./ambassador";

describe("ambassador profile DAL", () => {
  it("scopes by actor id and omits admin-only runtime fields", async () => {
    requireUser.mockResolvedValue({ userId: "own-id" });
    where.mockReturnValue({ limit });
    limit.mockResolvedValue([{ id: "own-id", email: "a@example.test", mobile: null, accountState: "active" }]);
    const result = await getOwnProfile();
    expect(where).toHaveBeenCalledOnce();
    const containsOwnId = (value: unknown, seen = new WeakSet<object>()): boolean => {
      if (value === "own-id") return true;
      if (!value || typeof value !== "object" || seen.has(value)) return false;
      seen.add(value);
      return Object.values(value).some((nested) => containsOwnId(nested, seen));
    };
    expect(containsOwnId(where.mock.calls[0][0])).toBe(true);
    expect(result).toEqual({ id: "own-id", email: "a@example.test", mobile: null, accountState: "active" });
    expect(result).not.toHaveProperty("invitedAt");
  });
});
