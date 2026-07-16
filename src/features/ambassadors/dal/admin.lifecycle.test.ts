import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getDatabase: vi.fn(),
  transaction: vi.fn(),
  execute: vi.fn(),
  updateValues: vi.fn(),
  updateWhere: vi.fn(),
  returning: vi.fn(),
  revokeAllUserSessions: vi.fn(),
  emit: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db/client", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("@/lib/auth/revocation", () => ({ revokeAllUserSessions: mocks.revokeAllUserSessions }));
vi.mock("@/shared/audit", () => ({ audit: { emit: mocks.emit } }));
vi.mock("@/shared/logger", () => ({
  logError: mocks.logError,
  logCritical: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({ auth: { admin: {} } }),
}));

import { DomainError } from "@/lib/errors";

import { updateAmbassadorLifecycle } from "./admin";

const PROFILE_ID = "00000000-0000-4000-8000-000000000001";
const actor = {
  actorId: "00000000-0000-4000-8000-000000000009",
  actorNameSnapshot: "admin@example.com",
};
const activeRow = {
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

function persisted(accountState: typeof activeRow.accountState | "invited" | "deactivated") {
  return {
    ...activeRow,
    accountState,
    updatedAt: new Date("2026-07-16T10:00:00Z"),
  };
}

function queryText(query: unknown) {
  return new PgDialect().sqlToQuery(query as never).sql;
}

function transactionClient() {
  return {
    execute: mocks.execute,
    update: () => ({
      set: (values: unknown) => {
        mocks.updateValues(values);
        return {
          where: (condition: unknown) => {
            mocks.updateWhere(condition);
            return { returning: mocks.returning };
          },
        };
      },
    }),
  };
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue(actor);
  mocks.execute.mockResolvedValue([activeRow]);
  mocks.returning.mockResolvedValue([persisted("deactivated")]);
  mocks.revokeAllUserSessions.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (callback) => callback(transactionClient()));
  mocks.getDatabase.mockReturnValue({ transaction: mocks.transaction });
});

