import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export class AuthPage {
  constructor(readonly page: Page) {}

  async openLogin(next = "/tasks") {
    await this.page.goto(`/auth/login?next=${encodeURIComponent(next)}`);
  }

  async requestLink(email: string) {
    await this.page.getByLabel("E-postadress").fill(email);
    await this.page.getByRole("button", { name: "Skicka inloggningslänk" }).click();
    await expect(this.page.getByText("Kontrollera din inkorg")).toBeVisible();
  }

  async expectMinimumTargetAndVisibleKeyboardFocus(
    role: "button" | "link",
    name: string,
  ) {
    const target = this.page.getByRole(role, { name });
    const box = await target.boundingBox();
    expect(box, `${name} must have a rendered target`).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);

    await target.focus();
    await expect(target).toBeFocused();
    const focusStyle = await target.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(2);
  }

  async expectRecovery(next = "/") {
    await expect(this.page).toHaveURL((url) =>
      url.pathname === "/auth/error" && url.searchParams.get("next") === next,
    );
    await expect(this.page.getByRole("heading", { name: "Länken går inte längre att använda" })).toBeVisible();
  }

  async expectAccessible() {
    const results = await new AxeBuilder({ page: this.page }).analyze();
    expect(results.violations).toEqual([]);
  }

  async advanceConsentCard() { await this.page.getByRole("button", { name: "Godkänn och fortsätt" }).click(); }
  async openConsentLegalText() { await this.page.getByRole("button", { name: "Läs hela villkorstexten" }).click(); }
  async finishConsent() { await this.page.getByRole("button", { name: "Godkänn och aktivera konto" }).click(); }
  async declineConsent() { await this.page.getByRole("button", { name: "Pausa mitt konto" }).click(); }
}
