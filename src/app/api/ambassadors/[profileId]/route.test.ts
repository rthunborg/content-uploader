import { beforeEach, describe, expect, it, vi } from "vitest";
const getProfileForAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/features/ambassadors/dal/admin", () => ({ getProfileForAdmin }));
import { DomainError } from "@/lib/errors";
import { GET } from "./route";
describe("GET /api/ambassadors/[profileId]", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([["NOT_FOUND", 404], ["AUTH_REQUIRED", 401], ["FORBIDDEN", 403]] as const)("returns the canonical %s envelope", async (code, status) => { getProfileForAdmin.mockRejectedValue(new DomainError(code)); const response = await GET(new Request("http://local") as never, { params: Promise.resolve({ profileId: "bad" }) }); expect(response.status).toBe(status); expect(await response.json()).toMatchObject({ error: { code } }); });
  it("forwards the id and returns the exact successful payload", async () => { const payload = { id: "00000000-0000-4000-8000-000000000001", fullName: "Anna Andersson", email: "anna@example.test", mobile: "+46700000000", accountState: "active", invitedAt: null, lastLoginAt: "2026-07-15T10:00:00.000Z" }; getProfileForAdmin.mockResolvedValue(payload); const response = await GET(new Request("http://local") as never, { params: Promise.resolve({ profileId: payload.id }) }); expect(getProfileForAdmin).toHaveBeenCalledWith(payload.id); expect(response.status).toBe(200); expect(await response.json()).toEqual(payload); });
});
