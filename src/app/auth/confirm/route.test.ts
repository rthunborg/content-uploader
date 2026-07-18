import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, verifyOtp, getOwnAccountState, logError, requireAdmin } = vi.hoisted(() => ({
  createClient: vi.fn(),
  verifyOtp: vi.fn(),
  getOwnAccountState: vi.fn(),
  logError: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createClient,
}));
vi.mock("@/features/consent/dal/pre-consent", () => ({ getOwnAccountState }));
vi.mock("@/lib/auth", () => ({ requireAdmin }));
vi.mock("@/shared/logger", () => ({ logError }));

import { GET } from "./route";
import { DomainError } from "@/lib/errors";

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockResolvedValue({ auth: { verifyOtp } });
  verifyOtp.mockResolvedValue({ error: null });
  requireAdmin.mockRejectedValue(new DomainError("FORBIDDEN", "Ambassadörskonto"));
  getOwnAccountState.mockResolvedValue("active");
});

function request(query: string) {
  return new NextRequest(`https://portal.example/auth/confirm?${query}`);
}

describe("GET /auth/confirm", () => {
  it("verifies a valid token and redirects safely", async () => {
    const response = await GET(request("token_hash=hash&type=magiclink&next=%2Ftasks"));
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash", type: "magiclink" });
    expect(response.headers.get("location")).toBe("https://portal.example/tasks");
  });

  it("lets an active admin resume without entering the ambassador pre-consent boundary", async () => {
    requireAdmin.mockResolvedValueOnce({ role: "admin" });
    const response = await GET(request("token_hash=hash&type=magiclink&next=%2Fadmin%2Fambassadors"));
    expect(response.headers.get("location")).toBe("https://portal.example/admin/ambassadors");
    expect(getOwnAccountState).not.toHaveBeenCalled();
  });

  it.each([
    ["provider error", () => verifyOtp.mockResolvedValue({ error: new Error("detail") })],
    ["provider rejection", () => verifyOtp.mockRejectedValue(new Error("detail"))],
    ["client rejection", () => createClient.mockRejectedValue(new Error("detail"))],
  ])("recovers safely from %s", async (_label, arrange) => {
    arrange();
    const response = await GET(request("token_hash=hash&type=email&next=%2Ftasks"));
    expect(response.headers.get("location")).toBe(
      "https://portal.example/auth/error?next=%2Ftasks",
    );
  });

  it.each(["type=email", "token_hash=hash&type=recovery"])(
    "rejects missing or unsupported token input: %s",
    async (query) => {
      const response = await GET(request(`${query}&next=https%3A%2F%2Fevil.example`));
      expect(verifyOtp).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBe(
        "https://portal.example/auth/error?next=%2F",
      );
    },
  );

  it.each(["email", "magiclink", "invite"])(
    "verifies supported type %s exactly once",
    async (type) => {
      const response = await GET(request(`token_hash=hash&type=${type}&purpose=future&next=%2Ftasks`));
      expect(verifyOtp).toHaveBeenCalledOnce();
      expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash", type });
      expect(response.headers.get("location")).toBe("https://portal.example/tasks");
    },
  );

  it.each([
    ["invited", "https://portal.example/auth/consent?next=%2Ftasks"],
    ["inactive_declined", "https://portal.example/auth/consent?next=%2Ftasks"],
    ["deactivated", "https://portal.example/auth/paused"],
  ])("routes %s accounts by server-side state", async (state, location) => {
    getOwnAccountState.mockResolvedValue(state);
    const response = await GET(request("token_hash=hash&type=magiclink&next=%2Ftasks"));
    expect(response.headers.get("location")).toBe(location);
  });

  it.each(["missing profile", "transient database failure"])(
    "keeps an authenticated session recoverable when account-state resolution has a %s",
    async () => {
      getOwnAccountState.mockRejectedValue(new Error("private detail"));
      const response = await GET(request("token_hash=hash&type=magiclink&next=%2Ftasks"));
      expect(response.headers.get("location")).toBe("https://portal.example/auth/paused");
      expect(logError).toHaveBeenCalledWith(
        "auth.account_state_resolution_failed",
        expect.any(Error),
        { operation: "getOwnAccountState" },
      );
    },
  );

  it("routes an expected inactive domain state without incident logging", async () => {
    getOwnAccountState.mockRejectedValue(new DomainError("ACCOUNT_INACTIVE", "provider detail"));
    const response = await GET(request("token_hash=hash&type=magiclink&next=%2Ftasks"));
    expect(response.headers.get("location")).toBe("https://portal.example/auth/paused");
    expect(logError).not.toHaveBeenCalled();
  });
});
