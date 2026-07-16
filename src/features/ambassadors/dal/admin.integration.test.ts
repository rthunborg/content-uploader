import { execFileSync } from "node:child_process";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({
  revokeUserSessionsById: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    actorId: "00000000-0000-4000-8000-000000000009",
    actorNameSnapshot: "admin@example.test",
    role: "admin",
  }),
  revokeUserSessionsById: auth.revokeUserSessionsById,
}));
const authAdmin = vi.hoisted(() => ({
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({ auth: { admin: authAdmin } }),
}));

function localDatabaseUrl(): string | undefined {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  try {
    const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npx";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", "npx supabase --profile supabase/cli-profile.yaml status --output env"]
      : ["supabase", "--profile", "supabase/cli-profile.yaml", "status", "--output", "env"];
    const output = execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.match(/^DB_URL="?([^"\n]+)"?$/m)?.[1];
  } catch {
    return undefined;
  }
}

const databaseUrl = localDatabaseUrl();
const describeDatabase = databaseUrl ? describe.sequential : describe.skip;

describeDatabase("ambassador pagination against migrated Postgres", () => {
  const sql = postgres(databaseUrl ?? "postgres://unused", { prepare: false });
  const prefix = `roster-pagination-${Date.now()}-`;
  const userIds: string[] = [];
  let authOnlyId = "";
  let authOnlyEmail = "";
  let orphanId = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    for (let index = 0; index < 28; index += 1) {
      const metadata = index === 0 ? { admin: true } : index === 1 ? { admin: "legacy" } : {};
      const accountState = index === 2 ? "invited" : "active";
      const [user] = await sql<{ id: string }[]>`insert into auth.users (id, raw_app_meta_data) values (gen_random_uuid(), ${sql.json(metadata)}) returning id`;
      userIds.push(user.id);
      await sql`insert into profiles (id, full_name, email, account_state) values (${user.id}, ${`Person ${index}`}, ${`${prefix}${index}@example.test`}, ${accountState})`;
    }
    const [authOnly] = await sql<{ id: string }[]>`insert into auth.users (id, email, raw_app_meta_data) values (gen_random_uuid(), ${`${prefix}auth-only@example.test`}, '{}'::jsonb) returning id`;
    authOnlyId = authOnly.id;
    authOnlyEmail = `${prefix}auth-only@example.test`;
    const [orphan] = await sql<{ id: string }[]>`select gen_random_uuid() as id`;
    orphanId = orphan.id;
    await sql`set session_replication_role = replica`;
    try { await sql`insert into profiles (id, full_name, email, account_state) values (${orphanId}, 'Orphan', ${`${prefix}orphan@example.test`}, 'active')`; }
    finally { await sql`set session_replication_role = origin`; }
  });

  afterAll(async () => {
    await sql`delete from profiles where email like ${`${prefix}%`}`;
    await sql`delete from auth.users where id = any(${userIds}::uuid[])`;
    await sql`delete from auth.users where id = ${authOnlyId}`;
    await sql.end();
  });

  beforeEach(() => {
    authAdmin.getUserById.mockReset();
    authAdmin.updateUserById.mockReset();
    authAdmin.deleteUser.mockReset();
    auth.revokeUserSessionsById.mockReset();
    auth.revokeUserSessionsById.mockResolvedValue(undefined);
  });

  it("traverses a page boundary with ordered complete non-overlapping ambassador membership", async () => {
    const { listAmbassadors } = await import("./admin");
    const pages = []; let cursor: string | null = null;
    do { const page = await listAmbassadors(cursor); pages.push(page); cursor = page.nextCursor; } while (cursor);
    const ids = pages.flatMap(({ items }) => items.map(({ id }) => id));
    const expectedFixtures = userIds.slice(1).sort();
    const fixtureIds = ids.filter((id) => userIds.includes(id));
    const first = pages[0]!;
    expect(first.items).toHaveLength(25);
    expect(first.nextCursor).toBe(first.items.at(-1)?.id);
    expect(pages.at(-1)?.nextCursor).toBeNull();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
    expect(fixtureIds).toEqual(expectedFixtures);
    expect(ids).not.toContain(userIds[0]);
    expect(ids).not.toContain(authOnlyId);
    expect(ids).not.toContain(orphanId);
  });

  it("atomically rejects malformed, unknown, admin, and orphan detail ids", async () => {
    const { getProfileForAdmin } = await import("./admin");
    for (const id of ["bad", "00000000-0000-4000-8000-000000000000", userIds[0]!, orphanId]) await expect(getProfileForAdmin(id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getProfileForAdmin(userIds[1]!)).resolves.toMatchObject({ id: userIds[1] });
  });

  it("persists normalized contact details consumed by detail and roster reads", async () => {
    const targetId = userIds[2]!;
    const oldEmail = `${prefix}2@example.test`;
    const newEmail = `${prefix}updated@example.test`;
    authAdmin.getUserById.mockResolvedValue({
      data: { user: { id: targetId, email: oldEmail } },
      error: null,
    });
    authAdmin.updateUserById.mockResolvedValue({
      data: { user: { id: targetId, email: newEmail } },
      error: null,
    });
    const { getProfileForAdmin, listAmbassadors, updateAmbassadorContact } = await import("./admin");

    await expect(updateAmbassadorContact(targetId, {
      fullName: "  Anna Andersson  ",
      email: ` ${newEmail.toUpperCase()} `,
      mobile: " +46 70 123 45 67 ",
    })).resolves.toMatchObject({
      id: targetId,
      fullName: "Anna Andersson",
      email: newEmail,
      mobile: "+46 70 123 45 67",
      accountState: "invited",
    });

    expect(authAdmin.updateUserById).toHaveBeenCalledWith(targetId, { email: newEmail });
    await expect(getProfileForAdmin(targetId)).resolves.toMatchObject({
      fullName: "Anna Andersson",
      email: newEmail,
      mobile: "+46 70 123 45 67",
    });
    const persisted = await sql<{ full_name: string; email: string; mobile: string; account_state: string; updated_at: Date }[]>`
      select full_name, email, mobile, account_state, updated_at from profiles where id = ${targetId}
    `;
    expect(persisted[0]).toMatchObject({
      full_name: "Anna Andersson",
      email: newEmail,
      mobile: "+46 70 123 45 67",
      account_state: "invited",
    });
    expect(persisted[0]!.updated_at).toBeInstanceOf(Date);

    const rosterItems = [];
    let cursor: string | null = null;
    do {
      const page = await listAmbassadors(cursor);
      rosterItems.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    expect(rosterItems.find(({ id }) => id === targetId)).toMatchObject({
      fullName: "Anna Andersson",
      email: newEmail,
      mobile: "+46 70 123 45 67",
    });
  });

  it("rejects duplicates found in either profiles or Auth before provider mutation", async () => {
    const targetId = userIds[4]!;
    const oldEmail = `${prefix}4@example.test`;
    authAdmin.getUserById.mockResolvedValue({
      data: { user: { id: targetId, email: oldEmail } },
      error: null,
    });
    const { updateAmbassadorContact } = await import("./admin");

    await expect(updateAmbassadorContact(targetId, {
      fullName: "Person 4",
      email: `${prefix}5@example.test`,
      mobile: null,
    })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(updateAmbassadorContact(targetId, {
      fullName: "Person 4",
      email: authOnlyEmail,
      mobile: null,
    })).rejects.toMatchObject({ code: "CONFLICT" });

    expect(authAdmin.updateUserById).not.toHaveBeenCalled();
    const [persisted] = await sql<{ email: string }[]>`select email from profiles where id = ${targetId}`;
    expect(persisted.email).toBe(oldEmail);
  });

  it("persists lifecycle transitions, audit evidence, revocation behavior, and inactive guard denial", async () => {
    const targetId = userIds[3]!;
    const targetEmail = `${prefix}3@example.test`;
    const { updateAmbassadorLifecycle } = await import("./admin");

    await expect(updateAmbassadorLifecycle(targetId, { action: "deactivate" }))
      .resolves.toMatchObject({ id: targetId, accountState: "deactivated" });

    expect(auth.revokeUserSessionsById).toHaveBeenCalledWith(targetId);
    const [deactivated] = await sql<{ account_state: string; updated_at: Date }[]>`
      select account_state, updated_at from profiles where id = ${targetId}
    `;
    expect(deactivated).toMatchObject({ account_state: "deactivated" });
    expect(deactivated!.updated_at).toBeInstanceOf(Date);
    const deactivationAudit = await sql<{ event_type: string; entity_snapshot: { beforeAccountState: string; afterAccountState: string } }[]>`
      select event_type, entity_snapshot
      from audit_events
      where entity_id = ${targetId} and event_type = 'account.deactivated'
    `;
    expect(deactivationAudit).toHaveLength(1);
    expect(deactivationAudit[0]!.entity_snapshot).toMatchObject({
      beforeAccountState: "active",
      afterAccountState: "deactivated",
    });

    const actualAuth = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
    const guards = actualAuth.createAuthGuards({
      getAuth: async () => ({
        user: { id: targetId, email: targetEmail, app_metadata: {} },
        hadSession: true,
      }),
      getProfile: async () => {
        const [row] = await sql<{ account_state: "deactivated" }[]>`
          select account_state from profiles where id = ${targetId}
        `;
        return {
          id: targetId,
          fullName: "Person 3",
          email: targetEmail,
          mobile: null,
          accountState: row!.account_state,
          invitedAt: null,
          firstAcceptedAt: null,
          firstUploadAt: null,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      consent: { hasCurrentConsent: vi.fn().mockResolvedValue(true) },
    });
    await expect(guards.requireUser()).rejects.toMatchObject({ code: "ACCOUNT_INACTIVE" });

    await expect(updateAmbassadorLifecycle(targetId, { action: "deactivate" }))
      .resolves.toMatchObject({ accountState: "deactivated" });
    expect(auth.revokeUserSessionsById).toHaveBeenCalledTimes(1);
    expect(await sql`select id from audit_events where entity_id = ${targetId} and event_type = 'account.deactivated'`)
      .toHaveLength(1);

    await expect(updateAmbassadorLifecycle(targetId, { action: "reactivate" }))
      .resolves.toMatchObject({ id: targetId, accountState: "active" });
    expect(auth.revokeUserSessionsById).toHaveBeenCalledTimes(1);
    const reactivationAudit = await sql<{ entity_snapshot: { beforeAccountState: string; afterAccountState: string } }[]>`
      select entity_snapshot
      from audit_events
      where entity_id = ${targetId} and event_type = 'account.reactivated'
    `;
    expect(reactivationAudit).toHaveLength(1);
    expect(reactivationAudit[0]!.entity_snapshot).toMatchObject({
      beforeAccountState: "deactivated",
      afterAccountState: "active",
    });
  });

  it("excludes admin targets and does not persist lifecycle state when revocation fails", async () => {
    const { updateAmbassadorLifecycle } = await import("./admin");

    await expect(updateAmbassadorLifecycle(userIds[0]!, { action: "deactivate" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(auth.revokeUserSessionsById).not.toHaveBeenCalled();

    auth.revokeUserSessionsById.mockRejectedValue(new Error("provider secret"));
    const targetId = userIds[4]!;
    await expect(updateAmbassadorLifecycle(targetId, { action: "deactivate" }))
      .rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    const [persisted] = await sql<{ account_state: string }[]>`
      select account_state from profiles where id = ${targetId}
    `;
    expect(persisted.account_state).toBe("active");
    expect(await sql`select id from audit_events where entity_id = ${targetId} and event_type = 'account.deactivated'`)
      .toHaveLength(0);
  });

  it("deletes Auth and profile while retaining unrelated content and durable snapshot evidence", async () => {
    const [authUser] = await sql<{ id: string }[]>`
      insert into auth.users (id, email, raw_app_meta_data)
      values (gen_random_uuid(), ${`${prefix}delete@example.test`}, '{}'::jsonb)
      returning id
    `;
    const targetId = authUser.id;
    await sql`
      insert into profiles (id, full_name, email, mobile, account_state, invited_at, last_login_at)
      values (${targetId}, 'Delete Ambassador', ${`${prefix}delete@example.test`}, '+46701111111', 'inactive_withdrawn', now(), now())
    `;
    const [asset] = await sql<{ id: string }[]>`insert into assets default values returning id`;
    authAdmin.deleteUser.mockImplementation(async (id: string) => {
      await sql`delete from auth.users where id = ${id}`;
      return { error: null };
    });

    const { deleteAccount, getProfileForAdmin } = await import("./admin");
    await expect(deleteAccount(targetId)).resolves.toEqual({ id: targetId, deleted: true });

    expect(auth.revokeUserSessionsById).toHaveBeenCalledWith(targetId);
    expect(await sql`select id from auth.users where id = ${targetId}`).toHaveLength(0);
    expect(await sql`select id from profiles where id = ${targetId}`).toHaveLength(0);
    await expect(getProfileForAdmin(targetId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await sql`select id from assets where id = ${asset.id}`).toHaveLength(1);
    const evidence = await sql<{
      actor_id: string;
      entity_snapshot: { fullName: string; email: string; mobile: string; accountState: string };
    }[]>`
      select actor_id, entity_snapshot
      from audit_events
      where entity_id = ${targetId} and event_type = 'account.deleted'
    `;
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      actor_id: "00000000-0000-4000-8000-000000000009",
      entity_snapshot: {
        fullName: "Delete Ambassador",
        email: `${prefix}delete@example.test`,
        mobile: "+46701111111",
        accountState: "inactive_withdrawn",
      },
    });

    await sql`delete from assets where id = ${asset.id}`;
  });
});
