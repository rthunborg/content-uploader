"use server";

import { headers } from "next/headers";

import {
  AUTH_COPY,
  requestMagicLinkWithClient,
} from "@/app/auth/auth-flow";
import { safeContinuation } from "@/lib/auth/continuation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logError } from "@/shared/logger";

import type { LoginState } from "./login-state";

const MAX_EMAIL_LENGTH = 254;

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function requestOrigin() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return new URL(`${protocol}://${host}`).origin;
}

export async function requestMagicLink(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();

  if (email.length > MAX_EMAIL_LENGTH || !isEmail(email)) {
    return { status: "error", message: AUTH_COPY.emailInvalid };
  }

  let result: Awaited<ReturnType<typeof requestMagicLinkWithClient>>;
  try {
    const requestUrl = new URL("/auth/login", await requestOrigin());
    requestUrl.searchParams.set(
      "next",
      safeContinuation(String(formData.get("next") ?? "/")),
    );

    result = await requestMagicLinkWithClient(
      await createServerSupabaseClient(),
      email,
      requestUrl,
    );
  } catch {
    logError("auth.magic_link_action_failed", new Error("Authentication action failed"), {
      operation: "requestMagicLink",
    });
    return { status: "error", message: AUTH_COPY.requestFailed };
  }

  return result.ok
    ? { status: "success", message: AUTH_COPY.linkSent }
    : { status: "error", message: result.message };
}
