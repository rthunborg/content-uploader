import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = testDatabaseUrl ? describe : describe.skip;

describeDatabase("organization schema against migrated Postgres", () => {
  const sql = postgres(testDatabaseUrl ?? "postgres://unused", { prepare: false });
  const profileEmailPrefix = "story-1-2-integration-";
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await sql`truncate table asset_campaigns, asset_themes, campaigns, themes, assets cascade`;
    const staleProfiles = await sql<{ id: string }[]>`
      delete from profiles where email like ${`${profileEmailPrefix}%`} returning id
    `;
    if (staleProfiles.length > 0) {
      await sql`delete from auth.users where id = any(${staleProfiles.map(({ id }) => id)}::uuid[])`;
    }
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await sql`delete from profiles where id = any(${createdUserIds}::uuid[])`;
      await sql`delete from auth.users where id = any(${createdUserIds}::uuid[])`;
    }
    await sql.end();
  });

  it("accepts exactly the five profile states and exposes no authorization columns", async () => {
    const states = [
      "invited",
      "active",
      "inactive_declined",
      "inactive_withdrawn",
      "deactivated",
    ];

    for (const [index, state] of states.entries()) {
      const [user] = await sql<{ id: string }[]>`
        insert into auth.users (id) values (gen_random_uuid()) returning id
      `;
      createdUserIds.push(user.id);
      await sql`
        insert into profiles (id, email, account_state)
        values (${user.id}, ${`${profileEmailPrefix}${index}@example.test`}, ${state})
      `;
    }

    const [forbiddenUser] = await sql<{ id: string }[]>`
      insert into auth.users (id) values (gen_random_uuid()) returning id
    `;
    createdUserIds.push(forbiddenUser.id);
    await expect(
      sql`
        insert into profiles (id, email, account_state)
        values (${forbiddenUser.id}, ${`${profileEmailPrefix}deleted@example.test`}, 'deleted')
      `,
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      sql`
        insert into profiles (id, email, account_state)
        values (${forbiddenUser.id}, ${`${profileEmailPrefix}unknown@example.test`}, 'unknown_state')
      `,
    ).rejects.toMatchObject({ code: "23514" });

    const columns = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
    `;
    expect(columns.map(({ column_name }) => column_name)).not.toEqual(
      expect.arrayContaining(["role", "admin", "deleted"]),
    );
  });

  it("keeps joins explicit and enforces pair uniqueness", async () => {
    const [asset] = await sql<{ id: string }[]>`insert into assets default values returning id`;
    const [theme] = await sql<{ id: string }[]>`
      insert into themes (name) values ('Integration theme') returning id
    `;
    const [campaign] = await sql<{ id: string; theme_id: string | null }[]>`
      insert into campaigns (name, description, starts_at, ends_at)
      values ('Integration campaign', 'Dormant seam', now(), now() + interval '1 day')
      returning id, theme_id
    `;

    expect(campaign.theme_id).toBeNull();
    expect(await sql`select * from asset_themes where asset_id = ${asset.id}`).toHaveLength(0);
    expect(await sql`select * from asset_campaigns where asset_id = ${asset.id}`).toHaveLength(0);

    await sql`insert into asset_themes (asset_id, theme_id) values (${asset.id}, ${theme.id})`;
    await expect(
      sql`insert into asset_themes (asset_id, theme_id) values (${asset.id}, ${theme.id})`,
    ).rejects.toMatchObject({ code: "23505" });

    await sql`insert into asset_campaigns (asset_id, campaign_id) values (${asset.id}, ${campaign.id})`;
    await expect(
      sql`insert into asset_campaigns (asset_id, campaign_id) values (${asset.id}, ${campaign.id})`,
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("nulls a campaign theme reference when the unconnected theme is deleted", async () => {
    const [theme] = await sql<{ id: string }[]>`
      insert into themes (name) values ('Disposable theme') returning id
    `;
    const [campaign] = await sql<{ id: string }[]>`
      insert into campaigns (name, description, starts_at, ends_at, theme_id)
      values ('Theme removal', 'Set-null check', now(), now(), ${theme.id})
      returning id
    `;

    await sql`delete from themes where id = ${theme.id}`;

    const [remaining] = await sql<{ theme_id: string | null }[]>`
      select theme_id from campaigns where id = ${campaign.id}
    `;
    expect(remaining.theme_id).toBeNull();
  });

  it("rejects a campaign whose end precedes its start", async () => {
    await expect(
      sql`
        insert into campaigns (name, description, starts_at, ends_at)
        values ('Invalid range', 'Date-order check', now(), now() - interval '1 day')
      `,
    ).rejects.toMatchObject({ code: "23514", constraint_name: "campaigns_date_order_check" });
  });

  it("has reverse browse indexes, foreign keys, and direct authenticated access denied", async () => {
    const indexes = await sql<{ indexname: string }[]>`
      select indexname from pg_indexes
      where schemaname = 'public' and indexname in (
        'idx_asset_themes_theme_id_asset_id',
        'idx_asset_campaigns_campaign_id_asset_id'
      )
    `;
    expect(indexes.map(({ indexname }) => indexname).sort()).toEqual([
      "idx_asset_campaigns_campaign_id_asset_id",
      "idx_asset_themes_theme_id_asset_id",
    ]);

    const foreignKeys = await sql<{ name: string; delete_action: string }[]>`
      select conname as name, confdeltype::text as delete_action
      from pg_constraint
      where connamespace = 'public'::regnamespace and contype = 'f'
        and conname = any(${[
          "asset_campaigns_asset_id_assets_id_fk",
          "asset_campaigns_campaign_id_campaigns_id_fk",
          "campaigns_theme_id_themes_id_fk",
          "asset_themes_asset_id_assets_id_fk",
          "asset_themes_theme_id_themes_id_fk",
        ]})
    `;
    expect(Object.fromEntries(foreignKeys.map(({ name, delete_action }) => [name, delete_action]))).toEqual({
      asset_campaigns_asset_id_assets_id_fk: "c",
      asset_campaigns_campaign_id_campaigns_id_fk: "r",
      campaigns_theme_id_themes_id_fk: "n",
      asset_themes_asset_id_assets_id_fk: "c",
      asset_themes_theme_id_themes_id_fk: "r",
    });

    const [profileIdentityTrigger] = await sql<{ enabled: string }[]>`
      select tgenabled as enabled
      from pg_trigger
      where tgrelid = 'public.profiles'::regclass
        and tgname = 'profiles_require_auth_identity'
        and not tgisinternal
    `;
    expect(profileIdentityTrigger?.enabled).toBe("O");

    await expect(
      sql.begin(async (transaction) => {
        await transaction`set local role authenticated`;
        await transaction`select * from themes`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
