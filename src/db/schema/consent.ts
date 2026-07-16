import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export type TermsCard = { id: "content_usage" | "bystander_consent" | "user_control"; title: string; body: string; legalTextMarkdown: string };
export type TermsPayload = { schemaVersion: 1; version: string; locale: "sv-SE"; cards: TermsCard[] };

export const termsVersions = pgTable("terms_versions", {
  id: uuid().primaryKey().defaultRandom(),
  version: text().notNull(),
  locale: text().notNull(),
  schemaVersion: integer().notNull(),
  payload: jsonb().$type<TermsPayload>().notNull(),
  payloadSha256: text().notNull(),
  publishedAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_terms_versions_version_locale").on(table.version, table.locale),
  check("terms_versions_schema_version_check", sql`${table.schemaVersion} = 1`),
  check("terms_versions_sha256_check", sql`${table.payloadSha256} ~ '^[0-9a-f]{64}$'`),
]);

export const consentPiiKeys = pgTable("consent_pii_keys", {
  userId: uuid().primaryKey(),
  wrappedKeyCiphertext: text().notNull(),
  wrappedKeyNonce: text().notNull(),
  wrappedKeyTag: text().notNull(),
  createdAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const acceptanceRecords = pgTable("acceptance_records", {
  id: uuid().primaryKey().defaultRandom(),
  recordType: text({ enum: ["acceptance", "erasure_tombstone"] }).notNull(),
  userIdSnapshot: uuid().notNull(),
  termsVersionId: uuid().references(() => termsVersions.id),
  termsPayloadSha256: text(),
  identityCiphertext: text(),
  identityNonce: text(),
  identityTag: text(),
  occurredAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
  chainPosition: bigint({ mode: "bigint" }).notNull(),
  prevHmac: text().notNull(),
  hmac: text().notNull(),
}, (table) => [
  uniqueIndex("idx_acceptance_records_chain_position").on(table.chainPosition),
  uniqueIndex("idx_acceptance_records_one_tombstone").on(table.userIdSnapshot).where(sql`${table.recordType} = 'erasure_tombstone'`),
  index("idx_acceptance_records_user_terms").on(table.userIdSnapshot, table.termsVersionId),
  check("acceptance_records_type_check", sql`${table.recordType} in ('acceptance', 'erasure_tombstone')`),
  check("acceptance_records_hmac_check", sql`${table.hmac} ~ '^[0-9a-f]{64}$' and ${table.prevHmac} ~ '^[0-9a-f]{64}$'`),
  check("acceptance_records_chain_position_check", sql`${table.chainPosition} > 0`),
  check("acceptance_records_shape_check", sql`(${table.recordType} = 'acceptance' and ${table.termsVersionId} is not null and ${table.termsPayloadSha256} ~ '^[0-9a-f]{64}$' and ${table.identityCiphertext} is not null and ${table.identityNonce} is not null and ${table.identityTag} is not null) or (${table.recordType} = 'erasure_tombstone' and ${table.termsVersionId} is null and ${table.termsPayloadSha256} is null and ${table.identityCiphertext} is null and ${table.identityNonce} is null and ${table.identityTag} is null)`),
]);

export const acceptanceChainHead = pgTable("acceptance_chain_head", {
  singleton: integer().primaryKey().default(1),
  chainPosition: bigint({ mode: "bigint" }).notNull().default(0n),
  headHmac: text().notNull(),
  signature: text().notNull(),
}, (table) => [
  check("acceptance_chain_head_singleton_check", sql`${table.singleton} = 1`),
  check("acceptance_chain_head_position_check", sql`${table.chainPosition} >= 0`),
  check("acceptance_chain_head_hmac_check", sql`${table.headHmac} ~ '^[0-9a-f]{64}$' and ${table.signature} ~ '^[0-9a-f]{64}$'`),
]);

export type AcceptanceRecordRow = typeof acceptanceRecords.$inferSelect;
