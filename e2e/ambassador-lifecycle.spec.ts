import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/auth";

type AdminClient = Parameters<Parameters<typeof test>[1]>[0]["admin"];

async function createIdentity(
  admin: AdminClient,
  email: string,
  options: { admin?: boolean; fullName?: string } = {},
) {
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: options.admin ? { admin: true } : {},
  });
  expect(created.error).toBeNull();
  const inserted = await admin.from("profiles").insert({
    id: created.data.user!.id,
    full_name: options.fullName ?? null,
    email,
    account_state: "active",
  });
  if (inserted.error) {
    await admin.auth.admin.deleteUser(created.data.user!.id);
    throw new Error("Failed to create lifecycle E2E profile", {
      cause: inserted.error,
    });
  }
  return created.data.user!;
}

async function login(admin: AdminClient, page: Page, email: string, next: string) {
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  expect(link.error).toBeNull();
  await page.goto(
    `/auth/confirm?token_hash=${link.data.properties!.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`,
  );
}

test.describe.serial("ambassador lifecycle management", () => {
  const createdIds: string[] = [];

  test.afterEach(async ({ admin }) => {
    for (const id of createdIds.splice(0)) await admin.auth.admin.deleteUser(id);
  });

  test("deactivates and reactivates from detail with refresh, audit, axe, and paused routing", async ({
    admin,
    browser,
    page,
  }) => {
    const stamp = Date.now();
    const administrator = await createIdentity(
      admin,
      `lifecycle-admin-${stamp}@example.test`,
      { admin: true, fullName: "Portal Admin" },
    );
    createdIds.push(administrator.id);
    const ambassador = await createIdentity(
      admin,
      `lifecycle-ambassador-${stamp}@example.test`,
      { fullName: "Lifecycle Ambassador" },
    );
    createdIds.push(ambassador.id);

    const ambassadorContext = await browser.newContext();
    const ambassadorPage = await ambassadorContext.newPage();
    try {
      await login(admin, ambassadorPage, ambassador.email!, "/auth/consent");
      const beforeDeactivate = await ambassadorPage.request.get("/api/ambassadors/me");
      expect(beforeDeactivate.status()).toBe(409);

      await login(admin, page, administrator.email!, `/admin/ambassadors/${ambassador.id}`);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole("heading", { name: "Lifecycle Ambassador" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Hantera kontoåtkomst" })).toBeVisible();
      await expect(page.getByText(/avslutar aktiva sessioner/)).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

      const confirm = page.getByLabel(/Jag förstår/);
      const deactivate = page.getByRole("button", { name: "Avaktivera konto" });
      await expect(deactivate).toBeDisabled();
      await confirm.focus();
      await page.keyboard.press("Space");
      await expect(confirm).toBeChecked();
      await page.keyboard.press("Tab");
      await expect(deactivate).toBeFocused();
      const deactivationResponse = page.waitForResponse((response) => (
        response.url().includes(`/api/ambassadors/${ambassador.id}`)
        && response.request().method() === "PATCH"
      ));
      await page.keyboard.press("Enter");
      const deactivationResult = await deactivationResponse;
      expect(deactivationResult.ok(), await deactivationResult.text()).toBe(true);
      await expect(page.getByText("Avaktiverad")).toBeVisible({ timeout: 15_000 });

      const deactivated = await admin.from("profiles")
        .select("account_state")
        .eq("id", ambassador.id)
        .single();
      expect(deactivated.error).toBeNull();
      expect(deactivated.data?.account_state).toBe("deactivated");
      const deactivationAudit = await admin.from("audit_events")
        .select("event_type,entity_snapshot")
        .eq("entity_id", ambassador.id)
        .eq("event_type", "account.deactivated");
      expect(deactivationAudit.error).toBeNull();
      expect(deactivationAudit.data).toHaveLength(1);
      expect(deactivationAudit.data?.[0]?.entity_snapshot).toMatchObject({
        beforeAccountState: "active",
        afterAccountState: "deactivated",
      });

      const existingSession = await ambassadorPage.request.get("/api/ambassadors/me");
      expect(existingSession.status()).toBe(401);
      expect(await existingSession.json()).toMatchObject({
        error: { code: "SESSION_REVOKED" },
      });

      const pausedContext = await browser.newContext();
      try {
        const pausedLogin = await pausedContext.newPage();
        const link = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: ambassador.email!,
        });
        expect(link.error).toBeNull();
        await pausedLogin.goto(
          `/auth/confirm?token_hash=${link.data.properties!.hashed_token}&type=magiclink&next=/`,
        );
        await expect(pausedLogin).toHaveURL("http://localhost:3000/auth/paused");
        await expect(pausedLogin.getByRole("heading", { name: "Ditt konto är pausat" })).toBeVisible();
      } finally {
        await pausedContext.close();
      }

      await page.goto("/admin/ambassadors");
      await expect(page.getByRole("link", { name: "Lifecycle Ambassador" })).toBeVisible();
      await expect(page.locator("li").filter({ hasText: "Lifecycle Ambassador" }).getByText("Avaktiverad")).toBeVisible();
      await page.getByRole("link", { name: "Lifecycle Ambassador" }).click();
      await expect(page.getByRole("button", { name: "Återaktivera konto" })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

      const reactivationResponse = page.waitForResponse((response) => (
        response.url().includes(`/api/ambassadors/${ambassador.id}`)
        && response.request().method() === "PATCH"
      ));
      await page.getByRole("button", { name: "Återaktivera konto" }).click();
      const reactivationResult = await reactivationResponse;
      expect(reactivationResult.ok(), await reactivationResult.text()).toBe(true);
      await expect(page.locator("article dd").filter({ hasText: /^Aktiv$/ })).toBeVisible({ timeout: 15_000 });
      const reactivated = await admin.from("profiles")
        .select("account_state")
        .eq("id", ambassador.id)
        .single();
      expect(reactivated.error).toBeNull();
      expect(reactivated.data?.account_state).toBe("active");
      const reactivationAudit = await admin.from("audit_events")
        .select("event_type,entity_snapshot")
        .eq("entity_id", ambassador.id)
        .eq("event_type", "account.reactivated");
      expect(reactivationAudit.error).toBeNull();
      expect(reactivationAudit.data).toHaveLength(1);
      expect(reactivationAudit.data?.[0]?.entity_snapshot).toMatchObject({
        beforeAccountState: "deactivated",
        afterAccountState: "active",
      });
    } finally {
      await ambassadorContext.close();
    }
  });
});
