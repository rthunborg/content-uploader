import { describe, expect, it, vi } from "vitest";

import {
  buildConfirmationUrl,
  requestMagicLinkWithClient,
  supportedEmailOtpType,
} from "./auth-flow";

describe("email-link authentication flow", () => {
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
