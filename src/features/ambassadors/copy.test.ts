import { describe, expect, it } from "vitest";
import { ACCOUNT_STATES } from "@/shared/account-states";
import { accountStateCopy, ambassadorCopy } from "./copy";
describe("ambassador account-state copy", () => {
  it("exhaustively localizes the canonical states", () => { expect(Object.keys(accountStateCopy).sort()).toEqual([...ACCOUNT_STATES].sort()); expect(Object.values(accountStateCopy).every((value) => value.trim().length > 0)).toBe(true); });
  it("centralizes contact-maintenance guidance and feedback", () => {
    expect(ambassadorCopy.contactDuty).toContain("HR-system");
    expect(ambassadorCopy.contactDuty).toContain("Administratörer ansvarar");
    expect(ambassadorCopy.contactSaved).toContain("sparats");
    expect(ambassadorCopy.contactConflict).toContain("annat konto");
  });
});
