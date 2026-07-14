import { sql, type SQL } from "drizzle-orm";

import type { AuditEventType } from "./audit-events";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export interface AuditTransaction {
  execute(query: SQL): unknown;
  // Structural discriminator: only Drizzle transaction handles expose `rollback`,
  // so requiring it here is what makes `audit.emit(db, ...)` (the global client,
  // which has no `rollback`) a compile error. `emit` never calls it — do not
  // remove this member or the transaction-only guarantee collapses.
  rollback(): never;
}

export interface AuditEvent {
  type: AuditEventType;
  actor: {
    id: string | null;
    nameSnapshot: string;
  };
  entity: {
    id: string;
    snapshot: JsonObject;
  };
}

export const audit = {
  async emit(tx: AuditTransaction, event: AuditEvent): Promise<void> {
    await tx.execute(sql`
      insert into public.audit_events (
        event_type,
        actor_id,
        actor_name_snapshot,
        entity_id,
        entity_snapshot
      ) values (
        ${event.type},
        ${event.actor.id},
        ${event.actor.nameSnapshot},
        ${event.entity.id},
        ${JSON.stringify(event.entity.snapshot)}::jsonb
      )
    `);
  },
};
