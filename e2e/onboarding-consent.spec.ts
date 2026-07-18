import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { test, expect } from "./fixtures/auth";

async function publishReplacement(admin: SupabaseClient, base: { payload: { schemaVersion: 1; locale: "sv-SE"; cards: [{ id: "content_usage"; title: string; body: string; legalTextMarkdown: string }, { id: "bystander_consent"; title: string; body: string; legalTextMarkdown: string }, { id: "user_control"; title: string; body: string; legalTextMarkdown: string }] } }, suffix: string) {
  const payload = structuredClone(base.payload);
  const version = `99.${Date.now()}.${suffix}`;
  payload.cards[0].title = `Uppdaterad innehållsrubrik ${suffix}`;
  payload.cards[1].legalTextMarkdown = `Uppdaterad juridisk text ${suffix}`;
  // Keep the schema's canonical property order: the consent hash deliberately
  // covers JSON.stringify output, while JSONB reads may return another key order.
  const cards = payload.cards.map((card) => ({ id: card.id, title: card.title, body: card.body, legalTextMarkdown: card.legalTextMarkdown })) as typeof payload.cards;
  const replacement = { schemaVersion: 1 as const, version, locale: "sv-SE" as const, cards };
  const payloadSha256 = createHash("sha256").update(JSON.stringify(replacement)).digest("hex");
  const inserted = await admin.from("terms_versions").insert({ version, locale: "sv-SE", schema_version: 1, payload: replacement, payload_sha256: payloadSha256 }).select("id").single();
  expect(inserted.error).toBeNull();
  return { id: inserted.data!.id, payload: replacement };
}

