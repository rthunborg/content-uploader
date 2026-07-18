import { safeContinuation } from "@/lib/auth/continuation";
import { getConsentPresentation } from "@/features/consent/dal/pre-consent";
import { ConsentCardStack } from "@/features/consent/components/consent-card-stack";
import { CONSENT_COPY } from "@/features/consent/copy";
import { acceptConsent, declineConsent } from "./actions";
import { DomainError } from "@/lib/errors";
import { redirect } from "next/navigation";

export default async function ConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeContinuation(rawNext ?? "/tasks");
  let presentation: Awaited<ReturnType<typeof getConsentPresentation>> = null;
  try { presentation = await getConsentPresentation(); } catch (error) {
    if (error instanceof DomainError && (error.code === "AUTH_REQUIRED" || error.code === "SESSION_REVOKED")) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
    if (error instanceof DomainError && (error.code === "ACCOUNT_INACTIVE" || error.code === "FORBIDDEN")) redirect("/auth/paused");
    // Terms, database, and cryptographic failures deliberately share one safe surface.
  }
  if (presentation?.mode === "current") redirect(next === "/" ? "/tasks" : next);
  // Only promise "changed parts are marked" when we actually have per-card markers to show;
  // an evidence-verified re-accept with no identifiable card changes uses the generic notice.
  const hasMarkedChanges = presentation?.mode === "reaccept" && Array.isArray(presentation.changedCardIds) && presentation.changedCardIds.length > 0;
  return <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8 sm:py-12">
    <p className="eyebrow">{CONSENT_COPY.eyebrow}</p>
    <h1>{presentation ? (presentation.mode === "reaccept" ? CONSENT_COPY.changedTitle : CONSENT_COPY.title) : CONSENT_COPY.unavailableTitle}</h1>
    <p className="intro">{presentation ? (presentation.mode === "reaccept" ? (hasMarkedChanges ? CONSENT_COPY.changedIntro : CONSENT_COPY.changedGeneric) : CONSENT_COPY.intro) : CONSENT_COPY.unavailableBody}</p>
    {presentation ? <ConsentCardStack terms={presentation.currentTerms.payload} termsVersionId={presentation.currentTerms.id} termsPayloadSha256={presentation.currentTerms.payloadSha256} mode={presentation.mode} changedCardIds={presentation.changedCardIds} next={next === "/" ? "/tasks" : next} action={acceptConsent} declineAction={declineConsent} /> : <a className="primary-link" href={`/auth/consent?next=${encodeURIComponent(next)}`}>{CONSENT_COPY.retry}</a>}
  </main>;
}
