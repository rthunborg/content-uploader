import { beforeEach, describe, expect, it, vi } from "vitest";

const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));

vi.mock("@/shared/logger", () => ({ logError }));

import {
  buildConfirmationUrl,
  requestMagicLinkWithClient,
  supportedEmailOtpType,
} from "./auth-flow";

describe("email-link authentication flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests one magic link without creating an account", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });

    const result = await requestMagicLinkWithClient(
      { auth: { signInWithOtp } },
      "ambassador@example.com",
      new URL("https://portal.example/auth/login?next=%2Ftasks"),
    );

    expect(signInWithOtp).toHaveBeenCalledOnce();
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "ambassador@example.com",
      options: {
        emailRedirectTo: "https://portal.example/auth/confirm?next=%2Ftasks",
        shouldCreateUser: false,
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it("returns Swedish safe copy instead of provider details", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({
      error: new Error("provider secret detail"),
    });

    await expect(
      requestMagicLinkWithClient(
        { auth: { signInWithOtp } },
        "ambassador@example.com",
        new URL("https://portal.example/auth/login"),
      ),
    ).resolves.toEqual({
      ok: false,
      message:
        "Länken kunde inte skickas just nu. Försök igen om en liten stund.",
    });
    expect(logError).toHaveBeenCalledWith(
      "auth.magic_link_request_failed",
      expect.objectContaining({ message: "Provider request failed" }),
      { operation: "signInWithOtp" },
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain("provider secret detail");
  });

  it("returns Swedish safe copy when the provider rejects", async () => {
    const signInWithOtp = vi.fn().mockRejectedValue(new Error("secret rejection"));

    await expect(
      requestMagicLinkWithClient(
        { auth: { signInWithOtp } },
        "ambassador@example.com",
        new URL("https://portal.example/auth/login"),
      ),
    ).resolves.toEqual({
      ok: false,
      message: "Länken kunde inte skickas just nu. Försök igen om en liten stund.",
    });
    expect(logError).toHaveBeenCalledWith(
      "auth.magic_link_request_failed",
      expect.objectContaining({ message: "Provider request rejected" }),
      { operation: "signInWithOtp" },
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain("secret rejection");
  });

  it("builds confirmation URLs with a safe continuation", () => {
    expect(
      buildConfirmationUrl(
        new URL("https://portal.example/auth/login"),
        "//evil.example",
      ),
    ).toBe("https://portal.example/auth/confirm?next=%2F");
  });

  it.each(["email", "magiclink", "invite"])(
    "accepts supported email OTP type %s",
    (type) => expect(supportedEmailOtpType(type)).toBe(type),
  );

  it.each([null, "recovery", "sms", "unknown"])(
    "rejects unsupported OTP type %s",
    (type) => expect(supportedEmailOtpType(type)).toBeNull(),
  );
});
