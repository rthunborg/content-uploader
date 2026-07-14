import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { requireAdmin, where, limit } = vi.hoisted(() => ({ requireAdmin: vi.fn(), where: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin }));
vi.mock("@/db/client", () => ({ getDatabase: () => ({ select: () => ({ from: () => ({ where }) }) }) }));
import { DomainError, toErrorResponse } from "@/lib/errors";
import { getProfileForAdmin } from "./admin";

const VALID_UUID = "11111111-2222-4333-8444-555555555555";

describe("admin ambassador DAL denial", () => {
  it("returns the canonical safe 403 envelope before data access", async () => {
    requireAdmin.mockRejectedValue(new DomainError("FORBIDDEN", "provider detail"));
    const error = await getProfileForAdmin("target").catch((caught) => caught);
    expect(toErrorResponse(error, "admin.profile")).toEqual({ status: 403, body: { error: { code: "FORBIDDEN", message: "Du har inte behörighet att göra detta." } } });
  });
  it("maps a malformed profile id to a safe 404 instead of an internal error", async () => {
    requireAdmin.mockResolvedValue({ role: "admin", userId: "admin-1" });
    const error = await getProfileForAdmin("not-a-uuid").catch((caught) => caught);
    expect(toErrorResponse(error, "admin.profile")).toEqual({ status: 404, body: { error: { code: "NOT_FOUND", message: "Det du söker kunde inte hittas." } } });
  });
  it("serializes only the admin profile projection with dates as ISO strings", async () => {
    requireAdmin.mockResolvedValue({ role: "admin", userId: "admin-1" });
    where.mockReturnValue({ limit });
    limit.mockResolvedValue([{ id: VALID_UUID, email: "amb@example.test", mobile: "+46700000000", accountState: "active", invitedAt: new Date("2026-01-02T03:04:05.000Z"), lastLoginAt: null, firstAcceptedAt: new Date("2026-05-05T05:05:05.000Z"), createdAt: new Date(), updatedAt: new Date() }]);
    const result = await getProfileForAdmin(VALID_UUID);
    expect(result).toEqual({ id: VALID_UUID, email: "amb@example.test", mobile: "+46700000000", accountState: "active", invitedAt: "2026-01-02T03:04:05.000Z", lastLoginAt: null });
    // Internal columns must not leak through the admin wire type.
    expect(result).not.toHaveProperty("firstAcceptedAt");
    expect(result).not.toHaveProperty("createdAt");
  });
});
