import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/auth";

async function createIdentity(admin: Parameters<Parameters<typeof test>[1]>[0]["admin"], email: string, isAdmin: boolean) {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, app_metadata: isAdmin ? { admin: true } : {} });
  expect(created.error).toBeNull();
  const inserted = await admin.from("profiles").insert({ id: created.data.user!.id, email, account_state: "active" });
  expect(inserted.error).toBeNull();
  return created.data.user!;
}

async function login(admin: Parameters<Parameters<typeof test>[1]>[0]["admin"], page: Page, email: string, next: string) {
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  expect(link.error).toBeNull();
  await page.goto(`/auth/confirm?token_hash=${link.data.properties!.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`);
}

test.describe.serial("ambassador roster outer surfaces", () => {
  const createdIds: string[] = [];
  test.afterEach(async ({ admin }) => {
    for (const id of createdIds.splice(0)) await admin.auth.admin.deleteUser(id);
  });

  test("unauthenticated roster and detail surfaces reveal no data", async ({ context, page }) => {
    await context.clearCookies();
    for (const path of ["/api/ambassadors", "/api/ambassadors/00000000-0000-4000-8000-000000000001"]) {
      const response = await page.request.get(path); expect(response.status()).toBe(401); expect(await response.json()).toMatchObject({ error: { code: "AUTH_REQUIRED" } });
    }
    for (const path of ["/admin/ambassadors", "/admin/ambassadors/00000000-0000-4000-8000-000000000001"]) { await page.goto(path); await expect(page).toHaveURL(/\/auth\/login/); }
  });

  test("authenticated non-admin is denied on roster and detail pages and APIs", async ({ admin, page }) => {
    const user = await createIdentity(admin, `roster-denied-${Date.now()}@example.test`, false); createdIds.push(user.id);
    await login(admin, page, user.email!, "/admin/ambassadors");
    const listApi = await page.request.get("/api/ambassadors");
    const detailApi = await page.request.get(`/api/ambassadors/${user.id}`);
    expect(listApi.status()).toBe(403); expect(await listApi.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(detailApi.status()).toBe(403); expect(await detailApi.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
    await page.goto("/admin/ambassadors"); expect(await page.textContent("body")).not.toContain(user.email);
    await page.goto(`/admin/ambassadors/${user.id}`); expect(await page.textContent("body")).not.toContain(user.email);
  });

  test("admin sees empty, all missing values, detail navigation, pagination, axe, and intermediate cards", async ({ admin, page }) => {
    const administrator = await createIdentity(admin, `roster-admin-${Date.now()}@example.test`, true); createdIds.push(administrator.id);
    await login(admin, page, administrator.email!, "/admin/ambassadors");
    await expect(page.getByRole("heading", { name: "Inga ambassadörer än" })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await login(admin, page, administrator.email!, "/admin/ambassadors?cursor=bad");
    await expect(page.getByText("Sidan kunde inte visas")).toBeVisible();
    await expect(page.getByRole("link", { name: "Till ambassadörslistan" })).toHaveCSS("min-height", "44px");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    const ambassadors = [];
    for (let index = 0; index < 26; index += 1) {
      const user = await createIdentity(admin, `roster-member-${Date.now()}-${index}@example.test`, false); createdIds.push(user.id); ambassadors.push(user);
    }
    await admin.from("profiles").update({ full_name: "Anna Andersson", mobile: "+46700000000", last_login_at: "2026-07-15T10:00:00.000Z", account_state: "invited" }).eq("id", ambassadors[0]!.id);
    // Creating the full page-boundary fixture can outlive the deliberately short
    // local JWT; renew through the real confirmation front door before traversal.
    await login(admin, page, administrator.email!, "/admin/ambassadors");
    await expect(page.getByText("Namn saknas").first()).toBeVisible();
    await expect(page.getByText("Saknas").first()).toBeVisible();
    await expect(page.getByText("Aldrig").first()).toBeVisible();
    await expect(page.getByText("Anna Andersson").first()).toBeVisible();
    await expect(page.getByText("+46700000000").first()).toBeVisible();
    await expect(page.getByText("Inbjuden").first()).toBeVisible();
    await expect(page.getByText("2026-07-15 12:00").first()).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const nextLink = page.getByRole("link", { name: "Nästa sida" });
    await expect(nextLink).toBeVisible();
    const nextHref = await nextLink.getAttribute("href");
    expect(nextHref).toBeTruthy();
    const firstPageEmails = await page.locator("li dd").filter({ hasText: /roster-member-/ }).allTextContents();
    await login(admin, page, administrator.email!, nextHref!);
    const secondPageEmails = await page.locator("li dd").filter({ hasText: /roster-member-/ }).allTextContents();
    expect(firstPageEmails).toHaveLength(25); expect(secondPageEmails).toHaveLength(1);
    expect(new Set([...firstPageEmails, ...secondPageEmails]).size).toBe(26);

    const detailHref = await page.getByRole("link", { name: "Namn saknas" }).first().getAttribute("href");
    await login(admin, page, administrator.email!, detailHref!);
    await expect(page.getByRole("heading", { name: "Namn saknas" })).toBeVisible();
    await expect(page.getByText("Aldrig")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.setViewportSize({ width: 900, height: 800 });
    await login(admin, page, administrator.email!, "/admin/ambassadors");
    await expect(page.locator("table")).toBeHidden();
    await expect(page.locator("ul > li").first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Adminnavigation" })).toBeVisible();
    const target = page.getByRole("link", { name: "Namn saknas" }).first();
    await target.focus(); await expect(target).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    for (const id of ["bad", "00000000-0000-4000-8000-000000000000", administrator.id]) {
      const response = await page.request.get(`/api/ambassadors/${id}`); expect(response.status()).toBe(404);
      await login(admin, page, administrator.email!, `/admin/ambassadors/${id}`); await expect(page.getByText("This page could not be found")).toBeVisible();
    }
  });
});
