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
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
  signOut: vi.fn(),
  emit: vi.fn(),
  logError: vi.fn(),
  logCritical: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db/client", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    auth: {
      admin: {
        getUserById: mocks.getUserById,
        updateUserById: mocks.updateUserById,
        signOut: mocks.signOut,
      },
    },
  }),
}));
vi.mock("@/shared/audit", () => ({ audit: { emit: mocks.emit } }));
vi.mock("@/shared/logger", () => ({
  logError: mocks.logError,
  logCritical: mocks.logCritical,
}));

import { DomainError } from "@/lib/errors";

import { updateAmbassadorContact } from "./admin";

const PROFILE_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";
const OLD_EMAIL = "anna@example.com";
const NEW_EMAIL = "anna.ny@example.com";
const NEWER_EMAIL = "anna.newer@example.com";
const input = {
  fullName: " Anna Andersson ",
  email: " ANNA.NY@EXAMPLE.COM ",
  mobile: " +46 70 123 45 67 ",
};
const persistedRow = {
  id: PROFILE_ID,
  fullName: "Anna Andersson",
  email: NEW_EMAIL,
  mobile: "+46 70 123 45 67",
  accountState: "active" as const,
  invitedAt: new Date("2026-07-01T10:00:00Z"),
  firstAcceptedAt: null,
  firstUploadAt: null,
  lastLoginAt: new Date("2026-07-15T10:00:00Z"),
  createdAt: new Date("2026-07-01T10:00:00Z"),
  updatedAt: new Date("2026-07-16T10:00:00Z"),
};

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
  mocks.requireAdmin.mockReset();
  mocks.getDatabase.mockReset();
  mocks.transaction.mockReset();
  mocks.execute.mockReset();
  mocks.updateValues.mockReset();
  mocks.updateWhere.mockReset();
  mocks.returning.mockReset();
  mocks.getUserById.mockReset();
  mocks.updateUserById.mockReset();
  mocks.signOut.mockReset();
  mocks.emit.mockReset();
  mocks.logError.mockReset();
  mocks.logCritical.mockReset();

  mocks.requireAdmin.mockResolvedValue({
    actorId: "00000000-0000-4000-8000-000000000009",
    actorNameSnapshot: "admin@example.com",
  });
  mocks.execute.mockImplementation(async (query) => (
    /select exists/i.test(queryText(query))
      ? [{ exists: false }]
      : [{ id: PROFILE_ID, email: OLD_EMAIL }]
  ));
  mocks.getUserById.mockResolvedValue({
    data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
    error: null,
  });
  mocks.updateUserById.mockResolvedValue({
    data: { user: { id: PROFILE_ID, email: NEW_EMAIL } },
    error: null,
  });
  mocks.returning.mockResolvedValue([persistedRow]);
  mocks.transaction.mockImplementation(async (callback) => callback(transactionClient()));
  mocks.getDatabase.mockReturnValue({ transaction: mocks.transaction });
});

