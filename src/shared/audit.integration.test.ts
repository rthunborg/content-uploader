import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { audit } from "./audit";

function localDatabaseUrl(): string | undefined {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  try {
    const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npx";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", "npx supabase --profile supabase/cli-profile.yaml status --output env"]
      : ["supabase", "--profile", "supabase/cli-profile.yaml", "status", "--output", "env"];
    const output = execFileSync(command, args, {
      encoding: "utf8",
    });
    return output.match(/^DB_URL="?([^"\n]+)"?$/m)?.[1];
  } catch {
    return undefined;
  }
}

const databaseUrl = localDatabaseUrl();
const describeDatabase = databaseUrl ? describe.sequential : describe.skip;

describeDatabase("audit emitter against local Supabase", () => {
  const client = postgres(databaseUrl ?? "postgres://unused", { prepare: false });
  const db = drizzle(client, { casing: "snake_case" });
  const entityId = randomUUID();

  afterAll(async () => {
    await client`select public.expire_audit_events()`;
    await client.end();
  });

  it("commits user and system snapshots", async () => {
    await db.transaction(async (tx) => {
      await audit.emit(tx, {
        type: "asset.uploaded",
        actor: { id: "22222222-2222-4222-8222-222222222222", nameSnapshot: "Ada" },
        entity: { id: entityId, snapshot: { filename: "bridge.jpg" } },
      });
      await audit.emit(tx, {
        type: "auth.logged_in",
        actor: { id: null, nameSnapshot: "system" },
        entity: { id: entityId, snapshot: { source: "worker" } },
      });
    });

    const rows = await client<{
      event_type: string;
      actor_id: string | null;
      actor_name_snapshot: string;
      entity_snapshot: Record<string, unknown>;
    }[]>`
      select event_type, actor_id, actor_name_snapshot, entity_snapshot
      from audit_events where entity_id = ${entityId}
      order by event_type
    `;
    expect(rows).toEqual([
      {
        event_type: "asset.uploaded",
        actor_id: "22222222-2222-4222-8222-222222222222",
        actor_name_snapshot: "Ada",
        entity_snapshot: { filename: "bridge.jpg" },
      },
      {
        event_type: "auth.logged_in",
        actor_id: null,
        actor_name_snapshot: "system",
        entity_snapshot: { source: "worker" },
      },
    ]);
  });

  it("rolls the mutation and audit row back together", async () => {
    const rollbackEntityId = randomUUID();
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          sql`insert into assets (id) values (${rollbackEntityId})`,
        );
        await audit.emit(tx, {
          type: "asset.uploaded",
          actor: { id: null, nameSnapshot: "system" },
          entity: { id: rollbackEntityId, snapshot: { rolledBack: true } },
        });
        throw new Error("rollback sentinel");
      }),
    ).rejects.toThrow("rollback sentinel");

    expect(await client`select id from assets where id = ${rollbackEntityId}`).toHaveLength(0);
    expect(await client`select id from audit_events where entity_id = ${rollbackEntityId}`).toHaveLength(0);
  });

  it("rejects unregistered event types in Postgres", async () => {
    await expect(client`
      insert into audit_events (event_type, actor_name_snapshot, entity_id, entity_snapshot)
      values ('theme.assigned', 'system', ${entityId}, '{}'::jsonb)
    `).rejects.toMatchObject({ code: "23514" });
  });
});
