import { beforeEach, describe, expect, it, vi } from "vitest";
const dal = vi.hoisted(() => ({
  getProfileForAdmin: vi.fn(),
  updateAmbassadorContact: vi.fn(),
  requireAdmin: vi.fn(),
}));
vi.mock("@/features/ambassadors/dal/admin", () => ({
  getProfileForAdmin: dal.getProfileForAdmin,
  updateAmbassadorContact: dal.updateAmbassadorContact,
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: dal.requireAdmin }));
import { DomainError } from "@/lib/errors";
import { NextRequest } from "next/server";
import { GET, PATCH } from "./route";
describe("GET /api/ambassadors/[profileId]", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([["NOT_FOUND", 404], ["AUTH_REQUIRED", 401], ["FORBIDDEN", 403]] as const)("returns the canonical %s envelope", async (code, status) => { dal.getProfileForAdmin.mockRejectedValue(new DomainError(code)); const response = await GET(new Request("http://local") as never, { params: Promise.resolve({ profileId: "bad" }) }); expect(response.status).toBe(status); expect(await response.json()).toMatchObject({ error: { code } }); });
  it("forwards the id and returns the exact successful payload", async () => { const payload = { id: "00000000-0000-4000-8000-000000000001", fullName: "Anna Andersson", email: "anna@example.test", mobile: "+46700000000", accountState: "active", invitedAt: null, lastLoginAt: "2026-07-15T10:00:00.000Z" }; dal.getProfileForAdmin.mockResolvedValue(payload); const response = await GET(new Request("http://local") as never, { params: Promise.resolve({ profileId: payload.id }) }); expect(dal.getProfileForAdmin).toHaveBeenCalledWith(payload.id); expect(response.status).toBe(200); expect(await response.json()).toEqual(payload); });
});

describe("PATCH /api/ambassadors/[profileId]", () => {
  const profileId = "00000000-0000-4000-8000-000000000001";
  const context = { params: Promise.resolve({ profileId }) };
  const payload = {
    id: profileId,
    fullName: "Anna Andersson",
    email: "anna.ny@example.com",
    mobile: null,
    accountState: "active",
    invitedAt: null,
    lastLoginAt: "2026-07-15T10:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dal.requireAdmin.mockResolvedValue({ role: "admin" });
    dal.updateAmbassadorContact.mockResolvedValue(payload);
  });

  it("authorizes before parsing JSON or invoking the mutation", async () => {
    dal.requireAdmin.mockRejectedValue(new DomainError("FORBIDDEN"));

    const response = await PATCH(new NextRequest("http://local/api/ambassadors/x", {
      method: "PATCH",
      body: "not-json",
    }), context);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(dal.updateAmbassadorContact).not.toHaveBeenCalled();
  });

  it("normalizes strict JSON input and returns the exact acknowledged profile", async () => {
    const response = await PATCH(new NextRequest("http://local/api/ambassadors/x", {
      method: "PATCH",
      body: JSON.stringify({
        fullName: " Anna Andersson ",
        email: " ANNA.NY@EXAMPLE.COM ",
        mobile: "",
      }),
    }), context);

    expect(response.status).toBe(200);
    expect(dal.updateAmbassadorContact).toHaveBeenCalledWith(profileId, {
      fullName: "Anna Andersson",
      email: "anna.ny@example.com",
      mobile: null,
    });
    expect(await response.json()).toEqual(payload);
  });

  it("returns perceivable field errors without calling the mutation", async () => {
    const response = await PATCH(new NextRequest("http://local/api/ambassadors/x", {
      method: "PATCH",
      body: JSON.stringify({ fullName: "", email: "bad", mobile: "---" }),
    }), context);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "VALIDATION_FAILED",
        message: "Kontrollera uppgifterna och försök igen.",
        fields: {
          fullName: "Fältet måste fyllas i.",
          email: "Ange en giltig e-postadress.",
          mobile: "Ange ett giltigt mobilnummer.",
        },
      },
    });
    expect(dal.updateAmbassadorContact).not.toHaveBeenCalled();
  });

  it("preserves the first validation issue for each field", async () => {
    const response = await PATCH(new NextRequest("http://local/api/ambassadors/x", {
      method: "PATCH",
      body: JSON.stringify({
        fullName: "Anna",
        email: "x".repeat(321),
        mobile: null,
      }),
    }), context);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: {
        fields: {
          email: "Värdet är för långt.",
        },
      },
    });
    expect(dal.updateAmbassadorContact).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "not-json"],
    ["an extra lifecycle field", JSON.stringify({
      fullName: "Anna",
      email: "anna@example.com",
      mobile: null,
      accountState: "deactivated",
    })],
  ])("returns safe validation failure for %s", async (_case, body) => {
    const response = await PATCH(new NextRequest("http://local/api/ambassadors/x", {
      method: "PATCH",
      body,
    }), context);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_FAILED", message: "Kontrollera uppgifterna och försök igen." },
    });
    expect(dal.updateAmbassadorContact).not.toHaveBeenCalled();
  });

  it.each([
    ["AUTH_REQUIRED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["INTERNAL_ERROR", 500],
  ] as const)("maps %s through the canonical error envelope", async (code, status) => {
    if (code === "AUTH_REQUIRED" || code === "FORBIDDEN") {
      dal.requireAdmin.mockRejectedValue(new DomainError(code));
    } else {
      dal.updateAmbassadorContact.mockRejectedValue(new DomainError(code));
    }

    const response = await PATCH(new NextRequest("http://local/api/ambassadors/x", {
      method: "PATCH",
      body: JSON.stringify({
        fullName: "Anna",
        email: "anna@example.com",
        mobile: null,
      }),
    }), context);

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code } });
  });
});
