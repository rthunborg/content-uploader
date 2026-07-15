import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), getDatabase: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db/client", () => ({ getDatabase: mocks.getDatabase }));
import { DomainError, toErrorResponse } from "@/lib/errors";
import { AMBASSADOR_PAGE_SIZE, getProfileForAdmin, listAmbassadors } from "./admin";

const UUID = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const row = (n: number) => ({ id: UUID(n), fullName: n === 1 ? null : `Namn ${n}`, email: `a${n}@example.test`, mobile: null, accountState: "active" as const, invitedAt: null, firstAcceptedAt: null, firstUploadAt: null, lastLoginAt: n === 1 ? null : new Date("2026-07-15T10:00:00Z"), createdAt: new Date(), updatedAt: new Date() });

beforeEach(() => {
  vi.clearAllMocks(); mocks.requireAdmin.mockResolvedValue({ role: "admin" });
  mocks.getDatabase.mockReturnValue({ select: () => ({ from: () => ({ where: mocks.where }) }) });
  mocks.where.mockReturnValue({ orderBy: mocks.orderBy, limit: mocks.limit });
  mocks.orderBy.mockReturnValue({ limit: mocks.limit });
});

describe("admin ambassador reads", () => {
  it.each([getProfileForAdmin, listAmbassadors])("requires admin before database access", async (read) => {
    mocks.requireAdmin.mockRejectedValue(new DomainError("FORBIDDEN"));
    const error = await read(UUID(1)).catch((caught) => caught);
    expect(toErrorResponse(error, "test").status).toBe(403); expect(mocks.getDatabase).not.toHaveBeenCalled();
  });
  it("strictly rejects malformed and non-v4 cursors", async () => {
    for (const cursor of ["bad", "00000000-0000-1000-8000-000000000001", ""]) {
      const error = await listAmbassadors(cursor).catch((caught) => caught);
      expect(toErrorResponse(error, "test").status).toBe(422);
    }
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });
  it("accepts uppercase UUID-v4 cursors and returns an under-page result", async () => {
    mocks.limit.mockResolvedValue([row(2)]);
    await expect(listAmbassadors(UUID(1).toUpperCase())).resolves.toEqual({ items: [expect.objectContaining({ id: UUID(2), fullName: "Namn 2", lastLoginAt: "2026-07-15T10:00:00.000Z" })], nextCursor: null });
  });
  it("returns no cursor for an exact page and the last included id for an over-page", async () => {
    mocks.limit.mockResolvedValue(Array.from({ length: AMBASSADOR_PAGE_SIZE }, (_, index) => row(index + 1)));
    expect((await listAmbassadors()).nextCursor).toBeNull();
    mocks.limit.mockResolvedValue(Array.from({ length: AMBASSADOR_PAGE_SIZE + 1 }, (_, index) => row(index + 1)));
    const page = await listAmbassadors(); expect(page.items).toHaveLength(AMBASSADOR_PAGE_SIZE); expect(page.nextCursor).toBe(UUID(AMBASSADOR_PAGE_SIZE));
  });
  it("preserves nullable wire values and limits the detail projection", async () => {
    mocks.where.mockReturnValue({ limit: mocks.limit }); mocks.limit.mockResolvedValue([row(1)]);
    await expect(getProfileForAdmin(UUID(1))).resolves.toEqual({ id: UUID(1), fullName: null, email: "a1@example.test", mobile: null, accountState: "active", invitedAt: null, lastLoginAt: null });
  });
  it("maps malformed and absent detail ids to not found", async () => {
    expect(toErrorResponse(await getProfileForAdmin("bad").catch((e) => e), "test").status).toBe(404);
    mocks.where.mockReturnValue({ limit: mocks.limit }); mocks.limit.mockResolvedValue([]);
    expect(toErrorResponse(await getProfileForAdmin(UUID(1)).catch((e) => e), "test").status).toBe(404);
  });
});