describe("updateAmbassadorLifecycle", () => {
  it("authorizes before target or body validation and before side effects", async () => {
    mocks.requireAdmin.mockRejectedValue(new DomainError("FORBIDDEN"));

    await expect(updateAmbassadorLifecycle("bad", { action: "delete" } as never))
      .rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.revokeAllUserSessions).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("rejects malformed targets and invalid lifecycle payloads without side effects", async () => {
    await expect(updateAmbassadorLifecycle("bad", { action: "deactivate" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateAmbassadorLifecycle(PROFILE_ID, { action: "delete" } as never))
      .rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.revokeAllUserSessions).not.toHaveBeenCalled();
  });

  it("deactivates an active ambassador after global revocation and emits audit evidence", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-07-16T10:00:00Z");

    await expect(updateAmbassadorLifecycle(PROFILE_ID, { action: "deactivate" }))
      .resolves.toMatchObject({
        id: PROFILE_ID,
        accountState: "deactivated",
        invitedAt: "2026-07-01T10:00:00.000Z",
        lastLoginAt: "2026-07-15T10:00:00.000Z",
      });

    expect(queryText(mocks.execute.mock.calls[0]![0])).toMatch(/for update of p/i);
    expect(mocks.revokeAllUserSessions).toHaveBeenCalledWith(PROFILE_ID);
    expect(mocks.updateValues).toHaveBeenCalledWith({
      accountState: "deactivated",
      updatedAt: new Date("2026-07-16T10:00:00Z"),
    });
    expect(mocks.revokeAllUserSessions.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.updateValues.mock.invocationCallOrder[0]!);
    expect(mocks.emit).toHaveBeenCalledWith(expect.anything(), {
      type: "account.deactivated",
      actor: { id: actor.actorId, nameSnapshot: actor.actorNameSnapshot },
      entity: {
        id: PROFILE_ID,
        snapshot: {
          fullName: "Anna Andersson",
          email: "anna@example.com",
          mobile: "+46700000000",
          beforeAccountState: "active",
          afterAccountState: "deactivated",
          updatedAt: "2026-07-16T10:00:00.000Z",
        },
      },
    });
  });

  it("deactivates invited ambassadors but rejects declined or withdrawn transitions", async () => {
    mocks.execute.mockResolvedValue([{ ...activeRow, accountState: "invited" }]);
    await expect(updateAmbassadorLifecycle(PROFILE_ID, { action: "deactivate" }))
      .resolves.toMatchObject({ accountState: "deactivated" });
    expect(mocks.revokeAllUserSessions).toHaveBeenCalledTimes(1);

    mocks.execute.mockResolvedValue([{ ...activeRow, accountState: "inactive_declined" }]);
    await expect(updateAmbassadorLifecycle(PROFILE_ID, { action: "deactivate" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("returns the current profile for duplicate deactivation without audit or revocation", async () => {
    mocks.execute.mockResolvedValue([{ ...activeRow, accountState: "deactivated" }]);

    await expect(updateAmbassadorLifecycle(PROFILE_ID, { action: "deactivate" }))
      .resolves.toMatchObject({ accountState: "deactivated" });

    expect(mocks.revokeAllUserSessions).not.toHaveBeenCalled();
    expect(mocks.updateValues).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("reactivates a deactivated ambassador without global revocation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-07-16T10:00:00Z");
    mocks.execute.mockResolvedValue([{ ...activeRow, accountState: "deactivated" }]);
    mocks.returning.mockResolvedValue([persisted("active")]);

    await expect(updateAmbassadorLifecycle(PROFILE_ID, { action: "reactivate" }))
      .resolves.toMatchObject({ accountState: "active" });

    expect(mocks.revokeAllUserSessions).not.toHaveBeenCalled();
    expect(mocks.updateValues).toHaveBeenCalledWith({
      accountState: "active",
      updatedAt: new Date("2026-07-16T10:00:00Z"),
    });
    expect(mocks.emit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      type: "account.reactivated",
      entity: expect.objectContaining({
        snapshot: expect.objectContaining({
          beforeAccountState: "deactivated",
          afterAccountState: "active",
        }),
      }),
    }));
  });

  it("handles reactivation no-op and non-reactivatable states without side effects", async () => {
    await expect(updateAmbassadorLifecycle(PROFILE_ID, { action: "reactivate" }))
      .resolves.toMatchObject({ accountState: "active" });
    expect(mocks.updateValues).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();

    mocks.execute.mockResolvedValue([{ ...activeRow, accountState: "inactive_withdrawn" }]);
    await expect(updateAmbassadorLifecycle(PROFILE_ID, { action: "reactivate" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.revokeAllUserSessions).not.toHaveBeenCalled();
  });

  it("blocks missing, admin, and orphan targets before revocation", async () => {
    mocks.execute.mockResolvedValue([]);

    await expect(updateAmbassadorLifecycle(PROFILE_ID, { action: "deactivate" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.revokeAllUserSessions).not.toHaveBeenCalled();
    expect(mocks.updateValues).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("does not commit state or audit when global revocation fails", async () => {
    mocks.revokeAllUserSessions.mockRejectedValue(new Error("provider secret"));

    await expect(updateAmbassadorLifecycle(PROFILE_ID, { action: "deactivate" }))
      .rejects.toMatchObject({ code: "INTERNAL_ERROR" });

    expect(mocks.updateValues).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
    expect(mocks.logError).toHaveBeenCalledWith(
      "ambassador.lifecycle_revocation_failed",
      expect.anything(),
      { profileId: PROFILE_ID, operation: "revokeAllUserSessions" },
    );
  });

  it("reports persistence failure after revocation as internal and logs the unsafe state", async () => {
    mocks.returning.mockResolvedValue([]);

    await expect(updateAmbassadorLifecycle(PROFILE_ID, { action: "deactivate" }))
      .rejects.toMatchObject({ code: "INTERNAL_ERROR" });

    expect(mocks.revokeAllUserSessions).toHaveBeenCalledWith(PROFILE_ID);
    expect(mocks.emit).not.toHaveBeenCalled();
    expect(mocks.logError).toHaveBeenCalledWith(
      "ambassador.lifecycle_persistence_failed",
      expect.anything(),
      expect.objectContaining({
        profileId: PROFILE_ID,
        action: "deactivate",
        revocationAttempted: true,
        revocationSucceeded: true,
      }),
    );
  });
});