test.describe.serial("first-login consent", () => {
  const userIds: string[] = [];
  test.afterEach(async ({ admin }) => { for (const id of userIds.splice(0)) await admin.auth.admin.deleteUser(id); });

  test("follows an invited magic link through accessible cards and atomically activates the profile", async ({ admin, authPage, createInvitedAmbassador, page, publishSyntheticTerms }) => {
    const terms = await publishSyntheticTerms(); const email = `consent-${Date.now()}@example.test`; const invited = await createInvitedAmbassador(email); userIds.push(invited.id);
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(invited.confirmationPath); await expect(page).toHaveURL(/\/auth\/consent\?next=%2Ftasks/);
    for (let index = 0; index < 3; index += 1) {
      await expect(page.getByRole("heading", { name: terms.payload.cards[index]!.title })).toBeVisible();
      await expect(page.getByText(terms.payload.cards[index]!.body)).toBeVisible();
      await expect(page.getByText(`Del ${index + 1} av 3`).last()).toBeVisible();
      await authPage.openConsentLegalText(); await expect(page.getByRole("dialog")).toContainText(terms.payload.cards[index]!.legalTextMarkdown);
      const close = page.getByRole("button", { name: "Stäng" }); await expect(close).toBeFocused(); await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Läs hela villkorstexten" })).toBeFocused();
      if (index < 2) { await authPage.advanceConsentCard(); await expect(page.getByRole("heading", { name: terms.payload.cards[index + 1]!.title })).toBeFocused(); }
    }
    await authPage.expectMinimumTargetAndVisibleKeyboardFocus("button", "Godkänn och aktivera konto");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await authPage.finishConsent(); await expect(page).toHaveURL(/\/tasks$/, { timeout: 15_000 }); await expect(page.getByRole("heading", { name: "Dina uppdrag" })).toBeVisible();
    const profile = await admin.from("profiles").select("account_state,first_accepted_at").eq("id", invited.id).single(); expect(profile.data?.account_state).toBe("active"); expect(profile.data?.first_accepted_at).toBeTruthy();
    const evidence = await admin.from("acceptance_records").select("id,terms_version_id,terms_payload_sha256,occurred_at").eq("user_id_snapshot", invited.id); expect(evidence.data).toHaveLength(1); expect(evidence.data![0]!.terms_version_id).toBe(terms.id);
    const audit = await admin.from("audit_events").select("entity_id").eq("event_type", "consent.accepted").eq("entity_id", evidence.data![0]!.id); expect(audit.data).toHaveLength(1);
    expect(new Date(profile.data!.first_accepted_at!).toISOString()).toBe(new Date(evidence.data![0]!.occurred_at).toISOString());
  });

  test("sanitizes a malicious continuation independently", async ({ createInvitedAmbassador, page, publishSyntheticTerms }) => {
    await publishSyntheticTerms(); const invited = await createInvitedAmbassador(`consent-next-${Date.now()}@example.test`); userIds.push(invited.id);
    await page.goto(invited.confirmationPath.replace("next=/tasks", `next=${encodeURIComponent("//evil.example/steal")}`)); await expect(page).toHaveURL(/\/auth\/consent\?next=%2F/);
    await page.getByRole("button", { name: "Godkänn och fortsätt" }).click(); await page.getByRole("button", { name: "Godkänn och fortsätt" }).click(); await page.getByRole("button", { name: "Godkänn och aktivera konto" }).click();
    await expect(page).toHaveURL(/\/tasks$/, { timeout: 15_000 }); expect(new URL(page.url()).origin).toBe("http://localhost:3000");
  });

  test("declines, pauses without deletion, and returns through a later magic link to reactivate", async ({ admin, authPage, createInvitedAmbassador, page, publishSyntheticTerms }) => {
    const terms = await publishSyntheticTerms();
    const email = `consent-decline-${Date.now()}@example.test`;
    const invited = await createInvitedAmbassador(email); userIds.push(invited.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(invited.confirmationPath);
    await authPage.advanceConsentCard(); await authPage.advanceConsentCard();
    await authPage.expectMinimumTargetAndVisibleKeyboardFocus("button", "Pausa mitt konto");
    await authPage.declineConsent();
    await expect(page).toHaveURL(/\/auth\/paused\?next=%2Ftasks/);
    await expect(page.getByRole("heading", { name: "Ditt konto är pausat" })).toBeVisible();
    await expect(page.getByText(/Inget har raderats/)).toBeVisible();
    await expect(page.getByText(/komma tillbaka när som helst/)).toBeVisible();
    await authPage.expectMinimumTargetAndVisibleKeyboardFocus("link", "Gå tillbaka till villkoren");
    await authPage.expectAccessible();
    expect((await admin.from("profiles").select("account_state").eq("id", invited.id).single()).data?.account_state).toBe("inactive_declined");
    expect((await admin.from("audit_events").select("id").eq("event_type", "consent.declined").eq("actor_id", invited.id)).data).toHaveLength(1);
    expect((await admin.from("acceptance_records").select("id").eq("user_id_snapshot", invited.id)).data).toHaveLength(0);

    await page.context().clearCookies();
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email }); expect(link.error).toBeNull();
    const token = link.data.properties!.hashed_token;
    await page.goto(`/auth/confirm?token_hash=${encodeURIComponent(token)}&type=magiclink&next=${encodeURIComponent("//evil.example/steal")}`);
    await expect(page).toHaveURL(/\/auth\/consent\?next=%2F/);
    await expect(page.getByRole("heading", { name: terms.payload.cards[0].title })).toBeVisible();
    await authPage.advanceConsentCard(); await authPage.advanceConsentCard(); await authPage.finishConsent();
    await expect(page).toHaveURL(/\/tasks$/, { timeout: 15_000 });
    const profile = await admin.from("profiles").select("account_state,first_accepted_at").eq("id", invited.id).single();
    expect(profile.data?.account_state).toBe("active"); expect(profile.data?.first_accepted_at).toBeTruthy();
    expect((await admin.from("acceptance_records").select("id").eq("user_id_snapshot", invited.id)).data).toHaveLength(1);
  });

  test("interposes stale consent, marks every changed card, and resumes a safe deep continuation", async ({ admin, authPage, createInvitedAmbassador, page, publishSyntheticTerms }) => {
    const initial = await publishSyntheticTerms();
    const invited = await createInvitedAmbassador(`reaccept-${Date.now()}@example.test`); userIds.push(invited.id);
    await page.goto(invited.confirmationPath);
    await authPage.advanceConsentCard(); await authPage.advanceConsentCard(); await authPage.finishConsent();
    await expect(page).toHaveURL(/\/tasks$/);
    const firstAcceptedAt = (await admin.from("profiles").select("first_accepted_at").eq("id", invited.id).single()).data!.first_accepted_at;
    const replacement = await publishReplacement(admin, initial, "1");
    await page.goto("/tasks?tab=open");
    await expect(page).toHaveURL(/\/auth\/consent\?next=%2Ftasks%3Ftab%3Dopen/);
    await expect(page.getByRole("heading", { name: "Villkoren har ändrats", exact: true }).first()).toBeVisible();
    await expect(page.getByText("Ändrad sedan ditt senaste godkännande")).toBeVisible();
    await expect(page.getByRole("heading", { name: replacement.payload.cards[0].title })).toBeVisible();
    await authPage.advanceConsentCard();
    await expect(page.getByText("Ändrad sedan ditt senaste godkännande")).toBeVisible();
    await authPage.openConsentLegalText(); await expect(page.getByRole("dialog")).toContainText(replacement.payload.cards[1].legalTextMarkdown); await page.keyboard.press("Escape");
    await authPage.advanceConsentCard();
    await expect(page.getByText("Ändrad sedan ditt senaste godkännande")).toHaveCount(0);
    await authPage.expectMinimumTargetAndVisibleKeyboardFocus("button", "Godkänn uppdaterade villkor");
    await authPage.expectAccessible();
    await authPage.finishReacceptance();
    await expect(page).toHaveURL(/\/tasks\?tab=open$/);
    const profile = await admin.from("profiles").select("account_state,first_accepted_at").eq("id", invited.id).single();
    expect(profile.data).toMatchObject({ account_state: "active", first_accepted_at: firstAcceptedAt });
    const evidence = await admin.from("acceptance_records").select("id,terms_version_id").eq("user_id_snapshot", invited.id).order("occurred_at");
    expect(evidence.data).toHaveLength(2); expect(evidence.data![1]!.terms_version_id).toBe(replacement.id);
    expect((await admin.from("audit_events").select("id").eq("event_type", "consent.accepted").eq("actor_id", invited.id)).data).toHaveLength(2);
    await page.goto(`/auth/consent?next=${encodeURIComponent("/tasks/open?theme=fleet")}`);
    await expect(page).toHaveURL(/\/tasks\/open\?theme=fleet$/);
    await expect(page.getByText("Ändrad sedan ditt senaste godkännande")).toHaveCount(0);
  });

  test("pauses an active stale ambassador while retaining prior evidence", async ({ admin, authPage, createInvitedAmbassador, page, publishSyntheticTerms }) => {
    const initial = await publishSyntheticTerms();
    const invited = await createInvitedAmbassador(`redecline-${Date.now()}@example.test`); userIds.push(invited.id);
    await page.goto(invited.confirmationPath); await authPage.advanceConsentCard(); await authPage.advanceConsentCard(); await authPage.finishConsent();
    await expect(page).toHaveURL(/\/tasks$/);
    await publishReplacement(admin, initial, "2");
    await page.goto("/tasks"); await authPage.advanceConsentCard(); await authPage.advanceConsentCard(); await authPage.declineConsent();
    await expect(page).toHaveURL(/\/auth\/paused\?next=%2Ftasks/);
    expect((await admin.from("profiles").select("account_state").eq("id", invited.id).single()).data?.account_state).toBe("inactive_declined");
    expect((await admin.from("acceptance_records").select("id").eq("user_id_snapshot", invited.id)).data).toHaveLength(1);
    expect((await admin.from("audit_events").select("id").eq("event_type", "consent.declined").eq("actor_id", invited.id)).data).toHaveLength(1);
    await page.goto("/tasks"); await expect(page).toHaveURL(/\/auth\/paused/);
  });

  test("lets an active admin bypass ambassador consent entirely", async ({ admin, createInvitedAmbassador, page, publishSyntheticTerms }) => {
    await publishSyntheticTerms();
    const invited = await createInvitedAmbassador(`admin-bypass-${Date.now()}@example.test`); userIds.push(invited.id);
    expect((await admin.auth.admin.updateUserById(invited.id, { app_metadata: { admin: true } })).error).toBeNull();
    expect((await admin.from("profiles").update({ account_state: "active" }).eq("id", invited.id)).error).toBeNull();
    await page.goto(invited.confirmationPath.replace("next=/tasks", `next=${encodeURIComponent("/admin/ambassadors")}`));
    await expect(page).toHaveURL(/\/admin\/ambassadors$/);
    await expect(page).not.toHaveURL(/\/auth\/consent/);
  });
});
