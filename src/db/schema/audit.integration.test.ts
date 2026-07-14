import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { AUDIT_EVENT_TYPES } from "../../shared/audit-events";

function localDatabaseUrl(): string | undefined {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  try {
    const output = execFileSync("npx", ["supabase", "status", "--output", "env"], { encoding: "utf8" });
    return output.match(/^DB_URL="?([^"\n]+)"?$/m)?.[1];
  } catch {
    return undefined;
  }
}

const databaseUrl = localDatabaseUrl();
const describeDatabase = databaseUrl ? describe.sequential : describe.skip;

describeDatabase("audit database enforcement", () => {
  const sql = postgres(databaseUrl ?? "postgres://unused", { prepare: false });
  const recentId = randomUUID();
  const expiredId = randomUUID();

  afterAll(async () => {
    await sql`select public.expire_audit_events()`;
    await sql.end();
  });

  it("has RLS, no live foreign keys, and an audit-only cron command", async () => {
    const [table] = await sql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      select relrowsecurity, relforcerowsecurity from pg_class where oid = 'public.audit_events'::regclass
    `;
    expect(table).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    expect(await sql`select conname from pg_constraint where conrelid = 'public.audit_events'::regclass and contype = 'f'`).toHaveLength(0);

    const [job] = await sql<{ command: string }[]>`
      select command from cron.job where jobname = 'expire-audit-events'
    `;
    expect(job.command).toBe("select public.expire_audit_events()");
    expect(job.command).not.toMatch(/assets|profiles|acceptance|usage|export_records|send_records/);
  });

  it("denies update and delete to privileged application roles", async () => {
    await sql`
      insert into audit_events (id, event_type, actor_name_snapshot, entity_id, entity_snapshot)
      values (${recentId}, 'asset.deleted', 'system', ${recentId}, '{}'::jsonb)
      on conflict (id) do nothing
    `;

    for (const role of ["authenticated", "service_role"] as const) {
      await expect(sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx`update audit_events set actor_name_snapshot = 'tampered' where id = ${recentId}`;
      })).rejects.toMatchObject({ code: "42501" });
      await expect(sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx`delete from audit_events where id = ${recentId}`;
      })).rejects.toMatchObject({ code: "42501" });
    }

    const [row] = await sql<{ actor_name_snapshot: string }[]>`
      select actor_name_snapshot from audit_events where id = ${recentId}
    `;
    expect(row.actor_name_snapshot).toBe("system");
  });

  it("enforces immutability via the trigger on the privileged owner connection", async () => {
    // The role-based test above is rejected at the GRANT layer before any trigger
    // fires. This owner (postgres) connection holds UPDATE/DELETE, so a rejection
    // here proves the immutability trigger itself — not just the grants — is the
    // defense. The delete runs without audit.retention_job='on', so the trigger's
    // retention carve-out does not apply.
    const triggerId = randomUUID();
    await sql`
      insert into audit_events (id, event_type, actor_name_snapshot, entity_id, entity_snapshot)
      values (${triggerId}, 'asset.deleted', 'system', ${triggerId}, '{}'::jsonb)
      on conflict (id) do nothing
    `;

    await expect(
      sql`update audit_events set actor_name_snapshot = 'tampered' where id = ${triggerId}`,
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      sql`delete from audit_events where id = ${triggerId}`,
    ).rejects.toMatchObject({ code: "42501" });

    const [row] = await sql<{ actor_name_snapshot: string }[]>`
      select actor_name_snapshot from audit_events where id = ${triggerId}
    `;
    expect(row.actor_name_snapshot).toBe("system");
  });

  it("admits every registered event type at the database CHECK constraint", async () => {
    // The schema unit test compares the Drizzle enum to the registry (TS-to-TS).
    // This proves the compiled CHECK constraint actually admits each registered
    // type, so a registry addition without a matching migration cannot silently
    // fail with 23514 in production.
    const insertedIds: string[] = [];
    for (const eventType of AUDIT_EVENT_TYPES) {
      const id = randomUUID();
      insertedIds.push(id);
      await sql.begin(async (tx) => {
        await tx`set local role service_role`;
        await tx`
          insert into audit_events (id, event_type, actor_name_snapshot, entity_id, entity_snapshot)
          values (${id}, ${eventType}, 'system', ${id}, '{}'::jsonb)
        `;
      });
    }
    const rows = await sql<{ event_type: string }[]>`
      select distinct event_type from audit_events where id = any(${insertedIds}::uuid[])
    `;
    expect(rows.map(({ event_type }) => event_type).sort()).toEqual([...AUDIT_EVENT_TYPES].sort());
  });

  it("permits intended server inserts but rejects ordinary authenticated inserts", async () => {
    const serverInsertId = randomUUID();
    await sql.begin(async (tx) => {
      await tx`set local role service_role`;
      await tx`
        insert into audit_events (id, event_type, actor_name_snapshot, entity_id, entity_snapshot, occurred_at)
        values (${serverInsertId}, 'message.sent', 'system', ${serverInsertId}, '{}'::jsonb, '2000-01-01')
      `;
    });
    const [inserted] = await sql<{ id: string; chronology_is_current: boolean }[]>`
      select id, occurred_at > now() - interval '1 minute' as chronology_is_current
      from audit_events where id = ${serverInsertId}
    `;
    expect(inserted).toEqual({ id: serverInsertId, chronology_is_current: true });

    await expect(sql.begin(async (tx) => {
      await tx`set local role authenticated`;
      await tx`
        insert into audit_events (event_type, actor_name_snapshot, entity_id, entity_snapshot)
        values ('message.sent', 'system', ${randomUUID()}, '{}'::jsonb)
      `;
    })).rejects.toMatchObject({ code: "42501" });
  });

  it("expires only rows older than six months", async () => {
    await sql.begin(async (tx) => {
      await tx`select set_config('audit.retention_fixture', 'on', true)`;
      await tx`
        insert into audit_events (id, event_type, actor_name_snapshot, entity_id, entity_snapshot, occurred_at)
        values (${expiredId}, 'asset.deleted', 'system', ${expiredId}, '{}'::jsonb, now() - interval '6 months 1 second')
      `;
      await tx`select set_config('audit.retention_fixture', 'off', true)`;
    });
    const [before] = await sql<{ assets: number }[]>`select count(*)::int as assets from assets`;

    for (const role of ["authenticated", "service_role"] as const) {
      await expect(sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx`select public.expire_audit_events()`;
      })).rejects.toMatchObject({ code: "42501" });
      expect(await sql`select id from audit_events where id = ${expiredId}`).toHaveLength(1);
    }

    const { deletedCount, retentionFlag } = await sql.begin(async (tx) => {
      const [{ expire_audit_events }] = await tx<{ expire_audit_events: string }[]>`
        select public.expire_audit_events()
      `;
      const [{ retention_flag }] = await tx<{ retention_flag: string }[]>`
        select current_setting('audit.retention_job', true) as retention_flag
      `;
      return { deletedCount: expire_audit_events, retentionFlag: retention_flag };
    });
    expect(Number(deletedCount)).toBeGreaterThanOrEqual(1);
    expect(retentionFlag).toBe("off");
    expect(await sql`select id from audit_events where id = ${expiredId}`).toHaveLength(0);
    expect(await sql`select id from audit_events where id = ${recentId}`).toHaveLength(1);
    expect(await sql`select count(*)::int as assets from assets`).toEqual(before ? [before] : []);
  });
});
