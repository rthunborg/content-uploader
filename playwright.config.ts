import { execFileSync } from "node:child_process";

import { defineConfig, devices } from "@playwright/test";

function localSupabaseEnvironment() {
  try {
    const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npx";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", "npx supabase --profile supabase/cli-profile.yaml status --output env"]
      : ["supabase", "--profile", "supabase/cli-profile.yaml", "status", "--output", "env"];
    const output = execFileSync(command, args, {
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
      SUPABASE_SECRET_KEY: local.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      // Auth confirmation now enters the server-only DAL to load profile state.
      // Forward the local database URL just as the deployed app receives DATABASE_URL.
      DATABASE_URL: local.DB_URL ?? process.env.DATABASE_URL ?? "",
      ACCEPTANCE_HMAC_KEY: process.env.ACCEPTANCE_HMAC_KEY ?? "ERERERERERERERERERERERERERERERERERERERERERE=",
      CONSENT_PII_KEK: process.env.CONSENT_PII_KEK ?? "IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI=",
    },
  },
});
