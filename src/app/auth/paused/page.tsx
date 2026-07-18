import { redirect } from "next/navigation";
import { getOwnAccountState } from "@/features/consent/dal/pre-consent";
import { CONSENT_COPY } from "@/features/consent/copy";
import { safeContinuation } from "@/lib/auth/continuation";
import { DomainError } from "@/lib/errors";

export default async function PausedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeContinuation(Array.isArray(params.next) ? params.next[0] : params.next);
  let declined = false;
  try {
    const state = await getOwnAccountState();
    if (state === "active") redirect(next === "/" ? "/tasks" : next);
    if (state === "invited") redirect(`/auth/consent?next=${encodeURIComponent(next)}`);
    declined = state === "inactive_declined";
  } catch (error) {
    if (error instanceof DomainError && (error.code === "AUTH_REQUIRED" || error.code === "SESSION_REVOKED")) redirect(`/auth/login?next=${encodeURIComponent(next)}`);
    if (!(error instanceof DomainError)) throw error;
  }
  return <main className="mx-auto max-w-xl px-4 py-16">
    <h1 className="text-2xl font-semibold">{declined ? CONSENT_COPY.pausedTitle : CONSENT_COPY.deactivatedTitle}</h1>
    <p className="mt-4">{declined ? CONSENT_COPY.pausedBody : CONSENT_COPY.deactivatedBody}</p>
    {declined && <a className="primary-link mt-6 inline-flex min-h-11 items-center" href={`/auth/consent?next=${encodeURIComponent(next === "/" ? "/tasks" : next)}`}>{CONSENT_COPY.pausedReturn}</a>}
  </main>;
}
