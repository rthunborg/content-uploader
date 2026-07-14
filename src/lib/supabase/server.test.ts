import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, cookies, createServerClient, publicSupabaseEnvironment } =
  vi.hoisted(() => ({
    cookieStore: { getAll: vi.fn(), set: vi.fn() },
    cookies: vi.fn(),
    createServerClient: vi.fn(),
    publicSupabaseEnvironment: vi.fn(),
  }));

vi.mock("next/headers", () => ({ cookies }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("./env", () => ({ publicSupabaseEnvironment }));

import { createServerSupabaseClient } from "./server";

describe("createServerSupabaseClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookies.mockResolvedValue(cookieStore);
  });

  it("passes exact environment values and cookie adapters to Supabase", async () => {
    const client = { kind: "server" };
    publicSupabaseEnvironment.mockReturnValue({
      url: "https://project.supabase.co",
      publishableKey: "publishable-key",
    });
    createServerClient.mockReturnValue(client);
    cookieStore.getAll.mockReturnValue([{ name: "session", value: "value" }]);

    await expect(createServerSupabaseClient()).resolves.toBe(client);
    expect(createServerClient).toHaveBeenCalledOnce();
    const [url, key, options] = createServerClient.mock.calls[0];
    expect([url, key]).toEqual([
      "https://project.supabase.co",
      "publishable-key",
    ]);
    expect(options.cookies.getAll()).toEqual([{ name: "session", value: "value" }]);
    options.cookies.setAll([
      { name: "session", value: "refreshed", options: { httpOnly: true } },
    ]);
    expect(cookieStore.set).toHaveBeenCalledWith(
      "session",
      "refreshed",
      { httpOnly: true },
    );
  });

  it("propagates predictable environment failures without provider access", async () => {
    publicSupabaseEnvironment.mockImplementation(() => {
      throw new Error("Missing required public environment variable: NEXT_PUBLIC_SUPABASE_URL");
    });

    await expect(createServerSupabaseClient()).rejects.toThrow(
      "Missing required public environment variable: NEXT_PUBLIC_SUPABASE_URL",
    );
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
