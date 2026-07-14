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
    try {
      const link = await latestLink(email);
      expect(new URL(link).pathname).toBe("/auth/confirm");
      expect(new URL(link).searchParams.get("type")).toBe("invite");
      await authPage.page.goto(link);
      await expect(authPage.page).toHaveURL("http://localhost:3000/");
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
});
