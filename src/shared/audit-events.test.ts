import { describe, expect, expectTypeOf, it } from "vitest";

import { AUDIT_EVENT_TYPES, type AuditEventType } from "./audit-events";

describe("audit event registry", () => {
  it("contains exactly the closed v1.1 registry", () => {
    expect(AUDIT_EVENT_TYPES).toEqual([
      "asset.uploaded",
      "asset.deleted",
      "asset.erased",
      "export.created",
      "asset.shared",
      "asset.used_confirmed",
      "auth.logged_in",
      "account.invited",
      "account.deactivated",
      "account.reactivated",
      "account.deleted",
      "consent.accepted",
      "consent.declined",
      "consent.withdrawn",
      "terms.version_created",
      "task.created",
      "task.completed",
      "message.sent",
    ]);
  });

  it("derives a closed union from the registry", () => {
    expectTypeOf<AuditEventType>().toEqualTypeOf<(typeof AUDIT_EVENT_TYPES)[number]>();
    const accepted: AuditEventType = "asset.used_confirmed";
    expect(accepted).toBe("asset.used_confirmed");

    // @ts-expect-error deliberately unaudited verbs are outside the closed registry
    const rejected: AuditEventType = "theme.assigned";
    expect(rejected).toBe("theme.assigned");
  });
});
