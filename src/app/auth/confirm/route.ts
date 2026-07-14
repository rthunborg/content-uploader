import { NextResponse, type NextRequest } from "next/server";

import {
  buildLinkErrorUrl,
  futureAuthPurpose,
  supportedEmailOtpType,
} from "@/app/auth/auth-flow";
import { safeContinuation } from "@/lib/auth/continuation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logError } from "@/shared/logger";
import { getOwnAccountState } from "@/features/consent/dal/pre-consent";
import { DomainError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = supportedEmailOtpType(request.nextUrl.searchParams.get("type"));
  const next = safeContinuation(request.nextUrl.searchParams.get("next"));
  // Reserved for a future task-specific continuation policy; deliberately no-op today.
  futureAuthPurpose(request.nextUrl.searchParams.get("purpose"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(buildLinkErrorUrl(request.nextUrl, next));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) return NextResponse.redirect(buildLinkErrorUrl(request.nextUrl, next));
  } catch {
    logError("auth.otp_verification_failed", new Error("Provider request rejected"), {
      operation: "verifyOtp",
    });
    return NextResponse.redirect(buildLinkErrorUrl(request.nextUrl, next));
  }
  try {
    const state = await getOwnAccountState();
    return NextResponse.redirect(new URL(state === "active" ? next : state === "invited" ? `/auth/consent?next=${encodeURIComponent(next)}` : "/auth/paused", request.url));
  } catch (error) {
    if (error instanceof DomainError) {
      const destination = error.code === "AUTH_REQUIRED" || error.code === "SESSION_REVOKED"
        ? `/auth/login?next=${encodeURIComponent(next)}`
        : "/auth/paused";
      return NextResponse.redirect(new URL(destination, request.url));
    }
    logError("auth.account_state_resolution_failed", error, { operation: "getOwnAccountState" });
    return NextResponse.redirect(new URL("/auth/paused", request.url));
  }
}
