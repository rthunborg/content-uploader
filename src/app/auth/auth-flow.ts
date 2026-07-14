import { safeContinuation } from "@/lib/auth/continuation";
import { logError } from "@/shared/logger";

export const AUTH_COPY = {
  emailInvalid: "Ange en giltig e-postadress.",
  linkSent:
    "Kontrollera din inkorg. Vi har skickat en säker länk för att logga in.",
  requestFailed:
    "Länken kunde inte skickas just nu. Försök igen om en liten stund.",
  linkExpiredTitle: "Länken går inte längre att använda",
  linkExpiredReason: "Länken kan ha gått ut eller redan ha använts.",
  linkExpiredRemedy:
    "Be om en ny inloggningslänk för att fortsätta säkert.",
  requestFreshLink: "Be om en ny inloggningslänk",
} as const;

type MagicLinkClient = {
  auth: {
    signInWithOtp(input: {
      email: string;
      options: {
        emailRedirectTo: string;
        shouldCreateUser: false;
      };
    }): Promise<{ error: unknown }>;
  };
};

export function buildConfirmationUrl(requestUrl: URL, next: string | null) {
  const confirmationUrl = new URL("/auth/confirm", requestUrl.origin);
  confirmationUrl.searchParams.set("next", safeContinuation(next));
  return confirmationUrl.toString();
}

export function buildLinkErrorUrl(requestUrl: URL, next: string | null) {
  const errorUrl = new URL("/auth/error", requestUrl.origin);
  errorUrl.searchParams.set("next", safeContinuation(next));
  return errorUrl.toString();
}

export function futureAuthPurpose(value: string | null): string | null {
  return value && /^[a-z][a-z0-9_-]{0,63}$/.test(value) ? value : null;
}

export async function requestMagicLinkWithClient(
  client: MagicLinkClient,
  email: string,
  requestUrl: URL,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let error: unknown;
  try {
    ({ error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: buildConfirmationUrl(
          requestUrl,
          requestUrl.searchParams.get("next"),
        ),
        shouldCreateUser: false,
      },
    }));
  } catch {
    logError("auth.magic_link_request_failed", new Error("Provider request rejected"), {
      operation: "signInWithOtp",
    });
    return { ok: false, message: AUTH_COPY.requestFailed };
  }

  if (error) {
    logError("auth.magic_link_request_failed", new Error("Provider request failed"), {
      operation: "signInWithOtp",
    });
    return { ok: false, message: AUTH_COPY.requestFailed };
  }

  return { ok: true };
}

export type SupportedEmailOtpType = "email" | "magiclink" | "invite";

export function supportedEmailOtpType(
  value: string | null,
): SupportedEmailOtpType | null {
  return value === "email" || value === "magiclink" || value === "invite"
    ? value
    : null;
}
