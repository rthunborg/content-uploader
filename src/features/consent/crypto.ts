import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ZERO_HMAC = "0".repeat(64);
type RecordType = "acceptance" | "erasure_tombstone";
export type ChainPosition = bigint | string;
export type ChainRecord = { chainPosition: ChainPosition; recordId: string; recordType: RecordType; userIdSnapshot: string; termsVersionId: string | null; termsPayloadSha256: string | null; occurredAt: Date | string; prevHmac: string };

export function keyFromBase64(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} is required`);
  const canonical = value.trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(canonical)) throw new Error(`${name} must be canonical base64-encoded 32 bytes`);
  const key = Buffer.from(canonical, "base64");
  if (key.length !== 32 || key.toString("base64") !== canonical) throw new Error(`${name} must be canonical base64-encoded 32 bytes`);
  return key;
}
function lower(value: string) { return value.toLowerCase(); }
function iso(value: Date | string) { return new Date(value).toISOString(); }
export function canonicalJson(value: unknown) { return JSON.stringify(value); }
export function termsPayloadSha256(payload: unknown) { return createHash("sha256").update(canonicalJson(payload), "utf8").digest("hex"); }
export function recordPayload(record: ChainRecord) {
  return canonicalJson(["acceptance-record-v1", String(record.chainPosition), lower(record.recordId), record.recordType, lower(record.userIdSnapshot), record.termsVersionId ? lower(record.termsVersionId) : null, record.termsPayloadSha256 ? lower(record.termsPayloadSha256) : null, iso(record.occurredAt), lower(record.prevHmac)]);
}
export function headPayload(position: ChainPosition, headHmac: string) { return canonicalJson(["acceptance-chain-head-v1", String(position), lower(headHmac)]); }
function hmac(payload: string, keyValue = process.env.ACCEPTANCE_HMAC_KEY) { return createHmac("sha256", keyFromBase64("ACCEPTANCE_HMAC_KEY", keyValue)).update(payload, "utf8").digest("hex"); }
export function signRecord(record: ChainRecord, key?: string) { return hmac(recordPayload(record), key); }
export function signHead(position: ChainPosition, headHmac: string, key?: string) { return hmac(headPayload(position, headHmac), key); }
export function verifyHexHmac(actual: string, expected: string) { const a = Buffer.from(actual, "hex"); const b = Buffer.from(expected, "hex"); return a.length === 32 && b.length === 32 && timingSafeEqual(a, b); }

function encrypt(key: Buffer, plaintext: Buffer, aad: string) { const nonce = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, nonce); cipher.setAAD(Buffer.from(aad)); const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]); return { ciphertext: ciphertext.toString("base64"), nonce: nonce.toString("base64"), tag: cipher.getAuthTag().toString("base64") }; }
function decrypt(key: Buffer, envelope: { ciphertext: string; nonce: string; tag: string }, aad: string) { const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.nonce, "base64")); decipher.setAAD(Buffer.from(aad)); decipher.setAuthTag(Buffer.from(envelope.tag, "base64")); return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]); }
export function encryptIdentity(userId: string, recordId: string, identity: { email: string; fullName: string }, kekValue = process.env.CONSENT_PII_KEK) { const dataKey = randomBytes(32); const identityEnvelope = encrypt(dataKey, Buffer.from(JSON.stringify(identity)), `consent-identity-v1:${lower(userId)}:${lower(recordId)}`); const wrapped = encrypt(keyFromBase64("CONSENT_PII_KEK", kekValue), dataKey, `consent-user-key-v1:${lower(userId)}`); dataKey.fill(0); return { identity: identityEnvelope, wrappedKey: wrapped }; }
export function decryptIdentity(userId: string, recordId: string, identity: { ciphertext: string; nonce: string; tag: string }, wrappedKey: { ciphertext: string; nonce: string; tag: string }, kekValue = process.env.CONSENT_PII_KEK) { const dataKey = decrypt(keyFromBase64("CONSENT_PII_KEK", kekValue), wrappedKey, `consent-user-key-v1:${lower(userId)}`); try { return JSON.parse(decrypt(dataKey, identity, `consent-identity-v1:${lower(userId)}:${lower(recordId)}`).toString("utf8")) as { email: string; fullName: string }; } finally { dataKey.fill(0); } }
export type CryptoEnvelope = { ciphertext: string; nonce: string; tag: string };
export function createUserDataKey(userId: string, kekValue = process.env.CONSENT_PII_KEK) { const dataKey = randomBytes(32); const wrappedKey = encrypt(keyFromBase64("CONSENT_PII_KEK", kekValue), dataKey, `consent-user-key-v1:${lower(userId)}`); return { dataKey, wrappedKey }; }
export function unwrapUserDataKey(userId: string, wrappedKey: CryptoEnvelope, kekValue = process.env.CONSENT_PII_KEK) { return decrypt(keyFromBase64("CONSENT_PII_KEK", kekValue), wrappedKey, `consent-user-key-v1:${lower(userId)}`); }
export function encryptIdentityWithDataKey(userId: string, recordId: string, identity: { email: string; fullName: string }, dataKey: Buffer) { return encrypt(dataKey, Buffer.from(JSON.stringify(identity)), `consent-identity-v1:${lower(userId)}:${lower(recordId)}`); }
export function validateConsentKeys() { keyFromBase64("ACCEPTANCE_HMAC_KEY", process.env.ACCEPTANCE_HMAC_KEY); keyFromBase64("CONSENT_PII_KEK", process.env.CONSENT_PII_KEK); }
export type LedgerRecord = ChainRecord & { hmac: string };
export function verifyAcceptanceLedger(records: LedgerRecord[], head: { chainPosition: ChainPosition; headHmac: string; signature: string }) {
  let previous = ZERO_HMAC; const tombstoned = new Set<string>();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!; const expectedPosition = BigInt(index + 1);
    if (BigInt(record.chainPosition) !== expectedPosition || record.prevHmac !== previous || !verifyHexHmac(record.hmac, signRecord(record))) return false;
    if (record.recordType === "erasure_tombstone") { if (record.termsVersionId || record.termsPayloadSha256 || tombstoned.has(record.userIdSnapshot)) return false; tombstoned.add(record.userIdSnapshot); }
    else if (!record.termsVersionId || !record.termsPayloadSha256 || tombstoned.has(record.userIdSnapshot)) return false;
    previous = record.hmac;
  }
  if (BigInt(head.chainPosition) !== BigInt(records.length) || head.headHmac !== previous) return false;
  if (records.length === 0 && head.signature === ZERO_HMAC) return true;
  return verifyHexHmac(head.signature, signHead(BigInt(records.length), previous));
}
