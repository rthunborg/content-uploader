import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures/auth";

test("deletes an ambassador account from detail and preserves durable evidence", async ({ admin, browser, page }) => {
  const stamp = Date.now();
  const adminEmail = `delete-admin-${stamp}@example.test`;
  const ambassadorEmail = `delete-ambassador-${stamp}@example.test`;
  const administrator = await admin.auth.admin.createUser({
    email: adminEmail,
    email_confirm: true,
    app_metadata: { admin: true },
  });
  expect(administrator.error).toBeNull();
  const ambassador = await admin.auth.admin.createUser({ email: ambassadorEmail, email_confirm: true });
  expect(ambassador.error).toBeNull();
  const adminId = administrator.data.user!.id;
  const ambassadorId = ambassador.data.user!.id;
  const ambassadorContext = await browser.newContext();

  try {
    expect((await admin.from("profiles").insert([
      { id: adminId, full_name: "Delete Admin", email: adminEmail, account_state: "active" },
      { id: ambassadorId, full_name: "Delete Ambassador", email: ambassadorEmail, account_state: "active" },
    ])).error).toBeNull();
    const ambassadorLink = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: ambassadorEmail,
    });
    expect(ambassadorLink.error).toBeNull();
    const ambassadorPage = await ambassadorContext.newPage();
    await ambassadorPage.goto(
      `/auth/confirm?token_hash=${ambassadorLink.data.properties!.hashed_token}&type=magiclink&next=/auth/consent`,
    );
    expect((await ambassadorPage.request.get("/api/ambassadors/me")).status()).toBe(409);

    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: adminEmail });
    expect(link.error).toBeNull();
    await page.goto(`/auth/confirm?token_hash=${link.data.properties!.hashed_token}&type=magiclink&next=/admin/ambassadors/${ambassadorId}`);
    await expect(page.getByRole("heading", { name: "Delete Ambassador" })).toBeVisible();
    await expect(page.getByText(/Uppladdningar och dokumenterad villkorsacceptans finns kvar/)).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    const confirmation = page.getByLabel(/tas bort permanent/);
    await confirmation.focus();
    await page.keyboard.press("Space");
    const submit = page.getByRole("button", { name: "Ta bort kontopost" });
    await expect(submit).toBeEnabled();
    await page.keyboard.press("Tab");
    await expect(submit).toBeFocused();
    const response = page.waitForResponse((candidate) => (
      candidate.url().includes(`/api/ambassadors/${ambassadorId}`)
      && candidate.request().method() === "DELETE"
    ));
    await page.keyboard.press("Enter");
    expect((await response).ok()).toBe(true);
    await expect(page).toHaveURL(/\/admin\/ambassadors$/);
    await expect(page.getByRole("link", { name: "Delete Ambassador" })).toHaveCount(0);
    expect((await admin.from("profiles").select("id").eq("id", ambassadorId)).data).toEqual([]);
    expect((await admin.auth.admin.getUserById(ambassadorId)).error).not.toBeNull();
    const formerSession = await ambassadorPage.request.get("/api/ambassadors/me");
    expect(formerSession.status()).toBe(401);
    expect(await formerSession.json()).toMatchObject({
      error: { code: "SESSION_REVOKED" },
    });
    const evidence = await admin.from("audit_events")
      .select("actor_id,entity_snapshot")
      .eq("entity_id", ambassadorId)
      .eq("event_type", "account.deleted");
    expect(evidence.error).toBeNull();
    expect(evidence.data).toHaveLength(1);
    expect(evidence.data?.[0]).toMatchObject({
      actor_id: adminId,
      entity_snapshot: {
        fullName: "Delete Ambassador",
        email: ambassadorEmail,
        accountState: "active",
      },
    });
  } finally {
    await ambassadorContext.close();
    await admin.auth.admin.deleteUser(ambassadorId);
    await admin.auth.admin.deleteUser(adminId);
  }
});
