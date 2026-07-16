import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { DomainError } from "@/lib/errors";
import { audit } from "@/shared/audit";
import { createUserDataKey, encryptIdentityWithDataKey, signHead, signRecord, unwrapUserDataKey, ZERO_HMAC, type CryptoEnvelope } from "../crypto";
import { readCurrentTerms } from "./terms";

const CHAIN_LOCK_ID = 3_100_001;
type Identity = { email: string; fullName: string };
type LockedHead = { chain_position: string; head_hmac: string };
type StoredKey = { wrapped_key_ciphertext: string; wrapped_key_nonce: string; wrapped_key_tag: string };

async function appendChainRecord(tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0], input: { recordType: "acceptance" | "erasure_tombstone"; userId: string; termsVersionId: string | null; termsPayloadSha256: string | null; identity: Identity | null }) {
  await tx.execute(sql`select pg_advisory_xact_lock(${CHAIN_LOCK_ID})`);
  const [head] = await tx.execute<LockedHead>(sql`select chain_position, head_hmac from public.acceptance_chain_head where singleton = 1 for update`);
  if (!head) throw new Error("Acceptance chain head is missing");
  const chainPosition = BigInt(head.chain_position) + 1n;
  const prevHmac = head.head_hmac || ZERO_HMAC;
  const id = randomUUID();
  const occurredAt = new Date();
  const record = { chainPosition, recordId: id, recordType: input.recordType, userIdSnapshot: input.userId, termsVersionId: input.termsVersionId, termsPayloadSha256: input.termsPayloadSha256, occurredAt, prevHmac };
  const recordHmac = signRecord(record);
  let identityEnvelope: CryptoEnvelope | null = null;
  if (input.identity) {
    const tombstone = await tx.execute<{ id: string }>(sql`select id from public.acceptance_records where user_id_snapshot = ${input.userId}::uuid and record_type = 'erasure_tombstone' limit 1`);
    if (tombstone.length) throw new DomainError("CONFLICT", "Raderad samtyckeshistorik kan inte återöppnas.");
    const [stored] = await tx.execute<StoredKey>(sql`select wrapped_key_ciphertext, wrapped_key_nonce, wrapped_key_tag from public.consent_pii_keys where user_id = ${input.userId}::uuid for update`);
    let dataKey: Buffer;
    if (stored) dataKey = unwrapUserDataKey(input.userId, { ciphertext: stored.wrapped_key_ciphertext, nonce: stored.wrapped_key_nonce, tag: stored.wrapped_key_tag });
    else {
      const created = createUserDataKey(input.userId); dataKey = created.dataKey;
      await tx.execute(sql`insert into public.consent_pii_keys (user_id, wrapped_key_ciphertext, wrapped_key_nonce, wrapped_key_tag) values (${input.userId}::uuid, ${created.wrappedKey.ciphertext}, ${created.wrappedKey.nonce}, ${created.wrappedKey.tag})`);
    }
    try { identityEnvelope = encryptIdentityWithDataKey(input.userId, id, input.identity, dataKey); } finally { dataKey.fill(0); }
  }
  await tx.execute(sql`insert into public.acceptance_records (id, record_type, user_id_snapshot, terms_version_id, terms_payload_sha256, identity_ciphertext, identity_nonce, identity_tag, occurred_at, chain_position, prev_hmac, hmac) values (${id}::uuid, ${input.recordType}, ${input.userId}::uuid, ${input.termsVersionId}::uuid, ${input.termsPayloadSha256}, ${identityEnvelope?.ciphertext ?? null}, ${identityEnvelope?.nonce ?? null}, ${identityEnvelope?.tag ?? null}, ${occurredAt.toISOString()}::timestamptz, ${chainPosition.toString()}::bigint, ${prevHmac}, ${recordHmac})`);
  await tx.execute(sql`update public.acceptance_chain_head set chain_position = ${chainPosition.toString()}::bigint, head_hmac = ${recordHmac}, signature = ${signHead(chainPosition, recordHmac)} where singleton = 1`);
  return { id, occurredAt, chainPosition };
}

export async function appendAcceptance(userId: string, identity: Identity) {
  if (!identity.email.trim() || !identity.fullName.trim()) throw new DomainError("VALIDATION_FAILED", "Identitetsuppgifterna är ofullständiga.");
  const terms = await readCurrentTerms();
  if (!terms) throw new DomainError("CONFLICT", "Inga publicerade villkor finns att godkänna.");
  return getDatabase().transaction(async (tx) => { const result = await appendChainRecord(tx, { recordType: "acceptance", userId, termsVersionId: terms.id, termsPayloadSha256: terms.payloadSha256, identity }); await audit.emit(tx, { type: "consent.accepted", actor: { id: userId, nameSnapshot: identity.email }, entity: { id: result.id, snapshot: { termsVersionId: terms.id, termsPayloadSha256: terms.payloadSha256, occurredAt: result.occurredAt.toISOString() } } }); return result; });
}

export async function cryptoShredAcceptancePii(userId: string) {
  return getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${CHAIN_LOCK_ID})`);
    const existing = await tx.execute<{ id: string }>(sql`select id from public.acceptance_records where user_id_snapshot = ${userId}::uuid and record_type = 'erasure_tombstone' limit 1`);
    if (existing.length) { await tx.execute(sql`delete from public.consent_pii_keys where user_id = ${userId}::uuid`); return { id: existing[0]!.id, alreadyShredded: true }; }
    await tx.execute(sql`delete from public.consent_pii_keys where user_id = ${userId}::uuid`);
    const result = await appendChainRecord(tx, { recordType: "erasure_tombstone", userId, termsVersionId: null, termsPayloadSha256: null, identity: null });
    return { id: result.id, alreadyShredded: false };
  });
}
