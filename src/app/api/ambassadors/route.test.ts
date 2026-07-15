import { beforeEach, describe, expect, it, vi } from "vitest";
const listAmbassadors = vi.hoisted(() => vi.fn());
vi.mock("@/features/ambassadors/dal/admin", () => ({ listAmbassadors }));
import { DomainError } from "@/lib/errors";
import { NextRequest } from "next/server";
import { GET } from "./route";
describe("GET /api/ambassadors", () => {
  beforeEach(() => vi.clearAllMocks());
  it("wires the cursor and list envelope", async () => { listAmbassadors.mockResolvedValue({ items: [], nextCursor: null }); const response = await GET(new NextRequest("http://local/api/ambassadors?cursor=abc")); expect(listAmbassadors).toHaveBeenCalledWith("abc"); expect(await response.json()).toEqual({ items: [], nextCursor: null }); });
  it.each([["VALIDATION_FAILED", 422], ["AUTH_REQUIRED", 401], ["FORBIDDEN", 403]] as const)("returns the canonical %s envelope", async (code, status) => { listAmbassadors.mockRejectedValue(new DomainError(code)); const response = await GET(new NextRequest("http://local/api/ambassadors")); expect(response.status).toBe(status); expect(await response.json()).toMatchObject({ error: { code } }); });
});
