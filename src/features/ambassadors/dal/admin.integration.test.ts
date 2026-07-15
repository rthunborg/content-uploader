import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn().mockResolvedValue({ role: "admin" }) }));

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("ambassador pagination against migrated Postgres", () => {
  const sql = postgres(databaseUrl ?? "postgres://unused", { prepare: false });
  const prefix = `roster-pagination-${Date.now()}-`;
  const userIds: string[] = [];
  let orphanId = "";
  let baselineIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    baselineIds = (await sql<{ id: string }[]>`select p.id from profiles p where exists (select 1 from auth.users u where u.id = p.id and (u.raw_app_meta_data -> 'admin') is distinct from 'true'::jsonb) order by p.id`).map(({ id }) => id);
    for (let index = 0; index < 28; index += 1) {
      const metadata = index === 0 ? { admin: true } : index === 1 ? { admin: "legacy" } : {};
      const [user] = await sql<{ id: string }[]>`insert into auth.users (id, raw_app_meta_data) values (gen_random_uuid(), ${sql.json(metadata)}) returning id`;
      userIds.push(user.id);
      await sql`insert into profiles (id, full_name, email, account_state) values (${user.id}, ${`Person ${index}`}, ${`${prefix}${index}@example.test`}, 'active')`;
    }
    const [orphan] = await sql<{ id: string }[]>`select gen_random_uuid() as id`;
    orphanId = orphan.id;
    await sql`set session_replication_role = replica`;
    try { await sql`insert into profiles (id, full_name, email, account_state) values (${orphanId}, 'Orphan', ${`${prefix}orphan@example.test`}, 'active')`; }
    finally { await sql`set session_replication_role = origin`; }
  });

  afterAll(async () => {
    await sql`delete from profiles where email like ${`${prefix}%`}`;
    await sql`delete from auth.users where id = any(${userIds}::uuid[])`;
    await sql.end();
  });

  it("traverses a page boundary with ordered complete non-overlapping ambassador membership", async () => {
    const { listAmbassadors } = await import("./admin");
    const pages = []; let cursor: string | null = null;
    do { const page = await listAmbassadors(cursor); pages.push(page); cursor = page.nextCursor; } while (cursor);
    const ids = pages.flatMap(({ items }) => items.map(({ id }) => id));
    const expected = [...baselineIds, ...userIds.slice(1)].sort();
    const first = pages[0]!;
    expect(first.items).toHaveLength(25);
    expect(first.nextCursor).toBe(first.items.at(-1)?.id);
    expect(pages.at(-1)?.nextCursor).toBeNull();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
    expect(ids).toEqual(expected);
    expect(ids).not.toContain(userIds[0]);
    expect(ids).not.toContain(orphanId);
  });

  it("atomically rejects malformed, unknown, admin, and orphan detail ids", async () => {
    const { getProfileForAdmin } = await import("./admin");
    for (const id of ["bad", "00000000-0000-4000-8000-000000000000", userIds[0]!, orphanId]) await expect(getProfileForAdmin(id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getProfileForAdmin(userIds[1]!)).resolves.toMatchObject({ id: userIds[1] });
  });
});
