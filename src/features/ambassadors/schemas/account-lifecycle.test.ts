import { describe, expect, it } from "vitest";

import { accountLifecycleSchema } from "./account-lifecycle";

describe("accountLifecycleSchema", () => {
  it.each(["deactivate", "reactivate"] as const)("accepts %s actions", (action) => {
    expect(accountLifecycleSchema.parse({ action })).toEqual({ action });
  });

  it.each([
    {},
    { action: "delete" },
    { action: "deactivate", accountState: "deactivated" },
    { action: "reactivate", fullName: "Anna" },
  ])("rejects payloads outside the lifecycle contract %#", (input) => {
    expect(accountLifecycleSchema.safeParse(input).success).toBe(false);
  });
});
