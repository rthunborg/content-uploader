import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const execute = vi.fn();
vi.mock("@/db/client", () => ({ getDatabase: () => ({ transaction: async (callback: (tx: { execute: typeof execute }) => unknown) => callback({ execute }) }) }));
import { productionConsentStatusProvider } from "./consent-status";
import { signHead, signRecord, ZERO_HMAC } from "../crypto";

beforeEach(() => { execute.mockReset(); process.env.ACCEPTANCE_HMAC_KEY = randomBytes(32).toString("base64"); });

describe("production consent status provider", () => {
  it("returns true only for a current valid acceptance", async () => {
    const userId = "00000000-0000-4000-8000-000000000001", termsId = "00000000-0000-4000-8000-000000000002", recordId = "00000000-0000-4000-8000-000000000003", sha = "a".repeat(64), occurredAt = "2026-07-16T10:00:00.000Z";
    const record = { chainPosition: 1n, recordId, recordType: "acceptance" as const, userIdSnapshot: userId, termsVersionId: termsId, termsPayloadSha256: sha, occurredAt, prevHmac: ZERO_HMAC }; const hmac = signRecord(record);
    execute.mockResolvedValueOnce([{ current_id: termsId, current_sha: sha }]).mockResolvedValueOnce([{ id: recordId, record_type: "acceptance", user_id_snapshot: userId, terms_version_id: termsId, terms_payload_sha256: sha, occurred_at: occurredAt, chain_position: "1", prev_hmac: ZERO_HMAC, hmac }]).mockResolvedValueOnce([{ chain_position: "1", head_hmac: hmac, signature: signHead(1n, hmac) }]);
    await expect(productionConsentStatusProvider.hasCurrentConsent(userId)).resolves.toBe(true);
  });
  it("fails closed on store errors", async () => {
    execute.mockRejectedValueOnce(new Error("store unavailable"));
    await expect(productionConsentStatusProvider.hasCurrentConsent("00000000-0000-4000-8000-000000000001")).resolves.toBe(false);
  });
  it.each([
    ["stale evidence", false],
    ["absent evidence", false],
    ["tombstoned-only evidence", false],
    ["malformed store response", "true"],
    ["missing result row", undefined],
  ])("fails closed for %s", async (_name, satisfied) => {
    execute.mockResolvedValueOnce(satisfied === undefined ? [] : [{ current_id: null, current_sha: null, satisfied }]);
    await expect(productionConsentStatusProvider.hasCurrentConsent("00000000-0000-4000-8000-000000000001")).resolves.toBe(false);
  });
});
