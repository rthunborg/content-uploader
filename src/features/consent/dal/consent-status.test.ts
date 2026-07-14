import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { productionConsentStatusProvider } from "./consent-status";

describe("production consent status provider", () => {
  it("fails closed until Story 3.1 supplies the acceptance-record query", async () => {
    // The unresolved provider must never report consent as current, so the ambassador
    // consent gate stays fail-closed (CONSENT_REQUIRED) rather than silently opening.
    await expect(productionConsentStatusProvider.hasCurrentConsent("any-user")).resolves.toBe(false);
  });
});
