import { afterEach, describe, expect, it } from "vitest";

import { publicSupabaseEnvironment } from "./env";

const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("publicSupabaseEnvironment", () => {
  it("returns the exact public constructor inputs", () => {
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    };

    expect(publicSupabaseEnvironment()).toEqual({
      url: "https://project.supabase.co",
      publishableKey: "publishable-key",
    });
  });

  it.each([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ])("fails predictably when %s is missing", (name) => {
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    };
    delete process.env[name];

    expect(() => publicSupabaseEnvironment()).toThrow(
      `Missing required public environment variable: ${name}`,
    );
  });
});
