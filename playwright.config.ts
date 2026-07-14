import { execFileSync } from "node:child_process";

import { defineConfig, devices } from "@playwright/test";

function localSupabaseEnvironment() {
  try {
    const output = execFileSync("npx", ["supabase", "status", "--output", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return Object.fromEntries(
      output
        .split("\n")
        .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
        .filter((match): match is RegExpMatchArray => Boolean(match))
        .map((match) => [match[1], match[2]]),
    );
  } catch {
    return {};
  }
}

const local = localSupabaseEnvironment();
const supabaseUrl = local.API_URL ?? "http://127.0.0.1:55321";
const publishableKey = local.ANON_KEY ?? "";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/auth/login",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    },
  },
});
