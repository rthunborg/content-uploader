import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { AUDIT_EVENT_TYPES } from "../../shared/audit-events";
import { auditEvents } from "./audit";

describe("audit events schema", () => {
  it("contains only immutable snapshot fields", () => {
    const columns = getTableColumns(auditEvents);
    expect(Object.keys(columns)).toEqual([
      "id",
      "eventType",
      "actorId",
      "actorNameSnapshot",
      "entityId",
      "entitySnapshot",
      "occurredAt",
    ]);
    expect(columns.actorId.notNull).toBe(false);
    expect(columns.actorNameSnapshot.notNull).toBe(true);
    expect(columns.entitySnapshot.notNull).toBe(true);
  });

  it("uses the registry enum and database check without live foreign keys", () => {
    const config = getTableConfig(auditEvents);
    expect(config.checks.map(({ name }) => name)).toContain("audit_events_event_type_check");
    expect(config.indexes.map(({ config: { name } }) => name)).toContain("idx_audit_events_occurred_at");
    expect(config.foreignKeys).toHaveLength(0);
    expect(getTableColumns(auditEvents).eventType.enumValues).toEqual(AUDIT_EVENT_TYPES);
  });
});
