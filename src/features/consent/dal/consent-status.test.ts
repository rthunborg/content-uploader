import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const execute = vi.fn();
vi.mock("@/db/client", () => ({ getDatabase: () => ({ transaction: async (callback: (tx: { execute: typeof execute }) => unknown) => callback({ execute }) }) }));
import { productionConsentStatusProvider } from "./consent-status";
import { signHead, signRecord, termsPayloadSha256, ZERO_HMAC } from "../crypto";

const manifest = { schemaVersion: 1 as const, version: "1.0.0", locale: "sv-SE" as const, cards: [
  { id: "content_usage" as const, title: "One", body: "Body one", legalTextMarkdown: "Legal one" },
  { id: "bystander_consent" as const, title: "Two", body: "Body two", legalTextMarkdown: "Legal two" },
  { id: "user_control" as const, title: "Three", body: "Body three", legalTextMarkdown: "Legal three" },
] };

beforeEach(() => { execute.mockReset(); process.env.ACCEPTANCE_HMAC_KEY = randomBytes(32).toString("base64"); });

describe("production consent status provider", () => {
  it("returns true only for a current valid acceptance", async () => {
    const userId = "00000000-0000-4000-8000-000000000001", termsId = "00000000-0000-4000-8000-000000000002", recordId = "00000000-0000-4000-8000-000000000003", sha = termsPayloadSha256(manifest), occurredAt = "2026-07-16T10:00:00.000Z";
    const record = { chainPosition: 1n, recordId, recordType: "acceptance" as const, userIdSnapshot: userId, termsVersionId: termsId, termsPayloadSha256: sha, occurredAt, prevHmac: ZERO_HMAC }; const hmac = signRecord(record);
    execute.mockResolvedValueOnce([{ current_id: termsId, current_sha: sha, current_payload: manifest }]).mockResolvedValueOnce([{ id: recordId, record_type: "acceptance", user_id_snapshot: userId, terms_version_id: termsId, terms_payload_sha256: sha, occurred_at: occurredAt, chain_position: "1", prev_hmac: ZERO_HMAC, hmac }]).mockResolvedValueOnce([{ chain_position: "1", head_hmac: hmac, signature: signHead(1n, hmac) }]);
    await expect(productionConsentStatusProvider.hasCurrentConsent(userId)).resolves.toBe(true);
  });
  it("fails closed when the current payload no longer matches its stored evidence hash", async () => {
    execute.mockResolvedValueOnce([{ current_id: "00000000-0000-4000-8000-000000000002", current_sha: termsPayloadSha256(manifest), current_payload: { ...manifest, cards: [{ ...manifest.cards[0], body: "Tampered body" }, manifest.cards[1], manifest.cards[2]] } }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ chain_position: "0", head_hmac: ZERO_HMAC, signature: ZERO_HMAC }]);
    await expect(productionConsentStatusProvider.hasCurrentConsent("00000000-0000-4000-8000-000000000001")).resolves.toBe(false);
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
