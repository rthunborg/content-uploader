import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function localEnvironment() {
  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npx";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", "npx supabase --profile content-uploader status --output env"]
    : ["supabase", "--profile", "content-uploader", "status", "--output", "env"];
  const output = execFileSync(command, args, { encoding: "utf8" });
  return Object.fromEntries(output.split("\n").map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/)).filter((match): match is RegExpMatchArray => Boolean(match)).map((match) => [match[1], match[2]]));
}

const TABLES = ["profiles", "assets", "themes", "asset_themes", "campaigns", "asset_campaigns"] as const;

describe.sequential("Story 1.5 required local RLS role matrix", () => {
  const env = localEnvironment();
  const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY);
  const anon = createClient(env.API_URL, env.ANON_KEY);
  let ambassador: SupabaseClient;
  let admin: SupabaseClient;
  let inactive: SupabaseClient;
  let invited: SupabaseClient;
  const ids: string[] = [];
  let assetId: string;
  let themeId: string;
  let campaignId: string;

  async function authenticatedClient(email: string, appMetadata: Record<string, unknown> = {}) {
    const { data: created, error } = await service.auth.admin.createUser({ email, email_confirm: true, app_metadata: appMetadata });
    expect(error).toBeNull(); ids.push(created.user!.id);
    const { data: link, error: linkError } = await service.auth.admin.generateLink({ type: "magiclink", email });
    expect(linkError).toBeNull();
    if (!link.properties) throw new Error("Local Supabase did not return link properties");
    const client = createClient(env.API_URL, env.ANON_KEY);
    const { error: otpError } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
    expect(otpError).toBeNull();
    return { client, id: created.user!.id };
  }

  beforeAll(async () => {
    const ambassadorUser = await authenticatedClient(`rls-amb-${Date.now()}@example.test`);
    const adminUser = await authenticatedClient(`rls-admin-${Date.now()}@example.test`, { admin: true });
    const inactiveUser = await authenticatedClient(`rls-inactive-${Date.now()}@example.test`);
    const invitedUser = await authenticatedClient(`rls-invited-${Date.now()}@example.test`);
    ambassador = ambassadorUser.client; admin = adminUser.client; inactive = inactiveUser.client; invited = invitedUser.client;
    expect((await service.from("profiles").insert([
      { id: ambassadorUser.id, email: "amb@example.test", account_state: "active" },
      { id: adminUser.id, email: "admin@example.test", account_state: "active" },
      { id: inactiveUser.id, email: "inactive@example.test", account_state: "deactivated" },
      { id: invitedUser.id, email: "invited@example.test", account_state: "invited" },
    ])).error).toBeNull();
    const asset = await service.from("assets").insert({}).select("id").single(); expect(asset.error).toBeNull(); assetId = asset.data!.id;
    const theme = await service.from("themes").insert({ name: `RLS ${Date.now()}` }).select("id").single(); expect(theme.error).toBeNull(); themeId = theme.data!.id;
    const campaign = await service.from("campaigns").insert({ name: "RLS", description: "matrix", starts_at: "2026-01-01T00:00:00Z", ends_at: "2026-12-31T00:00:00Z" }).select("id").single(); expect(campaign.error).toBeNull(); campaignId = campaign.data!.id;
    expect((await service.from("asset_themes").insert({ asset_id: assetId, theme_id: themeId })).error).toBeNull();
    expect((await service.from("asset_campaigns").insert({ asset_id: assetId, campaign_id: campaignId })).error).toBeNull();
  }, 30_000);

  afterAll(async () => {
    await service.from("assets").delete().eq("id", assetId);
    await service.from("campaigns").delete().eq("id", campaignId);
    await service.from("themes").delete().eq("id", themeId);
    for (const id of ids) await service.auth.admin.deleteUser(id);
  });

  it("denies anon and inactive actors across every baseline table", async () => {
    for (const table of TABLES) {
      const anonymous = await anon.from(table).select("*");
      expect(anonymous.error?.code, `${table} anon grant`).toBe("42501");
      const deactivated = await inactive.from(table).select("*");
      expect(deactivated.error, `${table} inactive query`).toBeNull();
      expect(deactivated.data, `${table} inactive leak`).toEqual([]);
    }
  });

  it("allows an active ambassador only own profile and shared organization reads", async () => {
    for (const table of TABLES) {
      const result = await ambassador.from(table).select("*"); expect(result.error).toBeNull();
      if (table === "profiles") expect(result.data).toHaveLength(1);
      else if (table === "themes" || table === "campaigns") expect(result.data!.length).toBeGreaterThan(0);
      else expect(result.data).toHaveLength(0);
    }
  });

  it("denies own-profile reads to an invited (non-active) actor the app guard admits", async () => {
    // authenticated() lets `invited` through for onboarding, but RLS is defense-in-depth:
    // profiles_read_active_own requires account_state = 'active', so RLS must still leak nothing.
    const result = await invited.from("profiles").select("*");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it("allows an active metadata admin to read every baseline table", async () => {
    for (const table of TABLES) {
      const result = await admin.from(table).select("*"); expect(result.error).toBeNull();
      expect(result.data!.length, `${table} admin visibility`).toBeGreaterThan(0);
    }
  });

  it("allows service role across every baseline table", async () => {
    for (const table of TABLES) {
      const result = await service.from(table).select("*"); expect(result.error).toBeNull();
      expect(result.data!.length, `${table} service visibility`).toBeGreaterThan(0);
    }
  });

  it("denies writes to anon and authenticated actors across every baseline table", async () => {
    // Table-level privilege is checked before row constraints, so a denied role fails with
    // 42501 regardless of payload; this pins the least-privilege "writes denied at baseline" invariant.
    for (const table of TABLES) {
      const anonWrite = await anon.from(table).insert({});
      expect(anonWrite.error?.code, `${table} anon insert`).toBe("42501");
      const ambassadorWrite = await ambassador.from(table).insert({});
      expect(ambassadorWrite.error?.code, `${table} ambassador insert`).toBe("42501");
      const adminWrite = await admin.from(table).insert({});
      expect(adminWrite.error?.code, `${table} admin insert`).toBe("42501");
    }
  });
});
