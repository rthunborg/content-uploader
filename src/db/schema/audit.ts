import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { AUDIT_EVENT_TYPES } from "../../shared/audit-events";
import type { JsonObject } from "../../shared/audit";

const AUDIT_EVENT_TYPE_CHECK_VALUES = sql.raw(
  AUDIT_EVENT_TYPES.map((eventType) => `'${eventType.replaceAll("'", "''")}'`).join(", "),
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    eventType: text({ enum: AUDIT_EVENT_TYPES }).notNull(),
    actorId: uuid(),
    actorNameSnapshot: text().notNull(),
    entityId: uuid().notNull(),
    entitySnapshot: jsonb().$type<JsonObject>().notNull(),
    occurredAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "audit_events_event_type_check",
      sql`${table.eventType} in (${AUDIT_EVENT_TYPE_CHECK_VALUES})`,
    ),
    index("idx_audit_events_occurred_at").on(table.occurredAt),
  ],
).enableRLS();

export type AuditEventRow = typeof auditEvents.$inferSelect;
