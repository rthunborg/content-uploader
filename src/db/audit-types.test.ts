import { describe, expect, it } from "vitest";

import { audit, type AuditEvent } from "../shared/audit";
import type { getDatabase } from "./client";

type ProjectDatabase = ReturnType<typeof getDatabase>;

const event: AuditEvent = {
  type: "asset.uploaded",
  actor: { id: null, nameSnapshot: "system" },
  entity: { id: "11111111-1111-4111-8111-111111111111", snapshot: {} },
};

describe("project database audit capability", () => {
  it("rejects the project global client and accepts its real transaction", () => {
    if (false) {
      const db = null as unknown as ProjectDatabase;
      // @ts-expect-error global database clients lack the transaction-only rollback capability
      void audit.emit(db, event);
      void db.transaction(async (tx) => audit.emit(tx, event));
    }
    expect(true).toBe(true);
  });
});
