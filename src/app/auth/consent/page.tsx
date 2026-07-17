import { safeContinuation } from "@/lib/auth/continuation";
import { getCurrentTerms } from "@/features/consent/dal/pre-consent";
import { ConsentCardStack } from "@/features/consent/components/consent-card-stack";
import { CONSENT_COPY } from "@/features/consent/copy";
import { acceptConsent } from "./actions";
import { DomainError } from "@/lib/errors";
import { redirect } from "next/navigation";

export default async function ConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeContinuation(rawNext ?? "/tasks");
  let terms: Awaited<ReturnType<typeof getCurrentTerms>> = null;
  try { terms = await getCurrentTerms(); } catch (error) {
    if (error instanceof DomainError && (error.code === "AUTH_REQUIRED" || error.code === "SESSION_REVOKED")) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
    if (error instanceof DomainError && (error.code === "ACCOUNT_INACTIVE" || error.code === "FORBIDDEN")) redirect("/auth/paused");
    // Terms, database, and cryptographic failures deliberately share one safe surface.
  }
  return <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8 sm:py-12">
    <p className="eyebrow">{CONSENT_COPY.eyebrow}</p>
    <h1>{terms ? CONSENT_COPY.title : CONSENT_COPY.unavailableTitle}</h1>
    <p className="intro">{terms ? CONSENT_COPY.intro : CONSENT_COPY.unavailableBody}</p>
    {terms ? <ConsentCardStack terms={terms.payload} next={next === "/" ? "/tasks" : next} action={acceptConsent} /> : <a className="primary-link" href={`/auth/consent?next=${encodeURIComponent(next)}`}>{CONSENT_COPY.retry}</a>}
  </main>;
}
