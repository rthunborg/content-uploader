import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getClaims } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: createClient }));
vi.mock("@/lib/supabase/env", () => ({
  publicSupabaseEnvironment: () => ({ url: "https://supabase.invalid", publishableKey: "public" }),
}));

import { authRedirectFor, proxy } from "./proxy";

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockReturnValue({ auth: { getClaims } });
});

describe("proxy route gate", () => {
  it.each(["/auth/login", "/auth/confirm"])(
    "keeps the public auth route public: %s",
    (pathname) => {
      expect(authRedirectFor(pathname, "", false)).toBeNull();
    },
  );

  it("redirects a private route and preserves an allow-listed continuation", () => {
    expect(authRedirectFor("/tasks", "?filter=open", false)).toBe(
      "/auth/login?next=%2Ftasks%3Ffilter%3Dopen",
    );
  });

  it("does not preserve unknown routes as continuations", () => {
    expect(authRedirectFor("/unknown", "", false)).toBe(
      "/auth/login?next=%2F",
    );
  });

  it("allows authenticated requests", () => {
    expect(authRedirectFor("/tasks", "", true)).toBeNull();
  });
});

describe("proxy provider boundary", () => {
  it("passes through an authenticated request", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "user" } }, error: null });
    const response = await proxy(new NextRequest("https://portal.example/tasks"));
    expect(response.headers.get("location")).toBeNull();
  });

  it.each([
    ["unauthenticated", () => getClaims.mockResolvedValue({ data: null, error: null })],
    ["provider rejection", () => getClaims.mockRejectedValue(new Error("provider detail"))],
  ])("redirects safely when %s", async (_label, arrange) => {
    arrange();
    const response = await proxy(new NextRequest("https://portal.example/tasks?filter=open"));
    expect(response.headers.get("location")).toBe(
      "https://portal.example/auth/login?next=%2Ftasks%3Ffilter%3Dopen",
    );
  });

  it.each([
    ["pass-through", true],
    ["redirect", false],
  ])("retains refreshed cookies on %s", async (_label, authenticated) => {
    createClient.mockImplementation((_url, _key, options) => ({
      auth: {
        getClaims: async () => {
          options.cookies.setAll([
            { name: "sb-session", value: "refreshed", options: { httpOnly: true } },
          ]);
          return authenticated
            ? { data: { claims: { sub: "user" } }, error: null }
            : { data: null, error: null };
        },
      },
    }));
    const response = await proxy(new NextRequest("https://portal.example/tasks"));
    expect(response.cookies.get("sb-session")?.value).toBe("refreshed");
  });
});
