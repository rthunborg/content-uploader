import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, headersMock, signInWithOtp } = vi.hoisted(() => ({
  createClient: vi.fn(),
  headersMock: vi.fn(),
  signInWithOtp: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: createClient,
}));

import { requestMagicLink } from "./actions";
import { INITIAL_LOGIN_STATE } from "./login-state";

function form(email: string, next = "/tasks") {
  const data = new FormData();
  data.set("email", email);
  data.set("next", next);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  headersMock.mockResolvedValue(
    new Headers({ host: "portal.example", "x-forwarded-proto": "https" }),
  );
  createClient.mockResolvedValue({ auth: { signInWithOtp } });
  signInWithOtp.mockResolvedValue({ error: null });
});

describe("requestMagicLink server boundary", () => {
  it.each(["invalid", `${"a".repeat(250)}@x.se`])(
    "rejects invalid or oversized email: %s",
    async (email) => {
      const result = await requestMagicLink(INITIAL_LOGIN_STATE, form(email));
      expect(result.status).toBe("error");
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  it("requests a link successfully using forwarded origin", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        host: "internal.invalid",
        "x-forwarded-host": "portal.example",
        "x-forwarded-proto": "https",
      }),
    );
    await expect(
      requestMagicLink(INITIAL_LOGIN_STATE, form("user@example.com")),
    ).resolves.toMatchObject({ status: "success" });
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "https://portal.example/auth/confirm?next=%2Ftasks",
        }),
      }),
    );
  });

  it("returns a safe state when the provider rejects", async () => {
    signInWithOtp.mockRejectedValue(new Error("provider secret"));
    await expect(
      requestMagicLink(INITIAL_LOGIN_STATE, form("user@example.com")),
    ).resolves.toMatchObject({ status: "error" });
  });

  it("replaces an unsafe continuation", async () => {
    await requestMagicLink(
      INITIAL_LOGIN_STATE,
      form("user@example.com", "https://evil.example"),
    );
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "https://portal.example/auth/confirm?next=%2F",
        }),
      }),
    );
  });

  it("returns a safe state for malformed origin headers", async () => {
    headersMock.mockResolvedValue(new Headers({ host: "[malformed" }));
    await expect(
      requestMagicLink(INITIAL_LOGIN_STATE, form("user@example.com")),
    ).resolves.toMatchObject({ status: "error" });
  });
});
