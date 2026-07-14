import { AUTH_COPY } from "@/app/auth/auth-flow";
import { safeContinuation } from "@/lib/auth/continuation";

import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const requestedNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <main className="auth-shell">
      <section aria-labelledby="login-title" className="auth-panel">
        <p className="eyebrow">Stena Content Portal</p>
        <h1 id="login-title">Logga in</h1>
        <p className="intro">
          Ange din e-postadress så skickar vi en säker engångslänk.
        </p>
        {error === "link_invalid" ? (
          <p className="message message-error" role="alert">
            {AUTH_COPY.linkInvalid}
          </p>
        ) : null}
        <LoginForm next={safeContinuation(requestedNext)} />
      </section>
    </main>
  );
}
