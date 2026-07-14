import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { audit, type AuditEvent, type AuditTransaction } from "./audit";

describe("audit emitter", () => {
  const event: AuditEvent = {
    type: "asset.uploaded",
    actor: { id: "33333333-3333-4333-8333-333333333333", nameSnapshot: "Ada" },
    entity: {
      id: "44444444-4444-4444-8444-444444444444",
      snapshot: { filename: "bridge.jpg" },
    },
  };

  it("inserts one snapshot through the supplied transaction", async () => {
    const execute = vi.fn().mockResolvedValue([]);
    const tx = { execute, rollback: vi.fn() } as unknown as AuditTransaction;

    await audit.emit(tx, event);

    expect(execute).toHaveBeenCalledOnce();
    const query = execute.mock.calls[0][0];
    expect(query.queryChunks).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: expect.arrayContaining([expect.stringContaining("insert into public.audit_events")]) }),
    ]));
  });

  it("accepts a system actor without an actor id", async () => {
    const execute = vi.fn().mockResolvedValue([]);
    const tx = { execute, rollback: vi.fn() } as unknown as AuditTransaction;
    await audit.emit(tx, {
      ...event,
      actor: { id: null, nameSnapshot: "system" },
    });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("requires a transaction-only rollback capability", () => {
    type GlobalClient = PostgresJsDatabase<Record<string, never>>;
    expectTypeOf<GlobalClient>().not.toMatchTypeOf<AuditTransaction>();

    declareGlobalClientIsRejected(audit.emit);
  });

  it("rejects values that JSON cannot preserve", () => {
    const invalidBigInt: AuditEvent = {
      ...event,
      entity: {
        ...event.entity,
        // @ts-expect-error bigint is not JSON-safe
        snapshot: { count: 1n },
      },
    };
    const invalidUndefined: AuditEvent = {
      ...event,
      entity: {
        ...event.entity,
        // @ts-expect-error undefined is not JSON-safe
        snapshot: { missing: undefined },
      },
    };
    expect([invalidBigInt, invalidUndefined]).toHaveLength(2);
  });
});

function declareGlobalClientIsRejected(emit: typeof audit.emit) {
  if (false) {
    const globalClient = null as unknown as PostgresJsDatabase<Record<string, never>>;
    // @ts-expect-error the global Drizzle client lacks the transaction-only rollback capability
    void emit(globalClient, null as unknown as AuditEvent);
  }
}
