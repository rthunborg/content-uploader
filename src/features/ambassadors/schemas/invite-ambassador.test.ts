import { describe, expect, it } from "vitest";
import { MAX_AMBASSADOR_NAME_LENGTH } from "@/shared/limits";
import { inviteAmbassadorSchema } from "./invite-ambassador";

describe("inviteAmbassadorSchema", () => {
  it("normalizes all persisted contact fields", () => { expect(inviteAmbassadorSchema.parse({ fullName: "  Anna Andersson ", email: " ANNA@Example.COM ", mobile: " +46 70 000 00 00 " })).toEqual({ fullName: "Anna Andersson", email: "anna@example.com", mobile: "+46 70 000 00 00" }); });
  it.each([[{ fullName: "", email: "a@example.com" }, "fullName"], [{ fullName: "Anna", email: "bad" }, "email"], [{ fullName: "Anna", email: "a@example.com", mobile: "---" }, "mobile"]])("rejects invalid boundaries", (input, field) => { const result = inviteAmbassadorSchema.safeParse(input); expect(result.success).toBe(false); if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true); });
  it("accepts null, empty and omitted mobile", () => { for (const mobile of [null, "", undefined]) expect(inviteAmbassadorSchema.parse({ fullName: "Anna", email: "a@example.com", ...(mobile === undefined ? {} : { mobile }) }).mobile).toBeNull(); });
  it("bounds authoritative names", () => { expect(inviteAmbassadorSchema.safeParse({ fullName: "a".repeat(MAX_AMBASSADOR_NAME_LENGTH + 1), email: "a@example.com" }).success).toBe(false); });
  it.each(["123456", "+46 (70) 12", "+1234567890123456"])("rejects mobile digit-count boundary %s", (mobile) => { expect(inviteAmbassadorSchema.safeParse({ fullName: "Anna", email: "a@example.com", mobile }).success).toBe(false); });
  it.each(["0701234567", "+46 70 123 45 67", "+1 (212) 555-0123"])("accepts formatted mobile %s", (mobile) => { expect(inviteAmbassadorSchema.parse({ fullName: "Anna", email: "a@example.com", mobile }).mobile).toBe(mobile); });
});
