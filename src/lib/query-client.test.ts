// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn().mockResolvedValue({ error: null }) }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabaseClient: () => ({ auth: { signOut } }) }));
import { createQueryClient, handleGlobalAuthError } from "./query-client";

describe("global query auth routing", () => {
  const navigate = vi.fn();
  const environment = (pathname: string, search = "") => ({
    currentLocation: () => ({ pathname, search }),
    navigate,
    signOut,
  });
  beforeEach(() => { vi.clearAllMocks(); });
  it("signs out locally before revoked-session login routing", async () => {
    await handleGlobalAuthError(
      { code: "SESSION_REVOKED" },
      environment("/tasks", "?tab=open"),
    );
    expect(signOut).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith("/auth/login?next=%2Ftasks%3Ftab%3Dopen");
  });
  it("prevents consent redirect loops", async () => {
    await handleGlobalAuthError(
      { error: { code: "CONSENT_REQUIRED" } },
      environment("/auth/consent", "?next=%2Ftasks"),
    );
    expect(navigate).not.toHaveBeenCalled();
  });
  it("navigates even when local sign-out rejects", async () => {
    signOut.mockRejectedValueOnce(new Error("local failure"));
    await expect(handleGlobalAuthError({ code: "SESSION_REVOKED" }, environment("/tasks"))).rejects.toThrow("local failure");
    expect(navigate).toHaveBeenCalledWith("/auth/login?next=%2Ftasks");
  });
  it("uses a valid nested code when the outer code is non-string and normalizes loop slashes", async () => {
    await handleGlobalAuthError({ code: 500, error: { code: "CONSENT_REQUIRED" } }, environment("/auth/consent/"));
    expect(navigate).not.toHaveBeenCalled();
  });
  it("wires both caches and suppresses duplicate in-flight redirects", async () => {
    const client = createQueryClient(environment("/tasks"));
    await expect(client.fetchQuery({ queryKey: ["revoked"], queryFn: () => Promise.reject({ code: "SESSION_REVOKED" }), retry: false })).rejects.toBeDefined();
    await expect(client.getMutationCache().build(client, { mutationFn: () => Promise.reject({ code: "CONSENT_REQUIRED" }) }).execute(undefined)).rejects.toBeDefined();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  });
  it("releases the in-flight latch when a no-op auth error does not navigate", async () => {
    let pathname = "/auth/consent";
    const localNavigate = vi.fn();
    const client = createQueryClient({ currentLocation: () => ({ pathname, search: "" }), navigate: localNavigate, signOut });
    // A CONSENT_REQUIRED fired while already on /auth/consent must not navigate and must release the latch.
    await expect(client.fetchQuery({ queryKey: ["consent"], queryFn: () => Promise.reject({ error: { code: "CONSENT_REQUIRED" } }), retry: false })).rejects.toBeDefined();
    await Promise.resolve();
    expect(localNavigate).not.toHaveBeenCalled();
    // A later SESSION_REVOKED from another page must still route, proving the latch was released.
    pathname = "/tasks";
    await expect(client.fetchQuery({ queryKey: ["revoked"], queryFn: () => Promise.reject({ code: "SESSION_REVOKED" }), retry: false })).rejects.toBeDefined();
    await vi.waitFor(() => expect(localNavigate).toHaveBeenCalledWith("/auth/login?next=%2Ftasks"));
  });
  it("does not retry auth-routing codes but keeps default retries for other errors", () => {
    const client = createQueryClient(environment("/tasks"));
    const retry = client.getDefaultOptions().queries?.retry as (n: number, error: unknown) => boolean;
    expect(retry(0, { code: "SESSION_REVOKED" })).toBe(false);
    expect(retry(0, { error: { code: "CONSENT_REQUIRED" } })).toBe(false);
    expect(retry(0, { code: "INTERNAL_ERROR" })).toBe(true);
    expect(retry(3, { code: "INTERNAL_ERROR" })).toBe(false);
  });
  it("routes on a nested auth code even when the outer code is a non-auth string", async () => {
    const localNavigate = vi.fn();
    await handleGlobalAuthError(
      { code: "ERR_NETWORK", error: { code: "SESSION_REVOKED" } },
      { currentLocation: () => ({ pathname: "/tasks", search: "" }), navigate: localNavigate, signOut },
    );
    expect(localNavigate).toHaveBeenCalledWith("/auth/login?next=%2Ftasks");
  });
});
