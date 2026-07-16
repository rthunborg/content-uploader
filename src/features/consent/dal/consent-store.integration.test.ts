import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { decryptIdentity } from "../crypto";

vi.mock("server-only", () => ({}));

function localDatabaseUrl(): string | undefined {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  try {
    const output = execFileSync("npx", ["supabase", "--profile", "supabase/cli-profile.yaml", "status", "--output", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return output.match(/^DB_URL="?([^"\n]+)"?$/m)?.[1];
  } catch { return undefined; }
}
const databaseUrl = localDatabaseUrl();
const describeDatabase = databaseUrl ? describe.sequential : describe.skip;
const syntheticManifest = (version: string) => ({ schemaVersion: 1 as const, version, locale: "sv-SE" as const, cards: [
  { id: "content_usage" as const, title: "Synthetic one", body: "Synthetic body one", legalTextMarkdown: "Synthetic legal one" },
  { id: "bystander_consent" as const, title: "Synthetic two", body: "Synthetic body two", legalTextMarkdown: "Synthetic legal two" },
  { id: "user_control" as const, title: "Synthetic three", body: "Synthetic body three", legalTextMarkdown: "Synthetic legal three" },
] });

describeDatabase("Story 3.1 consent store matrix", () => {
  const sql = postgres(databaseUrl ?? "postgres://unused", { prepare: false });
  const version = `99.0.${Date.now()}`;
  const hmacKey = randomBytes(32).toString("base64");
  const kek = randomBytes(32).toString("base64");
  let publishedId = "";
  beforeAll(() => {
    execFileSync("npx", ["supabase", "--profile", "supabase/cli-profile.yaml", "db", "reset"], { stdio: "ignore" });
    process.env.DATABASE_URL = databaseUrl; process.env.ACCEPTANCE_HMAC_KEY = hmacKey; process.env.CONSENT_PII_KEK = kek;
  }, 60_000);
  afterAll(async () => { await sql.end(); });

  it("rejects acceptance when no current terms exists without a partial record", async () => {
    const [{ count: before }] = await sql<{ count: string }[]>`select count(*)::text as count from acceptance_records`;
    const { appendAcceptance } = await import("./acceptance");
    await expect(appendAcceptance(randomUUID(), { email: "synthetic@example.test", fullName: "Synthetic User" })).rejects.toMatchObject({ code: "CONFLICT" });
    const [{ count: after }] = await sql<{ count: string }[]>`select count(*)::text as count from acceptance_records`;
    expect(after).toBe(before);
    const { productionConsentStatusProvider } = await import("./consent-status");
    await expect(productionConsentStatusProvider.hasCurrentConsent(randomUUID())).resolves.toBe(false);
  });

  it("publishes exact structured terms and audit atomically, rejecting invalid and duplicate manifests", async () => {
    const { publishTerms } = await import("./terms");
    const manifest = syntheticManifest(version);
    delete process.env.ACCEPTANCE_HMAC_KEY; await expect(publishTerms(manifest)).rejects.toThrow(/ACCEPTANCE_HMAC_KEY/);
    process.env.ACCEPTANCE_HMAC_KEY = hmacKey; process.env.CONSENT_PII_KEK = "junk"; await expect(publishTerms(manifest)).rejects.toThrow(/CONSENT_PII_KEK/);
    process.env.CONSENT_PII_KEK = kek; expect(await sql`select id from terms_versions where version=${version}`).toHaveLength(0);
    const result = await publishTerms(manifest); publishedId = result.id;
    const [row] = await sql<{ payload: unknown; payload_sha256: string }[]>`select payload, payload_sha256 from terms_versions where id = ${result.id}`;
    expect(row.payload).toEqual(manifest); expect(row.payload_sha256).toBe(result.payloadSha256);
    expect(await sql`select id from audit_events where event_type='terms.version_created' and entity_id=${result.id}`).toHaveLength(1);
    const [{ terms_before, audit_before }] = await sql<{ terms_before: string; audit_before: string }[]>`select (select count(*) from terms_versions)::text terms_before, (select count(*) from audit_events where event_type='terms.version_created')::text audit_before`;
    await expect(publishTerms({ ...manifest, version: `${version}.invalid`, cards: manifest.cards.map((card, index) => index === 0 ? { ...card, legalTextMarkdown: " " } : card) })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(publishTerms(manifest)).rejects.toMatchObject({ code: "CONFLICT" });
    const [{ terms_after, audit_after }] = await sql<{ terms_after: string; audit_after: string }[]>`select (select count(*) from terms_versions)::text terms_after, (select count(*) from audit_events where event_type='terms.version_created')::text audit_after`;
    expect({ terms_after, audit_after }).toEqual({ terms_after: terms_before, audit_after: audit_before });
  });

  it("rolls back invalid identity and failed cryptography, then appends valid encrypted evidence", async () => {
    const { appendAcceptance } = await import("./acceptance"); const userId = randomUUID();
    const [{ count: before }] = await sql<{ count: string }[]>`select count(*)::text count from acceptance_records`;
    await expect(appendAcceptance(userId, { email: "", fullName: "Synthetic" })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    process.env.CONSENT_PII_KEK = "malformed";
    await expect(appendAcceptance(userId, { email: "synthetic@example.test", fullName: "Synthetic" })).rejects.toThrow(/CONSENT_PII_KEK/);
    process.env.CONSENT_PII_KEK = kek;
    expect((await sql`select id from acceptance_records where user_id_snapshot=${userId}`).length).toBe(0);
    expect((await sql`select user_id from consent_pii_keys where user_id=${userId}`).length).toBe(0);
    await appendAcceptance(userId, { email: "synthetic@example.test", fullName: "Synthetic" });
    await appendAcceptance(userId, { email: "second@example.test", fullName: "Synthetic Second" });
    const records = await sql<{ id: string; terms_version_id: string; terms_payload_sha256: string; identity_ciphertext: string; identity_nonce: string; identity_tag: string; chain_position: string }[]>`select id, terms_version_id, terms_payload_sha256, identity_ciphertext, identity_nonce, identity_tag, chain_position from acceptance_records where user_id_snapshot=${userId} order by chain_position`;
    const record = records[0]!;
    expect(record.terms_version_id).toBe(publishedId); expect(record.identity_ciphertext).toBeTruthy(); expect(Number(record.chain_position)).toBeGreaterThan(0);
    const [wrapped] = await sql<{ wrapped_key_ciphertext: string; wrapped_key_nonce: string; wrapped_key_tag: string }[]>`select wrapped_key_ciphertext, wrapped_key_nonce, wrapped_key_tag from consent_pii_keys where user_id=${userId}`;
    expect(records.map((item) => decryptIdentity(userId, item.id, { ciphertext: item.identity_ciphertext, nonce: item.identity_nonce, tag: item.identity_tag }, { ciphertext: wrapped.wrapped_key_ciphertext, nonce: wrapped.wrapped_key_nonce, tag: wrapped.wrapped_key_tag }, kek).email)).toEqual(["synthetic@example.test", "second@example.test"]);
    const [{ count: after }] = await sql<{ count: string }[]>`select count(*)::text count from acceptance_records`; expect(Number(after)).toBe(Number(before) + 2);
    const { productionConsentStatusProvider } = await import("./consent-status");
    await expect(productionConsentStatusProvider.hasCurrentConsent(userId)).resolves.toBe(true);
    const { publishTerms } = await import("./terms"); await publishTerms(syntheticManifest(`99.1.${Date.now()}`));
    await expect(productionConsentStatusProvider.hasCurrentConsent(userId)).resolves.toBe(false);
    await appendAcceptance(userId, { email: "current@example.test", fullName: "Current Synthetic" });
    await expect(productionConsentStatusProvider.hasCurrentConsent(userId)).resolves.toBe(true);
  });

  it("serializes actual concurrent acceptance and tombstone appends without a fork", async () => {
    const { appendAcceptance, cryptoShredAcceptancePii } = await import("./acceptance");
    const userA = randomUUID(), userB = randomUUID();
    const [{ max: before }] = await sql<{ max: string }[]>`select coalesce(max(chain_position),0)::text max from acceptance_records`;
    await Promise.all([appendAcceptance(userA, { email: "a@example.test", fullName: "Synthetic A" }), cryptoShredAcceptancePii(userB)]);
    const rows = await sql<{ chain_position: string; prev_hmac: string; hmac: string }[]>`select chain_position, prev_hmac, hmac from acceptance_records where chain_position > ${Number(before)} order by chain_position`;
    expect(rows.map((row) => Number(row.chain_position))).toEqual([Number(before) + 1, Number(before) + 2]);
    expect(rows[1]!.prev_hmac).toBe(rows[0]!.hmac); expect(new Set(rows.map((row) => row.chain_position)).size).toBe(2);
  });

  it("crypto-shreds idempotently, leaving no decryptable key and exactly one tombstone", async () => {
    const { appendAcceptance, cryptoShredAcceptancePii } = await import("./acceptance"); const user = randomUUID();
    await appendAcceptance(user, { email: "erase@example.test", fullName: "Synthetic Erase" });
    const first = await cryptoShredAcceptancePii(user); const second = await cryptoShredAcceptancePii(user);
    expect(first.alreadyShredded).toBe(false); expect(second).toMatchObject({ id: first.id, alreadyShredded: true });
    expect(await sql`select user_id from consent_pii_keys where user_id=${user}`).toHaveLength(0);
    expect(await sql`select id from acceptance_records where user_id_snapshot=${user} and record_type='erasure_tombstone'`).toHaveLength(1);
    const { productionConsentStatusProvider } = await import("./consent-status"); await expect(productionConsentStatusProvider.hasCurrentConsent(user)).resolves.toBe(false);
    await expect(appendAcceptance(user, { email: "after@example.test", fullName: "After Erasure" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("enforces intended INSERT grants and owner-effective UPDATE/DELETE rejection", async () => {
    const [privileges] = await sql<{ authenticated_insert: boolean; service_insert: boolean }[]>`select has_table_privilege('authenticated','public.acceptance_records','insert') authenticated_insert, has_table_privilege('service_role','public.acceptance_records','insert') service_insert`;
    expect(privileges).toEqual({ authenticated_insert: false, service_insert: true });
    const [record] = await sql<{ id: string }[]>`select id from acceptance_records order by chain_position limit 1`;
    await expect(sql`update acceptance_records set hmac=repeat('f',64) where id=${record.id}`).rejects.toMatchObject({ code: "55000" });
    await expect(sql`delete from acceptance_records where id=${record.id}`).rejects.toMatchObject({ code: "55000" });
    const [shape] = await sql<{ has_updated_at: boolean; live_fk_count: string }[]>`select exists(select 1 from information_schema.columns where table_schema='public' and table_name='acceptance_records' and column_name='updated_at') has_updated_at, (select count(*) from pg_constraint where conrelid='public.acceptance_records'::regclass and contype='f' and confrelid <> 'public.terms_versions'::regclass)::text live_fk_count`;
    expect(shape).toEqual({ has_updated_at: false, live_fk_count: "0" });
  });
  it("fails closed when persisted chain evidence is malformed", async () => {
    const [record] = await sql<{ id: string; hmac: string; user_id_snapshot: string }[]>`select id, hmac, user_id_snapshot from acceptance_records where record_type='acceptance' order by chain_position limit 1`;
    await sql.begin(async (tx) => { await tx`set local session_replication_role = replica`; await tx`update acceptance_records set hmac=repeat('f',64) where id=${record.id}`; });
    const { productionConsentStatusProvider } = await import("./consent-status"); await expect(productionConsentStatusProvider.hasCurrentConsent(record.user_id_snapshot)).resolves.toBe(false);
  });
});
