import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures/auth";

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
    await authPage.finishConsent(); await expect(page).toHaveURL(/\/tasks$/); await expect(page.getByRole("heading", { name: "Dina uppdrag" })).toBeVisible();
    const profile = await admin.from("profiles").select("account_state,first_accepted_at").eq("id", invited.id).single(); expect(profile.data?.account_state).toBe("active"); expect(profile.data?.first_accepted_at).toBeTruthy();
    const evidence = await admin.from("acceptance_records").select("id,terms_version_id,terms_payload_sha256,occurred_at").eq("user_id_snapshot", invited.id); expect(evidence.data).toHaveLength(1); expect(evidence.data![0]!.terms_version_id).toBe(terms.id);
    const audit = await admin.from("audit_events").select("entity_id").eq("event_type", "consent.accepted").eq("entity_id", evidence.data![0]!.id); expect(audit.data).toHaveLength(1);
    expect(new Date(profile.data!.first_accepted_at!).toISOString()).toBe(new Date(evidence.data![0]!.occurred_at).toISOString());
  });

  test("sanitizes a malicious continuation independently", async ({ createInvitedAmbassador, page, publishSyntheticTerms }) => {
    await publishSyntheticTerms(); const invited = await createInvitedAmbassador(`consent-next-${Date.now()}@example.test`); userIds.push(invited.id);
    await page.goto(invited.confirmationPath.replace("next=/tasks", `next=${encodeURIComponent("//evil.example/steal")}`)); await expect(page).toHaveURL(/\/auth\/consent\?next=%2F/);
    await page.getByRole("button", { name: "Godkänn och fortsätt" }).click(); await page.getByRole("button", { name: "Godkänn och fortsätt" }).click(); await page.getByRole("button", { name: "Godkänn och aktivera konto" }).click();
    await expect(page).toHaveURL(/\/tasks$/); expect(new URL(page.url()).origin).toBe("http://localhost:3000");
  });
});
