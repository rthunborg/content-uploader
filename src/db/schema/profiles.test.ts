import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { ACCOUNT_STATES, profiles } from "./profiles";

describe("profiles schema", () => {
  it("exposes the five account states without deleted", () => {
    expect(ACCOUNT_STATES).toEqual([
      "invited",
      "active",
      "inactive_declined",
      "inactive_withdrawn",
      "deactivated",
    ]);
    expect(ACCOUNT_STATES).not.toContain("deleted");
  });

  it("contains contact and durable KPI timestamps but no authorization fields", () => {
    const columns = Object.keys(getTableColumns(profiles));

    expect(columns).toEqual(
      expect.arrayContaining([
        "email",
        "mobile",
        "invitedAt",
        "firstAcceptedAt",
        "firstUploadAt",
        "lastLoginAt",
      ]),
    );
    expect(columns).not.toEqual(expect.arrayContaining(["role", "admin", "deleted"]));
  });

  it("backs account state with a database check", () => {
    expect(getTableConfig(profiles).checks.map((check) => check.name)).toContain(
      "profiles_account_state_check",
    );
  });
});
