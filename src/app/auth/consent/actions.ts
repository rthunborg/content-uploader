"use server";

import { redirect } from "next/navigation";
import { DomainError } from "@/lib/errors";
import { safeContinuation } from "@/lib/auth/continuation";
import { acceptTerms, declineTerms } from "@/features/consent/dal/pre-consent";
import { CONSENT_COPY } from "@/features/consent/copy";
import type { ConsentActionState } from "@/features/consent/components/consent-card-stack";

export async function acceptConsent(_previous: ConsentActionState, formData: FormData): Promise<ConsentActionState> {
  const next = safeContinuation(String(formData.get("next") ?? "/tasks"));
  const expectedTerms = { termsVersionId: String(formData.get("termsVersionId") ?? ""), termsPayloadSha256: String(formData.get("termsPayloadSha256") ?? "") };
  try { await acceptTerms(expectedTerms); }
  catch (error) {
    // Mirror the page loader and requireUserOrRedirect: auth/account-state failures
    // must relocate the user, not strand them on the consent form with an inline error.
    if (error instanceof DomainError && (error.code === "AUTH_REQUIRED" || error.code === "SESSION_REVOKED")) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
    if (error instanceof DomainError && (error.code === "ACCOUNT_INACTIVE" || error.code === "FORBIDDEN")) redirect("/auth/paused");
    if (error instanceof DomainError && error.remedy?.action === "reload_consent") redirect(`/auth/consent?next=${encodeURIComponent(next)}`);
    return { error: error instanceof DomainError ? error.message : CONSENT_COPY.submitError };
  }
  redirect(next === "/" ? "/tasks" : next);
}

export async function declineConsent(_previous: ConsentActionState, formData: FormData): Promise<ConsentActionState> {
  const next = safeContinuation(String(formData.get("next") ?? "/tasks"));
  try { await declineTerms(); }
  catch (error) {
    if (error instanceof DomainError && (error.code === "AUTH_REQUIRED" || error.code === "SESSION_REVOKED")) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
    if (error instanceof DomainError && (error.code === "ACCOUNT_INACTIVE" || error.code === "FORBIDDEN")) redirect("/auth/paused");
    return { error: error instanceof DomainError ? error.message : CONSENT_COPY.declineError };
  }
  redirect(`/auth/paused?next=${encodeURIComponent(next)}`);
}
