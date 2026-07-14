import { test, expect } from "./fixtures/auth";
import { AuthPage } from "./pages/auth-page";

test.describe.serial("magic link authentication", () => {
  test.beforeEach(async ({ clearMail }) => clearMail());

  test("magic link login, single use, recovery remedy, and axe", async ({
    admin,
    authPage,
    browser,
    latestLink,
  }) => {
    const email = `magic-${Date.now()}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    expect(error).toBeNull();
    const { error: profileError } = await admin.from("profiles").insert({ id: data.user!.id, email, account_state: "active" });
    expect(profileError).toBeNull();
    try {
      await authPage.openLogin("/tasks");
      await expect(authPage.page.locator('input[type="password"]')).toHaveCount(0);
      await expect(authPage.page.getByLabel("E-postadress")).toHaveCSS("font-size", "16px");
      await authPage.expectMinimumTargetAndVisibleKeyboardFocus("button", "Skicka inloggningslänk");
      await authPage.expectAccessible();
      await authPage.requestLink(email);
      const link = await latestLink(email);

      await authPage.page.goto(link);
      await expect(authPage.page).toHaveURL(/\/tasks$/);
      const consentResponse = await authPage.page.request.get("/api/ambassadors/me");
      expect(consentResponse.status()).toBe(409);
      expect(await consentResponse.json()).toMatchObject({ error: { code: "CONSENT_REQUIRED" } });
      const adminResponse = await authPage.page.request.get(`/api/ambassadors/${data.user!.id}`);
      expect(adminResponse.status()).toBe(403);
      expect(await adminResponse.json()).toMatchObject({ error: { code: "FORBIDDEN" } });

      const secondContext = await browser.newContext();
      try {
        const recovery = new AuthPage(await secondContext.newPage());
        await recovery.page.goto(link);
        await recovery.expectRecovery("/tasks");
        await recovery.expectMinimumTargetAndVisibleKeyboardFocus("link", "Be om en ny inloggningslänk");
        await recovery.expectAccessible();
        await recovery.page.getByRole("link", { name: "Be om en ny inloggningslänk" }).click();
        await expect(recovery.page).toHaveURL(/\/auth\/login\?next=%2Ftasks$/);
        await recovery.page.goto("/tasks");
        await expect(recovery.page).toHaveURL(/\/auth\/login\?next=%2Ftasks$/);
      } finally {
        await secondContext.close();
      }
    } finally {
      if (data.user) await admin.auth.admin.deleteUser(data.user.id);
    }
  });

  test("administrator invite uses the single confirmation front door", async ({ admin, authPage, latestLink }) => {
    const email = `invite-${Date.now()}@example.test`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: "http://localhost:3000/auth/confirm?next=%2F",
    });
    expect(error).toBeNull();
    const { error: profileError } = await admin.from("profiles").insert({ id: data.user!.id, email, account_state: "invited" });
    expect(profileError).toBeNull();
    try {
      const link = await latestLink(email);
      expect(new URL(link).pathname).toBe("/auth/confirm");
      expect(new URL(link).searchParams.get("type")).toBe("invite");
      await authPage.page.goto(link);
      await expect(authPage.page).toHaveURL("http://localhost:3000/auth/consent?next=%2F");
    } finally {
      if (data.user) await admin.auth.admin.deleteUser(data.user.id);
    }
  });

  test("invalid magic link reaches safe recovery", async ({ authPage }) => {
    await authPage.page.goto("/auth/confirm?token_hash=invalid&type=magiclink&next=https%3A%2F%2Fevil.example&email=secret@example.test");
    await authPage.expectRecovery("/");
    expect(authPage.page.url()).not.toContain("email");
    await authPage.page.goto("/tasks");
    await expect(authPage.page).toHaveURL(/\/auth\/login\?next=%2Ftasks$/);
  });

  test("paused account surface is accessible", async ({ authPage }) => {
    await authPage.page.goto("/auth/paused");
    await expect(authPage.page.getByRole("heading", { name: "Ditt konto är pausat" })).toBeVisible();
    await authPage.expectAccessible();
  });

  test("deactivated account confirmation reaches the paused surface", async ({ admin, authPage, latestLink }) => {
    const email = `paused-${Date.now()}@example.test`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    expect(created.error).toBeNull();
    await admin.from("profiles").insert({ id: created.data.user!.id, email, account_state: "deactivated" });
    try {
      await authPage.openLogin("/tasks");
      await authPage.requestLink(email);
      await authPage.page.goto(await latestLink(email));
      await expect(authPage.page).toHaveURL("http://localhost:3000/auth/paused");
    } finally { await admin.auth.admin.deleteUser(created.data.user!.id); }
  });
});
