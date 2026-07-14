import { NextResponse, type NextRequest } from "next/server";

import {
  buildLinkErrorUrl,
  futureAuthPurpose,
  supportedEmailOtpType,
} from "@/app/auth/auth-flow";
import { safeContinuation } from "@/lib/auth/continuation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logError } from "@/shared/logger";

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

    return NextResponse.redirect(
      error ? buildLinkErrorUrl(request.nextUrl, next) : new URL(next, request.url),
    );
  } catch {
    logError("auth.otp_verification_failed", new Error("Provider request rejected"), {
      operation: "verifyOtp",
    });
    return NextResponse.redirect(buildLinkErrorUrl(request.nextUrl, next));
  }
}