describe("updateAmbassadorContact", () => {
  it("authorizes before target or body validation and every side effect", async () => {
    mocks.requireAdmin.mockRejectedValue(new DomainError("FORBIDDEN"));

    await expect(updateAmbassadorContact("bad", {
      fullName: "",
      email: "bad",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(mocks.getDatabase).not.toHaveBeenCalled();
    expect(mocks.getUserById).not.toHaveBeenCalled();
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("rejects malformed targets as not found and invalid contact fields canonically", async () => {
    await expect(updateAmbassadorContact("bad", input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateAmbassadorContact(PROFILE_ID, {
      fullName: "",
      email: "bad",
      accountState: "deactivated",
    } as never)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });

  it("locks the ambassador, synchronizes Auth first, and persists exact normalized values", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-07-16T10:00:00Z");

    await expect(updateAmbassadorContact(PROFILE_ID, input)).resolves.toEqual({
      id: PROFILE_ID,
      fullName: "Anna Andersson",
      email: NEW_EMAIL,
      mobile: "+46 70 123 45 67",
      accountState: "active",
      invitedAt: "2026-07-01T10:00:00.000Z",
      lastLoginAt: "2026-07-15T10:00:00.000Z",
    });

    expect(queryText(mocks.execute.mock.calls[0]![0])).toMatch(/for update of p/i);
    expect(mocks.getUserById).toHaveBeenCalledWith(PROFILE_ID);
    expect(mocks.updateUserById).toHaveBeenCalledWith(PROFILE_ID, { email: NEW_EMAIL });
    expect(mocks.updateValues).toHaveBeenCalledWith({
      fullName: "Anna Andersson",
      email: NEW_EMAIL,
      mobile: "+46 70 123 45 67",
      updatedAt: new Date("2026-07-16T10:00:00Z"),
    });
    expect(mocks.updateUserById.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.updateValues.mock.invocationCallOrder[0]!,
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("rechecks the non-admin Auth predicate in the final profile update", async () => {
    await updateAmbassadorContact(PROFILE_ID, input);

    const predicate = queryText(mocks.updateWhere.mock.calls[0]![0]);
    expect(predicate).toMatch(/profiles.+id/i);
    expect(predicate).toMatch(/exists.+auth\.users/is);
    expect(predicate).toMatch(/raw_app_meta_data.+admin/is);
  });

  it("returns not found and compensates when the final ambassador predicate no longer matches", async () => {
    mocks.returning.mockResolvedValue([]);
    mocks.getUserById
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: NEW_EMAIL } },
        error: null,
      });
    mocks.updateUserById
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: NEW_EMAIL } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      });

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(mocks.updateUserById).toHaveBeenNthCalledWith(2, PROFILE_ID, {
      email: OLD_EMAIL,
    });
  });

  it("updates name and mobile without touching Auth when its normalized email already matches", async () => {
    mocks.getUserById.mockResolvedValue({
      data: { user: { id: PROFILE_ID, email: NEW_EMAIL } },
      error: null,
    });

    await updateAmbassadorContact(PROFILE_ID, input);

    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.updateValues).toHaveBeenCalledWith(expect.objectContaining({
      fullName: "Anna Andersson",
      email: NEW_EMAIL,
      mobile: "+46 70 123 45 67",
    }));
  });

  it("blocks missing, admin, and orphan targets before exposing or changing contact data", async () => {
    mocks.execute.mockResolvedValue([]);

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.getUserById).not.toHaveBeenCalled();
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.updateValues).not.toHaveBeenCalled();
  });

  it("blocks profile or Auth identity duplicates before the Auth update", async () => {
    mocks.execute
      .mockResolvedValueOnce([{ id: PROFILE_ID, email: OLD_EMAIL }])
      .mockResolvedValueOnce([{ exists: true }]);

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({ code: "CONFLICT" });

    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.updateValues).not.toHaveBeenCalled();
  });

  it.each(["email_exists", "user_already_exists", "identity_already_exists"])(
    "normalizes provider duplicate code %s to conflict and inspects Auth state",
    async (code) => {
      mocks.updateUserById.mockResolvedValue({
        data: { user: null },
        error: { code, status: 422 },
      });

      await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({ code: "CONFLICT" });

      expect(mocks.transaction).toHaveBeenCalledTimes(2);
      expect(mocks.getUserById).toHaveBeenCalledTimes(2);
      expect(mocks.updateValues).not.toHaveBeenCalled();
      expect(mocks.logError).not.toHaveBeenCalledWith(
        "ambassador.contact_persistence_failed",
        expect.anything(),
        expect.anything(),
      );
    },
  );

  it("maps a missing Auth user to not found without profile persistence", async () => {
    mocks.getUserById.mockResolvedValue({
      data: { user: null },
      error: { code: "user_not_found", status: 404 },
    });

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.updateValues).not.toHaveBeenCalled();
  });

  it("rejects and logs an Auth lookup response for a different user", async () => {
    mocks.getUserById.mockResolvedValue({
      data: { user: { id: OTHER_ID, email: OLD_EMAIL } },
      error: null,
    });

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });

    expect(mocks.logError).toHaveBeenCalledWith(
      "ambassador.contact_auth_lookup_failed",
      expect.anything(),
      expect.objectContaining({
        profileId: PROFILE_ID,
        operation: "getUserById",
        reason: "auth_user_mismatch",
      }),
    );
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("logs an unexpected Auth error and safely restores when the provider changed state", async () => {
    mocks.getUserById
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: NEW_EMAIL } },
        error: null,
      });
    mocks.updateUserById
      .mockResolvedValueOnce({
        data: { user: null },
        error: { code: "provider_secret", status: 503 },
      })
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      });

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Ett oväntat fel inträffade.",
    });

    expect(mocks.logError).toHaveBeenCalledWith(
      "ambassador.contact_auth_update_failed",
      expect.anything(),
      expect.objectContaining({
        profileId: PROFILE_ID,
        operation: "updateUserById",
        status: 503,
        code: "provider_secret",
      }),
    );
    expect(mocks.updateUserById).toHaveBeenNthCalledWith(2, PROFILE_ID, {
      email: OLD_EMAIL,
    });
    expect(mocks.updateValues).not.toHaveBeenCalled();
  });

  it("inspects and restores after a rejected forward Auth promise", async () => {
    const transportError = new Error("transport secret");
    mocks.getUserById
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: NEW_EMAIL } },
        error: null,
      });
    mocks.updateUserById
      .mockRejectedValueOnce(transportError)
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      });

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });

    expect(mocks.updateUserById).toHaveBeenNthCalledWith(2, PROFILE_ID, {
      email: OLD_EMAIL,
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });

  it("inspects and restores an unacknowledged Auth response that changed email", async () => {
    mocks.getUserById
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: NEW_EMAIL } },
        error: null,
      });
    mocks.updateUserById
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      });

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });

    expect(mocks.updateUserById).toHaveBeenNthCalledWith(2, PROFILE_ID, {
      email: OLD_EMAIL,
    });
  });

  it("re-locks the profile and restores the prior Auth email when commit fails", async () => {
    mocks.transaction
      .mockImplementationOnce(async (callback) => {
        await callback(transactionClient());
        throw new Error("commit secret");
      })
      .mockImplementationOnce(async (callback) => callback(transactionClient()));
    mocks.getUserById
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: NEW_EMAIL } },
        error: null,
      });
    mocks.updateUserById
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: NEW_EMAIL } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      });

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(queryText(mocks.execute.mock.calls[2]![0])).toMatch(/for update of p/i);
    expect(mocks.updateUserById).toHaveBeenNthCalledWith(1, PROFILE_ID, {
      email: NEW_EMAIL,
    });
    expect(mocks.updateUserById).toHaveBeenNthCalledWith(2, PROFILE_ID, {
      email: OLD_EMAIL,
    });
    expect(mocks.logError).toHaveBeenCalledWith(
      "ambassador.contact_persistence_failed",
      expect.anything(),
      { profileId: PROFILE_ID },
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("does not overwrite a newer successful profile and Auth edit", async () => {
    mocks.returning.mockRejectedValue(new Error("database secret"));
    mocks.execute
      .mockResolvedValueOnce([{ id: PROFILE_ID, email: OLD_EMAIL }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ id: PROFILE_ID, email: NEWER_EMAIL }]);
    mocks.getUserById
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: NEWER_EMAIL } },
        error: null,
      });
    mocks.updateUserById.mockResolvedValueOnce({
      data: { user: { id: PROFILE_ID, email: NEW_EMAIL } },
      error: null,
    });

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });

    expect(mocks.updateUserById).toHaveBeenCalledTimes(1);
    expect(mocks.logCritical).not.toHaveBeenCalled();
  });

  it("does nothing when Auth was already restored before compensation acquired the lock", async () => {
    mocks.returning.mockRejectedValue(new Error("database secret"));
    mocks.getUserById
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      });

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });

    expect(mocks.updateUserById).toHaveBeenCalledTimes(1);
    expect(mocks.logCritical).not.toHaveBeenCalled();
  });

  it("logs unsafe compensation state without overwriting an unrelated Auth email", async () => {
    mocks.returning.mockRejectedValue(new Error("database secret"));
    mocks.getUserById
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: "unexpected@example.com" } },
        error: null,
      });

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });

    expect(mocks.updateUserById).toHaveBeenCalledTimes(1);
    expect(mocks.logCritical).toHaveBeenCalledWith(
      "ambassador.contact_reconciliation_required",
      expect.anything(),
      expect.objectContaining({
        profileId: PROFILE_ID,
        operation: "restoreAuthEmail",
        reason: "unexpected_auth_email",
      }),
    );
  });

  it("preserves the original domain result when compensation cannot inspect state", async () => {
    mocks.updateUserById.mockResolvedValue({
      data: { user: null },
      error: { code: "email_exists", status: 422 },
    });
    mocks.transaction
      .mockImplementationOnce(async (callback) => callback(transactionClient()))
      .mockRejectedValueOnce(new Error("lock secret"));

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({
      code: "CONFLICT",
    });

    expect(mocks.logCritical).toHaveBeenCalledWith(
      "ambassador.contact_reconciliation_required",
      expect.anything(),
      expect.objectContaining({
        profileId: PROFILE_ID,
        operation: "restoreAuthEmail",
        reason: "profile_lock_failed",
      }),
    );
  });

  it("logs failed restoration as reconciliation-critical", async () => {
    mocks.returning.mockRejectedValue(new Error("database secret"));
    mocks.getUserById
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: OLD_EMAIL } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: NEW_EMAIL } },
        error: null,
      });
    mocks.updateUserById
      .mockResolvedValueOnce({
        data: { user: { id: PROFILE_ID, email: NEW_EMAIL } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: null },
        error: { code: "rollback_secret", status: 503 },
      });

    await expect(updateAmbassadorContact(PROFILE_ID, input)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });

    expect(mocks.logCritical).toHaveBeenCalledWith(
      "ambassador.contact_reconciliation_required",
      expect.anything(),
      expect.objectContaining({
        profileId: PROFILE_ID,
        operation: "restoreAuthEmail",
        reason: "restore_failed",
        status: 503,
        code: "rollback_secret",
      }),
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
