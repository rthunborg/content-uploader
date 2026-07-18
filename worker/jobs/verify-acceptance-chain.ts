import { createHmac, timingSafeEqual } from "node:crypto";
import { logCritical } from "../lib/logger.ts";

export type EvidenceRecord = { id: string; record_type: "acceptance" | "erasure_tombstone"; user_id_snapshot: string; terms_version_id: string | null; terms_payload_sha256: string | null; occurred_at: Date | string; chain_position: string | bigint; prev_hmac: string; hmac: string };
export type EvidenceHead = { chain_position: string | bigint; head_hmac: string; signature: string };
export type AcceptanceSnapshot = { records: EvidenceRecord[]; head: EvidenceHead | null };
export type AcceptanceEvidenceReader = { records(): Promise<EvidenceRecord[]>; head(): Promise<EvidenceHead | null>; snapshot?(): Promise<AcceptanceSnapshot> };
function key(value = process.env.ACCEPTANCE_HMAC_KEY) { if (!value) throw new Error("ACCEPTANCE_HMAC_KEY is required"); const canonical = value.trim(); if (!/^[A-Za-z0-9+/]{43}=$/.test(canonical)) throw new Error("ACCEPTANCE_HMAC_KEY is malformed"); const decoded = Buffer.from(canonical, "base64"); if (decoded.length !== 32 || decoded.toString("base64") !== canonical) throw new Error("ACCEPTANCE_HMAC_KEY is malformed"); return decoded; }
function sign(payload: unknown, keyValue?: string) { return createHmac("sha256", key(keyValue)).update(JSON.stringify(payload), "utf8").digest("hex"); }
function equal(a: string, b: string) { const left = Buffer.from(a, "hex"), right = Buffer.from(b, "hex"); return left.length === 32 && right.length === 32 && timingSafeEqual(left, right); }
export async function verifyAcceptanceChain(reader: AcceptanceEvidenceReader, keyValue?: string) {
  const snapshot = reader.snapshot ? await reader.snapshot() : { records: await reader.records(), head: await reader.head() };
  const { records, head } = snapshot; let previous = "0".repeat(64); const tombstoned = new Set<string>();
  for (let index = 0; index < records.length; index += 1) { const record = records[index]!; const position = BigInt(index + 1); if (BigInt(record.chain_position) !== position || record.prev_hmac !== previous) throw new Error("Acceptance chain ordering is invalid"); if (record.record_type === "erasure_tombstone") { if (record.terms_version_id || record.terms_payload_sha256 || tombstoned.has(record.user_id_snapshot)) throw new Error("Acceptance tombstone is invalid"); tombstoned.add(record.user_id_snapshot); } else if (!record.terms_version_id || !record.terms_payload_sha256 || tombstoned.has(record.user_id_snapshot)) throw new Error("Acceptance evidence is invalid"); const expected = sign(["acceptance-record-v1", position.toString(), record.id.toLowerCase(), record.record_type, record.user_id_snapshot.toLowerCase(), record.terms_version_id?.toLowerCase() ?? null, record.terms_payload_sha256?.toLowerCase() ?? null, new Date(record.occurred_at).toISOString(), record.prev_hmac.toLowerCase()], keyValue); if (!equal(record.hmac, expected)) throw new Error("Acceptance record signature is invalid"); previous = record.hmac; }
  if (!head || BigInt(head.chain_position) !== BigInt(records.length) || head.head_hmac !== previous) throw new Error("Acceptance chain head does not match the ledger");
  if (records.length === 0 && head.signature === "0".repeat(64)) return;
  const expectedHead = sign(["acceptance-chain-head-v1", String(records.length), previous.toLowerCase()], keyValue); if (!equal(head.signature, expectedHead)) throw new Error("Acceptance chain head signature is invalid");
}
export async function runAcceptanceChainVerification(reader: AcceptanceEvidenceReader, keyValue?: string) {
  // Configuration and snapshot-read failures are operational failures: propagate
  // them so pgmq leaves the job available for retry. Only a completed snapshot
  // whose evidence fails verification is terminal and acknowledged after one
  // sanitized critical event.
  key(keyValue);
  const snapshot = reader.snapshot ? await reader.snapshot() : { records: await reader.records(), head: await reader.head() };
  try {
    await verifyAcceptanceChain({ records: async () => snapshot.records, head: async () => snapshot.head }, keyValue);
    return true;
  } catch (error) {
    logCritical("acceptance_chain.integrity_failed", error, { job: "verify-acceptance-chain" });
    return false;
  }
}
