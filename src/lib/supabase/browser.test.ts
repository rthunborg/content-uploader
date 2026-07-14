import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserClient, publicSupabaseEnvironment } = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
  publicSupabaseEnvironment: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createBrowserClient }));
vi.mock("./env", () => ({ publicSupabaseEnvironment }));

import { createBrowserSupabaseClient } from "./browser";

describe("createBrowserSupabaseClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the exact public environment values to Supabase", () => {
    const client = { auth: { kind: "auth", getSession: vi.fn() }, storage: { kind: "storage" }, from: vi.fn() };
    publicSupabaseEnvironment.mockReturnValue({
      url: "https://project.supabase.co",
      publishableKey: "publishable-key",
    });
    createBrowserClient.mockReturnValue(client);

    const facade = createBrowserSupabaseClient();
    expect(facade.auth).toBe(client.auth);
    expect(facade.getTusAccessToken).toEqual(expect.any(Function));
    expect(facade).not.toHaveProperty("from");
    expect(facade).not.toHaveProperty("storage");
    expect(createBrowserClient).toHaveBeenCalledOnce();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "publishable-key",
    );
  });

  it("propagates predictable environment failures without provider access", () => {
    publicSupabaseEnvironment.mockImplementation(() => {
      throw new Error("Missing required public environment variable: NEXT_PUBLIC_SUPABASE_URL");
    });

    expect(() => createBrowserSupabaseClient()).toThrow(
      "Missing required public environment variable: NEXT_PUBLIC_SUPABASE_URL",
    );
    expect(createBrowserClient).not.toHaveBeenCalled();
  });
});
