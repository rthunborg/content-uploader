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

  it("atomically activates first login, binds current evidence and audit, and deduplicates replay/concurrency", async () => {
    const userId = randomUUID();
    await sql`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values (${userId}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'first-login@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())`;
    await sql`insert into profiles (id, full_name, email, account_state) values (${userId}, 'First Login Synthetic', 'first-login@example.test', 'invited')`;
    const { acceptCurrentTermsAndActivate } = await import("./acceptance");
    const [first, replayA, replayB] = await Promise.all([
      acceptCurrentTermsAndActivate(userId),
      acceptCurrentTermsAndActivate(userId),
      acceptCurrentTermsAndActivate(userId),
    ]);
    expect(new Set([first.id, replayA.id, replayB.id]).size).toBe(1);
    const [profile] = await sql<{ account_state: string; first_accepted_at: Date }[]>`select account_state, first_accepted_at from profiles where id=${userId}`;
    const evidence = await sql<{ id: string; terms_version_id: string; terms_payload_sha256: string; occurred_at: Date; prev_hmac: string; hmac: string }[]>`select id, terms_version_id, terms_payload_sha256, occurred_at, prev_hmac, hmac from acceptance_records where user_id_snapshot=${userId} and record_type='acceptance'`;
    const [current] = await sql<{ id: string; payload_sha256: string }[]>`select id, payload_sha256 from terms_versions where locale='sv-SE' order by published_at desc, id desc limit 1`;
    expect(profile.account_state).toBe("active"); expect(profile.first_accepted_at.toISOString()).toBe(evidence[0]!.occurred_at.toISOString());
    expect(evidence).toHaveLength(1); expect(evidence[0]).toMatchObject({ terms_version_id: current.id, terms_payload_sha256: current.payload_sha256 });
    expect(await sql`select id from audit_events where event_type='consent.accepted' and entity_id=${evidence[0]!.id}`).toHaveLength(1);
    const [head] = await sql<{ chain_position: string; head_hmac: string }[]>`select chain_position::text, head_hmac from acceptance_chain_head where singleton=1`;
    const [tail] = await sql<{ chain_position: string; hmac: string }[]>`select chain_position::text, hmac from acceptance_records order by chain_position desc limit 1`;
    expect(head.chain_position).toBe(tail.chain_position); expect(head.head_hmac).toBe(tail.hmac);
    const preserved = profile.first_accepted_at;
    await acceptCurrentTermsAndActivate(userId);
    expect((await sql<{ first_accepted_at: Date }[]>`select first_accepted_at from profiles where id=${userId}`)[0]!.first_accepted_at.toISOString()).toBe(preserved.toISOString());
  });

  it("re-accepts v1 to v2 exactly once, preserves first acceptance, and serializes replacement decisions", async () => {
    const { acceptCurrentTermsAndActivate, declineCurrentTerms } = await import("./acceptance");
    const { publishTerms } = await import("./terms");
    const { readVerifiedReacceptanceContext } = await import("./consent-status");
    const acceptingUser = randomUUID();
    await sql`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values (${acceptingUser}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reaccept@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())`;
    await sql`insert into profiles (id, full_name, email, account_state) values (${acceptingUser}, 'Reaccept Synthetic', 'reaccept@example.test', 'invited')`;
    const first = await acceptCurrentTermsAndActivate(acceptingUser);
    const firstAcceptedAt = (await sql<{ first_accepted_at: Date }[]>`select first_accepted_at from profiles where id=${acceptingUser}`)[0]!.first_accepted_at;
    const v2Manifest = syntheticManifest(`99.4.${Date.now()}`);
    v2Manifest.cards[0].title = "Changed title";
    v2Manifest.cards[1].legalTextMarkdown = "Changed legal text only";
    const v2 = await publishTerms(v2Manifest);
    const context = await readVerifiedReacceptanceContext(acceptingUser);
    expect(context).toMatchObject({ mode: "reaccept", changedCardIds: ["content_usage", "bystander_consent"] });
    const results = await Promise.all([
      acceptCurrentTermsAndActivate(acceptingUser),
      acceptCurrentTermsAndActivate(acceptingUser),
      acceptCurrentTermsAndActivate(acceptingUser),
    ]);
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect(results[0]!.id).not.toBe(first.id);
    const [activeProfile] = await sql<{ account_state: string; first_accepted_at: Date }[]>`select account_state, first_accepted_at from profiles where id=${acceptingUser}`;
    expect(activeProfile.account_state).toBe("active");
    expect(activeProfile.first_accepted_at.toISOString()).toBe(firstAcceptedAt.toISOString());
    const v2Evidence = await sql<{ id: string }[]>`select id from acceptance_records where user_id_snapshot=${acceptingUser} and terms_version_id=${v2.id} and record_type='acceptance'`;
    expect(v2Evidence).toHaveLength(1);
    expect(await sql`select id from audit_events where event_type='consent.accepted' and entity_id=${v2Evidence[0]!.id}`).toHaveLength(1);
    expect(await sql`select id from acceptance_records where user_id_snapshot=${acceptingUser} and record_type='acceptance'`).toHaveLength(2);
    await expect(readVerifiedReacceptanceContext(acceptingUser)).resolves.toMatchObject({ mode: "current", changedCardIds: [] });

    const decliningUser = randomUUID();
    await sql`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values (${decliningUser}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'redecline@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())`;
    await sql`insert into profiles (id, full_name, email, account_state) values (${decliningUser}, 'Redecline Synthetic', 'redecline@example.test', 'invited')`;
    await acceptCurrentTermsAndActivate(decliningUser);
    const decliningFirstAcceptedAt = (await sql<{ first_accepted_at: Date }[]>`select first_accepted_at from profiles where id=${decliningUser}`)[0]!.first_accepted_at;
    const v3Manifest = syntheticManifest(`99.5.${Date.now()}`); v3Manifest.cards[2].body = "Replacement body";
    await publishTerms(v3Manifest);
    const [declineA, declineB] = await Promise.all([declineCurrentTerms(decliningUser), declineCurrentTerms(decliningUser)]);
    expect([declineA.alreadyDeclined, declineB.alreadyDeclined].sort()).toEqual([false, true]);
    const [declinedProfile] = await sql<{ account_state: string; first_accepted_at: Date }[]>`select account_state, first_accepted_at from profiles where id=${decliningUser}`;
    expect(declinedProfile.account_state).toBe("inactive_declined");
    expect(declinedProfile.first_accepted_at.toISOString()).toBe(decliningFirstAcceptedAt.toISOString());
    expect(await sql`select id from audit_events where event_type='consent.declined' and actor_id=${decliningUser}`).toHaveLength(1);
    expect(await sql`select id from acceptance_records where user_id_snapshot=${decliningUser} and record_type='acceptance'`).toHaveLength(1);
  });

  it("serializes a terms publication racing an active stale acceptance", async () => {
    const { acceptCurrentTermsAndActivate } = await import("./acceptance");
    const { publishTerms } = await import("./terms");
    const userId = randomUUID();
    await sql`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values (${userId}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'publication-race@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())`;
    await sql`insert into profiles (id, full_name, email, account_state) values (${userId}, 'Publication Race', 'publication-race@example.test', 'invited')`;
    await acceptCurrentTermsAndActivate(userId);
    const submittedVersion = await publishTerms(syntheticManifest(`99.6.${Date.now()}`));
    const racingManifest = syntheticManifest(`99.7.${Date.now()}`); racingManifest.cards[0].body = "Published during submission";
    const [acceptResult, published] = await Promise.all([acceptCurrentTermsAndActivate(userId), publishTerms(racingManifest)]);
    const accepted = (await sql<{ terms_version_id: string }[]>`select terms_version_id from acceptance_records where id=${acceptResult.id}`)[0]!;
    const [current] = await sql<{ id: string }[]>`select id from terms_versions where locale='sv-SE' order by published_at desc, id desc limit 1`;
    expect(current.id).toBe(published.id);
    expect([submittedVersion.id, published.id]).toContain(accepted.terms_version_id);
    expect(await sql`select id from acceptance_records where user_id_snapshot=${userId} and terms_version_id=${accepted.terms_version_id}`).toHaveLength(1);
    expect(await sql`select id from audit_events where event_type='consent.accepted' and entity_id=${acceptResult.id}`).toHaveLength(1);
    const { productionConsentStatusProvider } = await import("./consent-status");
    if (accepted.terms_version_id === submittedVersion.id) {
      await expect(productionConsentStatusProvider.hasCurrentConsent(userId)).resolves.toBe(false);
      const resumed = await acceptCurrentTermsAndActivate(userId);
      expect(resumed.termsVersionId).toBe(published.id);
      await expect(productionConsentStatusProvider.hasCurrentConsent(userId)).resolves.toBe(true);
    } else {
      expect(accepted.terms_version_id).toBe(published.id);
      await expect(productionConsentStatusProvider.hasCurrentConsent(userId)).resolves.toBe(true);
    }
  });

  it("fails closed when same-version replay evidence has a different payload hash", async () => {
    const userId = randomUUID();
    await sql`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values (${userId}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hash-replay@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())`;
    await sql`insert into profiles (id, full_name, email, account_state) values (${userId}, 'Hash Replay', 'hash-replay@example.test', 'invited')`;
    const { acceptCurrentTermsAndActivate } = await import("./acceptance");
    const accepted = await acceptCurrentTermsAndActivate(userId);
    const [original] = await sql<{ terms_payload_sha256: string }[]>`select terms_payload_sha256 from acceptance_records where id=${accepted.id}`;
    await sql`alter table acceptance_records disable trigger acceptance_records_immutable`;
    try {
      await sql`update acceptance_records set terms_payload_sha256=${"f".repeat(64)} where id=${accepted.id}`;
      await expect(acceptCurrentTermsAndActivate(userId)).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await sql`select id from acceptance_records where user_id_snapshot=${userId}`).toHaveLength(1);
    } finally {
      await sql`update acceptance_records set terms_payload_sha256=${original.terms_payload_sha256} where id=${accepted.id}`;
      await sql`alter table acceptance_records enable trigger acceptance_records_immutable`;
    }
  });

  it("rolls back evidence, audit and activation when the profile mutation fails", async () => {
    const userId = randomUUID();
    await sql`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values (${userId}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rollback-login@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())`;
    await sql`insert into profiles (id, full_name, email, account_state) values (${userId}, 'Rollback Synthetic', 'rollback-login@example.test', 'invited')`;
    await sql`create function pg_temp.reject_story_3_2_activation() returns trigger language plpgsql as $$ begin if new.account_state='active' then raise exception 'synthetic activation failure'; end if; return new; end $$`;
    await sql`create trigger story_3_2_reject_activation before update on profiles for each row execute function pg_temp.reject_story_3_2_activation()`;
    const before = (await sql<{ chain_position: string; head_hmac: string }[]>`select chain_position::text, head_hmac from acceptance_chain_head where singleton=1`)[0]!;
    const { acceptCurrentTermsAndActivate } = await import("./acceptance");
    await expect(acceptCurrentTermsAndActivate(userId)).rejects.toThrow();
    await sql`drop trigger story_3_2_reject_activation on profiles`;
    expect(await sql`select id from acceptance_records where user_id_snapshot=${userId}`).toHaveLength(0);
    expect(await sql`select id from audit_events where event_type='consent.accepted' and actor_id=${userId}`).toHaveLength(0);
    expect((await sql<{ account_state: string; first_accepted_at: Date | null }[]>`select account_state, first_accepted_at from profiles where id=${userId}`)[0]).toEqual({ account_state: "invited", first_accepted_at: null });
    expect((await sql<{ chain_position: string; head_hmac: string }[]>`select chain_position::text, head_hmac from acceptance_chain_head where singleton=1`)[0]).toEqual(before);
  });

  it("declines idempotently and supports locked self-service reactivation without duplicate evidence", async () => {
    const userId = randomUUID();
    await sql`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values (${userId}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'decline@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())`;
    await sql`insert into profiles (id, full_name, email, account_state) values (${userId}, 'Decline Synthetic', 'decline@example.test', 'invited')`;
    const { acceptCurrentTermsAndActivate, declineCurrentTerms } = await import("./acceptance");
    const [first, replay] = await Promise.all([declineCurrentTerms(userId), declineCurrentTerms(userId)]);
    expect([first.alreadyDeclined, replay.alreadyDeclined].sort()).toEqual([false, true]);
    expect((await sql<{ account_state: string }[]>`select account_state from profiles where id=${userId}`)[0]!.account_state).toBe("inactive_declined");
    expect(await sql`select id from audit_events where event_type='consent.declined' and actor_id=${userId}`).toHaveLength(1);
    expect(await sql`select id from acceptance_records where user_id_snapshot=${userId}`).toHaveLength(0);

    const accepted = await acceptCurrentTermsAndActivate(userId);
    const firstAcceptedAt = (await sql<{ first_accepted_at: Date }[]>`select first_accepted_at from profiles where id=${userId}`)[0]!.first_accepted_at;
    await expect(declineCurrentTerms(userId)).rejects.toMatchObject({ code: "CONFLICT" });
    await sql`update profiles set account_state='inactive_declined' where id=${userId}`;
    const replayAcceptance = await acceptCurrentTermsAndActivate(userId);
    const [profile] = await sql<{ account_state: string; first_accepted_at: Date }[]>`select account_state, first_accepted_at from profiles where id=${userId}`;
    expect(profile.account_state).toBe("active");
    expect(profile.first_accepted_at.toISOString()).toBe(firstAcceptedAt.toISOString());
    expect(replayAcceptance).toMatchObject({ id: accepted.id, alreadyAccepted: true });
    expect(await sql`select id from acceptance_records where user_id_snapshot=${userId} and record_type='acceptance'`).toHaveLength(1);
    expect(await sql`select id from audit_events where event_type='consent.accepted' and actor_id=${userId}`).toHaveLength(1);
    expect(await sql`select id from audit_events where event_type='consent.declined' and actor_id=${userId}`).toHaveLength(1);
  });

  it("serializes an accept-versus-decline race into a coherent state", async () => {
    const userId = randomUUID();
    await sql`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values (${userId}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'race@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())`;
    await sql`insert into profiles (id, full_name, email, account_state) values (${userId}, 'Race Synthetic', 'race@example.test', 'invited')`;
    const { acceptCurrentTermsAndActivate, declineCurrentTerms } = await import("./acceptance");
    const [acceptResult, declineResult] = await Promise.allSettled([acceptCurrentTermsAndActivate(userId), declineCurrentTerms(userId)]);
    const [profile] = await sql<{ account_state: string; first_accepted_at: Date }[]>`select account_state, first_accepted_at from profiles where id=${userId}`;
    expect(acceptResult.status).toBe("fulfilled");
    expect(profile.account_state).toBe("active");
    expect(profile.first_accepted_at).toBeTruthy();
    expect(await sql`select id from acceptance_records where user_id_snapshot=${userId} and record_type='acceptance'`).toHaveLength(1);
    expect(await sql`select id from audit_events where event_type='consent.accepted' and actor_id=${userId}`).toHaveLength(1);
    expect(await sql`select id from audit_events where event_type='consent.declined' and actor_id=${userId}`).toHaveLength(declineResult.status === "fulfilled" ? 1 : 0);
  });

  it("rolls back the decline state when its audit transaction fails", async () => {
    const userId = randomUUID();
    await sql`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values (${userId}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'decline-rollback@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())`;
    await sql`insert into profiles (id, full_name, email, account_state) values (${userId}, 'Decline Rollback Synthetic', 'decline-rollback@example.test', 'invited')`;
    await sql`create function pg_temp.reject_story_3_3_decline_audit() returns trigger language plpgsql as $$ begin if new.event_type='consent.declined' then raise exception 'synthetic decline audit failure'; end if; return new; end $$`;
    await sql`create trigger story_3_3_reject_decline_audit before insert on audit_events for each row execute function pg_temp.reject_story_3_3_decline_audit()`;
    const { declineCurrentTerms } = await import("./acceptance");
    await expect(declineCurrentTerms(userId)).rejects.toThrow();
    await sql`drop trigger story_3_3_reject_decline_audit on audit_events`;
    expect((await sql<{ account_state: string }[]>`select account_state from profiles where id=${userId}`)[0]!.account_state).toBe("invited");
    expect(await sql`select id from audit_events where event_type='consent.declined' and actor_id=${userId}`).toHaveLength(0);
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
    await expect(sql`truncate acceptance_records`).rejects.toMatchObject({ code: "55000" });
    const [shape] = await sql<{ has_updated_at: boolean; live_fk_count: string }[]>`select exists(select 1 from information_schema.columns where table_schema='public' and table_name='acceptance_records' and column_name='updated_at') has_updated_at, (select count(*) from pg_constraint where conrelid='public.acceptance_records'::regclass and contype='f' and confrelid <> 'public.terms_versions'::regclass)::text live_fk_count`;
    expect(shape).toEqual({ has_updated_at: false, live_fk_count: "0" });
  });
  it("fails closed when persisted chain evidence is malformed", async () => {
    const [record] = await sql<{ id: string; hmac: string; user_id_snapshot: string }[]>`select id, hmac, user_id_snapshot from acceptance_records where record_type='acceptance' order by chain_position limit 1`;
    await sql.begin(async (tx) => { await tx`set local session_replication_role = replica`; await tx`update acceptance_records set hmac=repeat('f',64) where id=${record.id}`; });
    const { productionConsentStatusProvider } = await import("./consent-status"); await expect(productionConsentStatusProvider.hasCurrentConsent(record.user_id_snapshot)).resolves.toBe(false);
  });
});
