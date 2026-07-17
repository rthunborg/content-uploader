import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { test as base, expect } from "@playwright/test";

import { AuthPage } from "../pages/auth-page";

type LocalAuth = {
  authPage: AuthPage;
  admin: ReturnType<typeof createClient>;
  latestLink(email: string): Promise<string>;
  clearMail(): Promise<void>;
  publishSyntheticTerms(): Promise<{ id: string; payload: SyntheticTerms }>;
  createInvitedAmbassador(email: string, fullName?: string): Promise<{ id: string; confirmationPath: string }>;
};

export type SyntheticTerms = { schemaVersion: 1; version: string; locale: "sv-SE"; cards: [{ id: "content_usage"; title: string; body: string; legalTextMarkdown: string }, { id: "bystander_consent"; title: string; body: string; legalTextMarkdown: string }, { id: "user_control"; title: string; body: string; legalTextMarkdown: string }] };

function statusEnvironment() {
  let output: string;
  try {
    const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npx";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", "npx supabase --profile supabase/cli-profile.yaml status --output env"]
      : ["supabase", "--profile", "supabase/cli-profile.yaml", "status", "--output", "env"];
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
  publishSyntheticTerms: async ({ admin }, use) => use(async () => {
    const payload: SyntheticTerms = { schemaVersion: 1, version: "99.32.0", locale: "sv-SE", cards: [
      { id: "content_usage", title: "Syntetiskt samtycke: innehåll", body: "Detta är omisskännligt syntetisk testtext för innehåll.", legalTextMarkdown: "Fullständig syntetisk juridisk text för innehåll." },
      { id: "bystander_consent", title: "Syntetiskt samtycke: personer", body: "Detta är omisskännligt syntetisk testtext för personer.", legalTextMarkdown: "Fullständig syntetisk juridisk text för personer." },
      { id: "user_control", title: "Syntetiskt samtycke: kontroll", body: "Detta är omisskännligt syntetisk testtext för kontroll.", legalTextMarkdown: "Fullständig syntetisk juridisk text för kontroll." },
    ] };
    const existing = await admin.from("terms_versions").select("id,payload").eq("version", payload.version).eq("locale", payload.locale).maybeSingle();
    expect(existing.error).toBeNull();
    if (existing.data) return { id: existing.data.id, payload: existing.data.payload as SyntheticTerms };
    const payloadSha256 = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const inserted = await admin.from("terms_versions").insert({ version: payload.version, locale: payload.locale, schema_version: 1, payload, payload_sha256: payloadSha256 }).select("id").single();
    expect(inserted.error).toBeNull(); return { id: inserted.data!.id, payload };
  }),
  createInvitedAmbassador: async ({ admin }, use) => use(async (email, fullName = "Syntetisk Ambassadör") => {
    const created = await admin.auth.admin.createUser({ email, email_confirm: true }); expect(created.error).toBeNull();
    const id = created.data.user!.id;
    try {
      const profile = await admin.from("profiles").insert({ id, full_name: fullName, email, account_state: "invited", invited_at: new Date().toISOString() }); expect(profile.error).toBeNull();
      const link = await admin.auth.admin.generateLink({ type: "magiclink", email }); expect(link.error).toBeNull();
      const token = link.data.properties!.hashed_token;
      return { id, confirmationPath: `/auth/confirm?token_hash=${encodeURIComponent(token)}&type=magiclink&next=/tasks` };
    } catch (error) {
      await admin.auth.admin.deleteUser(id);
      throw error;
    }
  }),
});

export { expect };
