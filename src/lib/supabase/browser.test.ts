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
    const client = { kind: "browser" };
    publicSupabaseEnvironment.mockReturnValue({
      url: "https://project.supabase.co",
      publishableKey: "publishable-key",
    });
    createBrowserClient.mockReturnValue(client);

    expect(createBrowserSupabaseClient()).toBe(client);
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
