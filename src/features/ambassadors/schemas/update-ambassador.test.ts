import { describe, expect, it } from "vitest";

import {
  MAX_AMBASSADOR_EMAIL_LENGTH,
  MAX_AMBASSADOR_MOBILE_LENGTH,
  MAX_AMBASSADOR_NAME_LENGTH,
} from "@/shared/limits";

import { updateAmbassadorSchema } from "./update-ambassador";

describe("updateAmbassadorSchema", () => {
  it("normalizes the authoritative contact fields", () => {
    expect(updateAmbassadorSchema.parse({
      fullName: "  Anna Andersson ",
      email: " ANNA@Example.COM ",
      mobile: " +46 70 000 00 00 ",
    })).toEqual({
      fullName: "Anna Andersson",
      email: "anna@example.com",
      mobile: "+46 70 000 00 00",
    });
  });

  it.each([null, "", undefined])("preserves an absent mobile as null for %s", (mobile) => {
    expect(updateAmbassadorSchema.parse({
      fullName: "Anna Andersson",
      email: "anna@example.com",
      ...(mobile === undefined ? {} : { mobile }),
    }).mobile).toBeNull();
  });

  it.each([
    [{ fullName: "", email: "anna@example.com" }, "fullName"],
    [{ fullName: "a".repeat(MAX_AMBASSADOR_NAME_LENGTH + 1), email: "anna@example.com" }, "fullName"],
    [{ fullName: "Anna", email: "not-an-email" }, "email"],
    [{ fullName: "Anna", email: `${"a".repeat(MAX_AMBASSADOR_EMAIL_LENGTH)}@example.com` }, "email"],
    [{ fullName: "Anna", email: "anna@example.com", mobile: "123456" }, "mobile"],
    [{ fullName: "Anna", email: "anna@example.com", mobile: "1".repeat(MAX_AMBASSADOR_MOBILE_LENGTH + 1) }, "mobile"],
  ])("rejects invalid contact boundary %#", (input, field) => {
    const result = updateAmbassadorSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
    }
  });

  it("rejects fields outside the contact contract", () => {
    expect(updateAmbassadorSchema.safeParse({
      fullName: "Anna",
      email: "anna@example.com",
      mobile: null,
      accountState: "deactivated",
    }).success).toBe(false);
  });
});
