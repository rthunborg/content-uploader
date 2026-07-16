import AxeBuilder from "@axe-core/playwright";
import type { BrowserContext, Page } from "@playwright/test";

import { expect, test } from "./fixtures/auth";

type AdminClient = Parameters<Parameters<typeof test>[1]>[0]["admin"];

async function createIdentity(
  admin: AdminClient,
  email: string,
  options: { admin?: boolean; profile?: boolean; fullName?: string } = {},
) {
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: options.admin ? { admin: true } : {},
  });
  expect(created.error).toBeNull();
  if (options.profile !== false) {
    const inserted = await admin.from("profiles").insert({
      id: created.data.user!.id,
      full_name: options.fullName ?? null,
      email,
      account_state: "active",
    });
    if (inserted.error) {
      await admin.auth.admin.deleteUser(created.data.user!.id);
      throw new Error("Failed to create the ambassador contact E2E profile", {
        cause: inserted.error,
      });
    }
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

test.describe.serial("ambassador contact maintenance", () => {
  const createdIds: string[] = [];
  const extraContexts: BrowserContext[] = [];

  test.afterEach(async ({ admin }) => {
    for (const context of extraContexts.splice(0)) await context.close();
    for (const id of createdIds.splice(0)) await admin.auth.admin.deleteUser(id);
  });

  test("denies missing and non-admin sessions before validation", async ({ admin, context, page }) => {
    await context.clearCookies();
    const target = "00000000-0000-4000-8000-000000000001";
    const anonymous = await page.request.patch(`/api/ambassadors/${target}`, { data: {} });
    expect(anonymous.status()).toBe(401);
    expect(await anonymous.json()).toMatchObject({ error: { code: "AUTH_REQUIRED" } });

    const ambassador = await createIdentity(
      admin,
      `contact-denied-${Date.now()}@example.test`,
    );
    createdIds.push(ambassador.id);
    await login(admin, page, ambassador.email!, `/admin/ambassadors/${target}`);
    const forbidden = await page.request.patch(`/api/ambassadors/${target}`, { data: {} });
    expect(forbidden.status()).toBe(403);
    expect(await forbidden.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  test("edits canonical contact identity without revoking sessions and retains every failure", async ({
    admin,
    browser,
    page,
  }) => {
    const stamp = Date.now();
    const administrator = await createIdentity(
      admin,
      `contact-admin-${stamp}@example.test`,
      { admin: true, fullName: "Portal Admin" },
    );
    createdIds.push(administrator.id);
    const oldEmail = `contact-old-${stamp}@example.test`;
    const ambassador = await createIdentity(admin, oldEmail, {
      fullName: "Anna Andersson",
    });
    createdIds.push(ambassador.id);
    const profileDuplicate = await createIdentity(
      admin,
      `contact-profile-duplicate-${stamp}@example.test`,
      { fullName: "Duplicate Profile" },
    );
    createdIds.push(profileDuplicate.id);
    const authOnlyDuplicate = await createIdentity(
      admin,
      `contact-auth-duplicate-${stamp}@example.test`,
      { profile: false },
    );
    createdIds.push(authOnlyDuplicate.id);

    const ambassadorContext = await browser.newContext();
    extraContexts.push(ambassadorContext);
    const ambassadorPage = await ambassadorContext.newPage();
    await login(admin, ambassadorPage, oldEmail, "/auth/consent");
    const beforeEditSession = await ambassadorPage.request.get("/api/ambassadors/me");
    expect(beforeEditSession.status()).toBe(409);
    expect(await beforeEditSession.json()).toMatchObject({
      error: { code: "CONSENT_REQUIRED" },
    });

    await login(
      admin,
      page,
      administrator.email!,
      `/admin/ambassadors/${ambassador.id}`,
    );
    await page.bringToFront();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "Anna Andersson" })).toBeVisible();
    await expect(page.getByText(/är inte kopplad till något HR-system/)).toBeVisible();

    const name = page.getByLabel("Fullständigt namn");
    const email = page.getByLabel("E-post");
    const mobile = page.getByLabel("Mobil (valfritt)");
    const save = page.getByRole("button", { name: "Spara kontaktuppgifter" });
    await expect(name).toHaveValue("Anna Andersson");
    await expect(email).toHaveValue(oldEmail);
    await expect(mobile).toHaveValue("");
    await expect(save).toHaveCSS("min-height", "44px");
    const nameBox = await name.boundingBox();
    const emailBox = await email.boundingBox();
    expect(nameBox).not.toBeNull();
    expect(emailBox).not.toBeNull();
    expect(Math.abs(nameBox!.x - emailBox!.x)).toBeLessThan(2);
    expect(Math.abs(nameBox!.width - emailBox!.width)).toBeLessThan(2);
    expect(emailBox!.y).toBeGreaterThan(nameBox!.y + nameBox!.height);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await name.fill("");
    await email.fill("bad");
    await save.click();
    await expect(page.getByText("Fältet måste fyllas i.")).toBeVisible();
    await expect(page.getByText("Ange en giltig e-postadress.")).toBeVisible();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await name.focus();
    await expect(name).toBeFocused();
    await name.press("Tab");
    await expect(email).toBeFocused();
    await name.fill("  Anna Ny  ");
    await email.fill(`CONTACT-FAIL-${stamp}@EXAMPLE.TEST`);
    await mobile.fill(" +46 70 123 45 67 ");

    const mutationUrl = `**/api/ambassadors/${ambassador.id}`;
    await page.route(mutationUrl, async (route) => route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Ett oväntat fel inträffade." },
      }),
    }));
    await save.click();
    await expect(page.getByText(/kunde inte sparas/)).toBeVisible();
    await expect(page.getByRole("status")).not.toContainText("har sparats");
    await expect(name).toHaveValue("  Anna Ny  ");
    await expect(email).toHaveValue(`CONTACT-FAIL-${stamp}@EXAMPLE.TEST`);
    await expect(mobile).toHaveValue(" +46 70 123 45 67 ");
    await page.unroute(mutationUrl);

    await email.fill(authOnlyDuplicate.email!);
    await save.click();
    await expect(page.getByText(/redan av ett annat konto/)).toBeVisible();
    await expect(email).toHaveValue(authOnlyDuplicate.email!);
    const unchangedAfterAuthConflict = await admin.from("profiles")
      .select("full_name,email,mobile")
      .eq("id", ambassador.id)
      .single();
    expect(unchangedAfterAuthConflict.data).toMatchObject({
      full_name: "Anna Andersson",
      email: oldEmail,
      mobile: null,
    });

    const profileConflict = await page.request.patch(
      `/api/ambassadors/${ambassador.id}`,
      {
        data: {
          fullName: "Anna Ny",
          email: profileDuplicate.email!,
          mobile: null,
        },
      },
    );
    expect(profileConflict.status()).toBe(409);
    expect(await profileConflict.json()).toMatchObject({ error: { code: "CONFLICT" } });

    const adminTarget = await page.request.patch(`/api/ambassadors/${administrator.id}`, {
      data: {
        fullName: "Changed Admin",
        email: administrator.email!,
        mobile: null,
      },
    });
    expect(adminTarget.status()).toBe(404);
    const lifecycleField = await page.request.patch(
      `/api/ambassadors/${ambassador.id}`,
      {
        data: {
          fullName: "Anna Ny",
          email: oldEmail,
          mobile: null,
          accountState: "deactivated",
        },
      },
    );
    expect(lifecycleField.status()).toBe(422);

    const newEmail = `contact-new-${stamp}@example.test`;
    await name.fill("  Anna Ny  ");
    await email.fill(` ${newEmail.toUpperCase()} `);
    await mobile.fill(" +46 70 123 45 67 ");
    await save.click();
    await expect(page.getByRole("status")).toContainText(
      "Kontaktuppgifterna har sparats",
      { timeout: 15_000 },
    );
    await expect(page.getByRole("heading", { name: "Anna Ny" })).toBeVisible();
    await expect(name).toHaveValue("Anna Ny");
    await expect(email).toHaveValue(newEmail);
    await expect(mobile).toHaveValue("+46 70 123 45 67");

    const persisted = await admin.from("profiles")
      .select("full_name,email,mobile,updated_at")
      .eq("id", ambassador.id)
      .single();
    expect(persisted.error).toBeNull();
    expect(persisted.data).toMatchObject({
      full_name: "Anna Ny",
      email: newEmail,
      mobile: "+46 70 123 45 67",
    });
    expect(persisted.data!.updated_at).toBeTruthy();
    const authUser = await admin.auth.admin.getUserById(ambassador.id);
    expect(authUser.error).toBeNull();
    expect(authUser.data.user?.email).toBe(newEmail);

    await page.goto("/admin/ambassadors");
    await expect(page.getByRole("link", { name: "Anna Ny" })).toBeVisible();
    await expect(page.locator("dd", { hasText: newEmail })).toBeVisible();
    await expect(page.locator("dd", { hasText: "+46 70 123 45 67" })).toBeVisible();

    const afterEditSession = await ambassadorPage.request.get("/api/ambassadors/me");
    expect(afterEditSession.status()).toBe(409);
    expect(await afterEditSession.json()).toMatchObject({
      error: { code: "CONSENT_REQUIRED" },
    });

    const identities = await admin.auth.admin.listUsers({ page: 1, perPage: 1_000 });
    expect(identities.error).toBeNull();
    expect(identities.data.users.find((user) => user.email === oldEmail)).toBeUndefined();
    expect(identities.data.users.find((user) => user.email === newEmail)?.id).toBe(ambassador.id);
    const newAddressLink = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: newEmail,
    });
    expect(newAddressLink.error).toBeNull();
    const newLoginContext = await browser.newContext();
    extraContexts.push(newLoginContext);
    const newLoginPage = await newLoginContext.newPage();
    await newLoginPage.goto(
      `/auth/confirm?token_hash=${newAddressLink.data.properties!.hashed_token}&type=magiclink&next=/`,
    );
    await expect(newLoginPage).toHaveURL("http://localhost:3000/");
    const newAddressSession = await newLoginPage.request.get("/api/ambassadors/me");
    expect(newAddressSession.status()).toBe(409);
    expect(await newAddressSession.json()).toMatchObject({
      error: { code: "CONSENT_REQUIRED" },
    });

    await page.goto(`/admin/ambassadors/${ambassador.id}`);
    await page.setViewportSize({ width: 1280, height: 900 });
    await email.focus();
    await expect(email).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
