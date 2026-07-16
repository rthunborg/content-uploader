import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getDatabase: vi.fn(),
  transaction: vi.fn(),
  execute: vi.fn(),
  deleteWhere: vi.fn(),
  returning: vi.fn(),
  revokeAllUserSessions: vi.fn(),
  deleteUser: vi.fn(),
  getUserById: vi.fn(),
  emit: vi.fn(),
  logError: vi.fn(),
  logCritical: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db/client", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("@/lib/auth/revocation", () => ({ revokeAllUserSessions: mocks.revokeAllUserSessions }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    auth: { admin: { deleteUser: mocks.deleteUser, getUserById: mocks.getUserById } },
  }),
}));
vi.mock("@/shared/audit", () => ({ audit: { emit: mocks.emit } }));
vi.mock("@/shared/logger", () => ({ logError: mocks.logError, logCritical: mocks.logCritical }));

import { DomainError } from "@/lib/errors";
import { deleteAccount } from "./admin";

const PROFILE_ID = "00000000-0000-4000-8000-000000000001";
const row = {
  id: PROFILE_ID,
  fullName: "Anna Andersson",
  email: "anna@example.com",
  mobile: "+46700000000",
  accountState: "active" as const,
  invitedAt: new Date("2026-07-01T10:00:00Z"),
  firstAcceptedAt: null,
  firstUploadAt: null,
  lastLoginAt: new Date("2026-07-15T10:00:00Z"),
  createdAt: new Date("2026-07-01T10:00:00Z"),
  updatedAt: new Date("2026-07-15T10:00:00Z"),
};

function queryText(query: unknown) {
  return new PgDialect().sqlToQuery(query as never).sql;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    actorId: "00000000-0000-4000-8000-000000000009",
    actorNameSnapshot: "Portal Admin",
  });
  mocks.execute.mockResolvedValue([row]);
  mocks.revokeAllUserSessions.mockResolvedValue(undefined);
  mocks.deleteUser.mockResolvedValue({ error: null });
  mocks.getUserById.mockResolvedValue({ data: { user: row }, error: null });
  mocks.returning.mockResolvedValue([{ id: PROFILE_ID }]);
  mocks.deleteWhere.mockReturnValue({ returning: mocks.returning });
  const tx = {
    execute: mocks.execute,
    delete: () => ({ where: mocks.deleteWhere }),
  };
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  mocks.getDatabase.mockReturnValue({ transaction: mocks.transaction });
});

describe("deleteAccount", () => {
  it("authorizes before validation or side effects", async () => {
    mocks.requireAdmin.mockRejectedValue(new DomainError("FORBIDDEN"));
    await expect(deleteAccount("bad")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.revokeAllUserSessions).not.toHaveBeenCalled();
  });

  it("locks an ambassador, revokes, deletes Auth, then deletes profile and audits its snapshot", async () => {
    await expect(deleteAccount(PROFILE_ID)).resolves.toEqual({ id: PROFILE_ID, deleted: true });
    expect(queryText(mocks.execute.mock.calls[0]![0])).toMatch(/for update of p/i);
    expect(mocks.revokeAllUserSessions).toHaveBeenCalledWith(PROFILE_ID);
    expect(mocks.deleteUser).toHaveBeenCalledWith(PROFILE_ID);
    expect(mocks.revokeAllUserSessions.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.deleteUser.mock.invocationCallOrder[0]!);
    expect(mocks.deleteUser.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.deleteWhere.mock.invocationCallOrder[0]!);
    expect(mocks.emit).toHaveBeenCalledWith(expect.anything(), {
      type: "account.deleted",
      actor: {
        id: "00000000-0000-4000-8000-000000000009",
        nameSnapshot: "Portal Admin",
      },
      entity: {
        id: PROFILE_ID,
        snapshot: {
          fullName: "Anna Andersson",
          email: "anna@example.com",
          mobile: "+46700000000",
          accountState: "active",
          invitedAt: "2026-07-01T10:00:00.000Z",
          lastLoginAt: "2026-07-15T10:00:00.000Z",
        },
      },
    });
  });

  it("returns not found for malformed, missing, orphan, admin, and duplicate targets", async () => {
    await expect(deleteAccount("bad")).rejects.toMatchObject({ code: "NOT_FOUND" });
    mocks.execute.mockResolvedValue([]);
    await expect(deleteAccount(PROFILE_ID)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.revokeAllUserSessions).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("does not delete or audit when revocation or Auth deletion fails", async () => {
    mocks.revokeAllUserSessions.mockRejectedValueOnce(new Error("secret"));
    await expect(deleteAccount(PROFILE_ID)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();

    mocks.revokeAllUserSessions.mockResolvedValue(undefined);
    mocks.deleteUser.mockResolvedValueOnce({ error: { status: 500, code: "provider_error" } });
    await expect(deleteAccount(PROFILE_ID)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(mocks.deleteWhere).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("raises a critical reconciliation signal when persistence fails after Auth deletion", async () => {
    mocks.returning.mockResolvedValue([]);
    await expect(deleteAccount(PROFILE_ID)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(mocks.logCritical).toHaveBeenCalledWith(
      "ambassador.deletion_reconciliation_required",
      expect.anything(),
      {
        profileId: PROFILE_ID,
        operation: "deleteAccount",
        authDeleted: true,
        profileDeletionCommitted: false,
        auditCommitted: false,
      },
    );
  });

  it("raises reconciliation when Auth deletion committed but the provider response failed", async () => {
    mocks.deleteUser.mockRejectedValue(new Error("connection lost"));
    mocks.getUserById.mockResolvedValue({
      data: { user: null },
      error: { status: 404, code: "user_not_found" },
    });

    await expect(deleteAccount(PROFILE_ID)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });

    expect(mocks.deleteWhere).not.toHaveBeenCalled();
    expect(mocks.logCritical).toHaveBeenCalledWith(
      "ambassador.deletion_reconciliation_required",
      expect.anything(),
      expect.objectContaining({ profileId: PROFILE_ID, authDeleted: true }),
    );
  });

  it("raises reconciliation when the provider reports failure but the user is already gone", async () => {
    mocks.deleteUser.mockResolvedValue({ error: { status: 500, code: "provider_error" } });
    mocks.getUserById.mockResolvedValue({
      data: { user: null },
      error: { status: 404, code: "user_not_found" },
    });

    await expect(deleteAccount(PROFILE_ID)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });

    expect(mocks.deleteWhere).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
    expect(mocks.logCritical).toHaveBeenCalledWith(
      "ambassador.deletion_reconciliation_required",
      expect.anything(),
      expect.objectContaining({ profileId: PROFILE_ID, authDeleted: true }),
    );
  });
});
