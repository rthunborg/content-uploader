import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { safeContinuation } from "@/lib/auth/continuation";
import { publicSupabaseEnvironment } from "@/lib/supabase/env";
import { logError } from "@/shared/logger";

const PUBLIC_APP_ROUTES = new Set(["/auth/login", "/auth/confirm"]);

export function authRedirectFor(
  pathname: string,
  search: string,
  authenticated: boolean,
) {
  if (authenticated || PUBLIC_APP_ROUTES.has(pathname)) {
    return null;
  }

  const login = new URL("/auth/login", "https://portal.invalid");
  login.searchParams.set("next", safeContinuation(`${pathname}${search}`));
  return `${login.pathname}${login.search}`;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  let authenticated = false;
  try {
    const { url, publishableKey } = publicSupabaseEnvironment();
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const { data, error } = await supabase.auth.getClaims();
    authenticated = !error && Boolean(data?.claims);
  } catch {
    logError("auth.proxy_claims_failed", new Error("Provider request rejected"), {
      operation: "getClaims",
    });
  }
  const redirectTarget = authRedirectFor(
    request.nextUrl.pathname,
    request.nextUrl.search,
    authenticated,
  );

  if (!redirectTarget) {
    return response;
  }

  const redirectResponse = NextResponse.redirect(
    new URL(redirectTarget, request.url),
  );
  response.cookies.getAll().forEach((cookie) =>
    redirectResponse.cookies.set(cookie),
  );
  return redirectResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
