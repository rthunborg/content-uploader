import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { test as base, expect } from "@playwright/test";

import { AuthPage } from "../pages/auth-page";

type LocalAuth = {
  authPage: AuthPage;
  admin: ReturnType<typeof createClient>;
  latestLink(email: string): Promise<string>;
  clearMail(): Promise<void>;
};

function statusEnvironment() {
  let output: string;
  try {
    const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npx";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", "npx supabase --profile content-uploader status --output env"]
      : ["supabase", "--profile", "content-uploader", "status", "--output", "env"];
    output = execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(
      "Local Supabase is required for auth E2E; run `npx supabase start` before Playwright.",
      { cause: error },
    );
  }
  const parsed = Object.fromEntries(
    output.split("\n").flatMap((line) => {
      const match = line.match(/^([A-Z_]+)="?(.*?)"?$/);
      return match ? [[match[1], match[2]]] : [];
    }),
  );
  for (const key of ["API_URL", "SERVICE_ROLE_KEY"] as const) {
    if (!parsed[key]) {
      throw new Error(`Supabase status did not provide required ${key} for auth E2E.`);
    }
  }
  if (!parsed.MAILPIT_URL) {
    throw new Error(
      "Supabase status did not provide MAILPIT_URL; the auth E2E helpers use the Mailpit REST API and require a Mailpit-backed local stack.",
    );
  }
  return parsed;
}

const env = statusEnvironment();
const apiUrl = env.API_URL;
const mailUrl = env.MAILPIT_URL;

async function mailpit(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${mailUrl}${path}`, init);
  } catch (error) {
    throw new Error(`Mailpit request failed: ${init?.method ?? "GET"} ${path}.`, { cause: error });
  }
  if (!response.ok) {
    throw new Error(
      `Mailpit request failed: ${init?.method ?? "GET"} ${path} returned ${response.status}.`,
    );
  }
  return response;
}

async function clearMail() {
  await mailpit("/api/v1/messages", { method: "DELETE" });
}

async function latestLink(email: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const list = await mailpit("/api/v1/messages").then((response) => response.json()) as {
      messages?: Array<{ ID: string; To?: Array<{ Address: string }> }>;
    };
    const message = list.messages?.find((candidate) => candidate.To?.some((to) => to.Address === email));
    if (message) {
      const detail = await mailpit(`/api/v1/message/${encodeURIComponent(message.ID)}`).then((response) => response.json()) as { HTML?: string };
      const hrefs = [...(detail.HTML ?? "").matchAll(/href=["']([^"']+)["']/gi)]
        .map((match) => match[1].replaceAll("&amp;", "&"));
      const confirmation = hrefs.find((href) => {
        try {
          return new URL(href, mailUrl).pathname === "/auth/confirm";
        } catch {
          return false;
        }
      });
      if (confirmation) return confirmation;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No local auth email arrived for ${email}`);
}

export const test = base.extend<LocalAuth>({
  authPage: async ({ page }, use) => use(new AuthPage(page)),
  admin: async ({}, use) => use(createClient(apiUrl, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } })),
  latestLink: async ({}, use) => use(latestLink),
  clearMail: async ({}, use) => use(clearMail),
});

export { expect };
