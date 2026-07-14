"use client";

import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { safeContinuation } from "@/lib/auth/continuation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { ErrorCode } from "@/shared/error-codes";

function errorCode(error: unknown): ErrorCode | undefined {
  if (!error || typeof error !== "object") return undefined;
  const direct = "code" in error ? error.code : undefined;
  const nested = "error" in error && error.error && typeof error.error === "object" && "code" in error.error ? error.error.code : undefined;
  const candidates = [direct, nested].filter((value): value is string => typeof value === "string");
  // Prefer a recognized auth code from either level so a non-auth outer code cannot
  // shadow a nested SESSION_REVOKED/CONSENT_REQUIRED and skip global auth routing.
  const authCode = candidates.find((value) => value === "SESSION_REVOKED" || value === "CONSENT_REQUIRED");
  return (authCode ?? candidates[0]) as ErrorCode | undefined;
}

function isAuthRoutingCode(error: unknown): boolean {
  const code = errorCode(error);
  return code === "SESSION_REVOKED" || code === "CONSENT_REQUIRED";
}

type AuthErrorEnvironment = {
  currentLocation(): { pathname: string; search: string };
  navigate(url: string): void;
  signOut(): Promise<unknown>;
};

const browserEnvironment: AuthErrorEnvironment = {
  currentLocation: () => window.location,
  navigate: (url) => window.location.assign(url),
  signOut: () => createBrowserSupabaseClient().auth.signOut({ scope: "local" }),
};

// Returns true when a navigation was issued (or attempted). Returns false when the
// error required no routing (non-auth code, SSR, or already on the target page) so
// the caller can release its in-flight latch instead of stranding future errors.
export async function handleGlobalAuthError(
  error: unknown,
  environment?: AuthErrorEnvironment,
): Promise<boolean> {
  if (!environment && typeof window === "undefined") return false;
  const activeEnvironment = environment ?? browserEnvironment;
  const code = errorCode(error);
  if (code !== "SESSION_REVOKED" && code !== "CONSENT_REQUIRED") return false;
  const location = activeEnvironment.currentLocation();
  const pathname = location.pathname === "/" ? "/" : location.pathname.replace(/\/+$/, "");
  const current = safeContinuation(`${location.pathname}${location.search}`);
  const target = code === "SESSION_REVOKED" ? "/auth/login" : "/auth/consent";
  if (pathname === target) return false;
  try {
    if (code === "SESSION_REVOKED") await activeEnvironment.signOut();
  } finally {
    activeEnvironment.navigate(`${target}?next=${encodeURIComponent(current)}`);
  }
  return true;
}

export function createGlobalAuthErrorHandler(environment?: AuthErrorEnvironment) {
  let redirectInFlight = false;
  return (error: unknown) => {
    if (redirectInFlight) return;
    const code = errorCode(error);
    if (code !== "SESSION_REVOKED" && code !== "CONSENT_REQUIRED") return;
    redirectInFlight = true;
    handleGlobalAuthError(error, environment).then(
      // Release the latch when nothing navigated (e.g. already on the target page),
      // otherwise a single no-op auth error would permanently swallow later ones.
      (navigated) => { if (!navigated) redirectInFlight = false; },
      // A rejection means navigation was already attempted in the finally block; keep the latch held.
      () => {},
    );
  };
}

export function createQueryClient(environment?: AuthErrorEnvironment) {
  const onError = createGlobalAuthErrorHandler(environment);
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Never retry an auth-routing code: a revoked/consent-required query must reach
        // the global onError handler immediately, not after three futile retries that
        // both delay the sign-out/consent redirect and re-issue doomed authenticated requests.
        retry: (failureCount, error) => !isAuthRoutingCode(error) && failureCount < 3,
      },
    },
  });
}
