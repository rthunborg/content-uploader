import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeLogger } from "../../src/shared/logger";
import { verifyAcceptanceChain, runAcceptanceChainVerification, type EvidenceRecord } from "./verify-acceptance-chain";
const key = randomBytes(32).toString("base64"); const sign = (value: unknown) => createHmac("sha256", Buffer.from(key, "base64")).update(JSON.stringify(value)).digest("hex");
function fixture() { const id = randomUUID(), user = randomUUID(), terms = randomUUID(), occurred = "2026-07-16T10:00:00.000Z", prev = "0".repeat(64); const hmac = sign(["acceptance-record-v1", "1", id, "acceptance", user, terms, "a".repeat(64), occurred, prev]); const record: EvidenceRecord = { id, record_type: "acceptance", user_id_snapshot: user, terms_version_id: terms, terms_payload_sha256: "a".repeat(64), occurred_at: occurred, chain_position: "1", prev_hmac: prev, hmac }; return { records: async () => [record], head: async () => ({ chain_position: "1", head_hmac: hmac, signature: sign(["acceptance-chain-head-v1", "1", hmac]) }) }; }
function ledgerFixture() {
  let previous = "0".repeat(64);
  const records = Array.from({ length: 3 }, (_, index): EvidenceRecord => {
    const id = randomUUID(), user = randomUUID(), terms = randomUUID(), occurred = `2026-07-16T10:00:0${index}.000Z`, position = index + 1;
    const hmac = sign(["acceptance-record-v1", String(position), id, "acceptance", user, terms, "a".repeat(64), occurred, previous]);
    const row: EvidenceRecord = { id, record_type: "acceptance", user_id_snapshot: user, terms_version_id: terms, terms_payload_sha256: "a".repeat(64), occurred_at: occurred, chain_position: String(position), prev_hmac: previous, hmac };
    previous = hmac; return row;
  });
  const head = { chain_position: "3", head_hmac: previous, signature: sign(["acceptance-chain-head-v1", "3", previous]) };
  return { records, head };
}
afterEach(() => initializeLogger());
describe("acceptance chain verifier", () => { it("accepts a valid signed ledger and head", async () => expect(verifyAcceptanceChain(fixture(), key)).resolves.toBeUndefined()); it("detects tail truncation and emits one sanitized critical event", async () => { const output = vi.fn(); initializeLogger(output); const source = fixture(); const reader = { records: async () => [], head: source.head }; await expect(runAcceptanceChainVerification(reader, key)).resolves.toBe(false); expect(output).toHaveBeenCalledOnce(); const line = JSON.parse(output.mock.calls[0]![0]); expect(line).toMatchObject({ level: "critical", event: "acceptance_chain.integrity_failed", context: { job: "verify-acceptance-chain" } }); }); });

it("propagates snapshot failures without misreporting them as ledger corruption", async () => {
  const output = vi.fn(); initializeLogger(output);
  const failure = new Error("database unavailable");
  await expect(runAcceptanceChainVerification({ records: async () => [], head: async () => null, snapshot: async () => { throw failure; } }, key)).rejects.toBe(failure);
  expect(output).not.toHaveBeenCalled();
});

it("propagates missing configuration before reading or acknowledging a job", async () => {
  const prior = process.env.ACCEPTANCE_HMAC_KEY; delete process.env.ACCEPTANCE_HMAC_KEY;
  const snapshot = vi.fn();
  try { await expect(runAcceptanceChainVerification({ records: async () => [], head: async () => null, snapshot })).rejects.toThrow(/ACCEPTANCE_HMAC_KEY/); }
  finally { if (prior === undefined) delete process.env.ACCEPTANCE_HMAC_KEY; else process.env.ACCEPTANCE_HMAC_KEY = prior; }
  expect(snapshot).not.toHaveBeenCalled();
});

it("prefers an atomic snapshot over separately timed reads", async () => { const source = fixture(); const snapshot = vi.fn().mockResolvedValue({ records: await source.records(), head: await source.head() }); const records = vi.fn(); const head = vi.fn(); await expect(verifyAcceptanceChain({ records, head, snapshot }, key)).resolves.toBeUndefined(); expect(snapshot).toHaveBeenCalledOnce(); expect(records).not.toHaveBeenCalled(); expect(head).not.toHaveBeenCalled(); });

it("accepts the pristine migrated empty-chain sentinel", async () => { await expect(verifyAcceptanceChain({ records: async () => [], head: async () => ({ chain_position: "0", head_hmac: "0".repeat(64), signature: "0".repeat(64) }) }, key)).resolves.toBeUndefined(); });
it.each(["junk", `${key}junk`, key.slice(0, -1), ""])("strictly rejects malformed HMAC key %j", async (bad) => { await expect(verifyAcceptanceChain(fixture(), bad)).rejects.toThrow(/ACCEPTANCE_HMAC_KEY/); });

describe.each([
  ["changed evidence", (rows: EvidenceRecord[]) => { rows[0] = { ...rows[0]!, terms_payload_sha256: "b".repeat(64) }; }],
  ["missing evidence", (rows: EvidenceRecord[]) => { rows.splice(1, 1); }],
  ["reordered evidence", (rows: EvidenceRecord[]) => { [rows[0], rows[1]] = [rows[1]!, rows[0]!]; }],
  ["forked evidence", (rows: EvidenceRecord[]) => { rows[1] = { ...rows[1]!, prev_hmac: "f".repeat(64) }; }],
  ["tail-truncated evidence", (rows: EvidenceRecord[]) => { rows.pop(); }],
  ["invalid tombstone", (rows: EvidenceRecord[]) => { rows[1] = { ...rows[1]!, record_type: "erasure_tombstone" }; }],
] as const)("verifier corruption matrix: %s", (_name, mutate) => {
  it("emits exactly one sanitized critical event", async () => {
    const source = ledgerFixture(); mutate(source.records); const output = vi.fn(); initializeLogger(output);
    await expect(runAcceptanceChainVerification({ records: async () => source.records, head: async () => source.head }, key)).resolves.toBe(false);
    expect(output).toHaveBeenCalledOnce();
    const serialized = String(output.mock.calls[0]![0]); const line = JSON.parse(serialized);
    expect(line).toMatchObject({ level: "critical", event: "acceptance_chain.integrity_failed", context: { job: "verify-acceptance-chain" } });
    expect(serialized).not.toContain(key); expect(serialized).not.toMatch(/ciphertext|wrapped_key|nonce|authentication_tag/);
  });
});
