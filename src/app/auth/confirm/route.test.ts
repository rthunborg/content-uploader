import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, verifyOtp } = vi.hoisted(() => ({
  createClient: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createClient,
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockResolvedValue({ auth: { verifyOtp } });
  verifyOtp.mockResolvedValue({ error: null });
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
});
