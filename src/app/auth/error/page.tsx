import Link from "next/link";

import { AUTH_COPY } from "@/app/auth/auth-flow";
import { safeContinuation } from "@/lib/auth/continuation";

type LinkErrorPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LinkErrorPage({ searchParams }: LinkErrorPageProps) {
  const params = await searchParams;
  const requestedNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const loginUrl = new URL("/auth/login", "https://portal.invalid");
  loginUrl.searchParams.set("next", safeContinuation(requestedNext));

  return (
    <main className="auth-shell">
      <section aria-labelledby="link-error-title" className="auth-panel">
        <p className="eyebrow">Stena Content Portal</p>
        <h1 id="link-error-title">{AUTH_COPY.linkExpiredTitle}</h1>
        <p className="intro">{AUTH_COPY.linkExpiredReason}</p>
        <p>{AUTH_COPY.linkExpiredRemedy}</p>
        <Link className="primary-link" href={`${loginUrl.pathname}${loginUrl.search}`}>
          {AUTH_COPY.requestFreshLink}
        </Link>
      </section>
    </main>
  );
}
