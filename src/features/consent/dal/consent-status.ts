import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { logError } from "@/shared/logger";
import { verifyAcceptanceLedger, type LedgerRecord } from "../crypto";
import { termsManifestSchema, type CurrentTerms, type TermsManifest } from "./terms";
import { termsPayloadSha256 } from "../crypto";

export interface ConsentStatusProvider {
  hasCurrentConsent(userId: string): Promise<boolean>;
}

type CurrentTermsSnapshot = { current_id: string; current_sha: string; current_payload: unknown };
type HeadSnapshot = { chain_position: string; head_hmac: string; signature: string };

export type ReacceptanceContext = {
  mode: "first-login" | "reaccept" | "current";
  currentTerms: Omit<CurrentTerms, "payload"> & { payload: TermsManifest };
  changedCardIds: TermsManifest["cards"][number]["id"][] | null;
};

/** Returns change claims only when both manifests and the complete acceptance chain verify. */
export async function readVerifiedReacceptanceContext(userId: string): Promise<ReacceptanceContext | null> {
  try {
    return await getDatabase().transaction(async (tx) => {
      const termsRows = await tx.execute<{ id: string; payload: unknown; payload_sha256: string; published_at: Date | string }>(sql`
        select id, payload, payload_sha256, published_at from public.terms_versions
        where locale = 'sv-SE' order by published_at desc, id desc
      `);
      const currentRow = termsRows[0];
      if (!currentRow) return null;
      const currentParsed = termsManifestSchema.safeParse(currentRow.payload);
      if (!currentParsed.success || termsPayloadSha256(currentParsed.data) !== currentRow.payload_sha256) return null;
      const records = await tx.execute<{ id: string; record_type: "acceptance" | "erasure_tombstone"; user_id_snapshot: string; terms_version_id: string | null; terms_payload_sha256: string | null; occurred_at: Date | string; chain_position: string; prev_hmac: string; hmac: string }>(sql`select id, record_type, user_id_snapshot, terms_version_id, terms_payload_sha256, occurred_at, chain_position, prev_hmac, hmac from public.acceptance_records order by chain_position`);
      const [head] = await tx.execute<HeadSnapshot>(sql`select chain_position, head_hmac, signature from public.acceptance_chain_head where singleton=1`);
      if (!head) return null;
      const ledger: LedgerRecord[] = records.map((record) => ({ chainPosition: record.chain_position, recordId: record.id, recordType: record.record_type, userIdSnapshot: record.user_id_snapshot, termsVersionId: record.terms_version_id, termsPayloadSha256: record.terms_payload_sha256, occurredAt: record.occurred_at, prevHmac: record.prev_hmac, hmac: record.hmac }));
      if (!verifyAcceptanceLedger(ledger, { chainPosition: head.chain_position, headHmac: head.head_hmac, signature: head.signature })) return null;
      // Fail closed for crypto-shredded users, mirroring hasCurrentConsent: a tombstoned
      // user must never be presented as current/re-accept (which would loop against the gate).
      if (ledger.some((record) => record.userIdSnapshot === userId && record.recordType === "erasure_tombstone")) return null;
      const latest = [...ledger].reverse().find((record) => record.userIdSnapshot === userId && record.recordType === "acceptance");
      const currentTerms = { id: currentRow.id, payload: currentParsed.data, payloadSha256: currentRow.payload_sha256, publishedAt: new Date(currentRow.published_at).toISOString() };
      if (!latest) return { mode: "first-login", currentTerms, changedCardIds: [] };
      if (latest.termsVersionId === currentRow.id && latest.termsPayloadSha256 === currentRow.payload_sha256) return { mode: "current", currentTerms, changedCardIds: [] };
      const priorRow = termsRows.find((row) => row.id === latest.termsVersionId && row.payload_sha256 === latest.termsPayloadSha256);
      if (!priorRow) return { mode: "reaccept", currentTerms, changedCardIds: null };
      const priorParsed = termsManifestSchema.safeParse(priorRow.payload);
      if (!priorParsed.success || termsPayloadSha256(priorParsed.data) !== priorRow.payload_sha256) return { mode: "reaccept", currentTerms, changedCardIds: null };
      const changedCardIds = currentParsed.data.cards.filter((card, index) => {
        const prior = priorParsed.data.cards[index];
        return !prior || card.id !== prior.id || card.title !== prior.title || card.body !== prior.body || card.legalTextMarkdown !== prior.legalTextMarkdown;
      }).map((card) => card.id);
      return { mode: "reaccept", currentTerms, changedCardIds };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  } catch (error) {
    logError("consent.reacceptance_context_failed", error);
    return null;
  }
}

export const productionConsentStatusProvider: ConsentStatusProvider = {
  async hasCurrentConsent(userId) {
    try {
      // Read the current terms, the full ledger, and the signed head in a single
      // repeatable-read snapshot. Reading them as separate autocommitted
      // statements lets a concurrent append advance the head between reads, so
      // verifyAcceptanceLedger would see the head one position ahead of the record
      // count and fail-close an otherwise-consented user.
      const { current, ledger, head } = await getDatabase().transaction(
        async (tx): Promise<{ current: CurrentTermsSnapshot | null; ledger: LedgerRecord[]; head: HeadSnapshot | null }> => {
          const currentRows = await tx.execute<{ current_id: string | null; current_sha: string | null; current_payload: unknown }>(sql`
            with current_terms as (
              select id, payload, payload_sha256 from public.terms_versions
              where locale = 'sv-SE' order by published_at desc, id desc limit 1
            )
            select id as current_id, payload as current_payload, payload_sha256 as current_sha from current_terms
          `);
          const currentRow = currentRows[0];
          if (!currentRow?.current_id || !currentRow.current_sha) return { current: null, ledger: [], head: null };
          const records = await tx.execute<{ id: string; record_type: "acceptance" | "erasure_tombstone"; user_id_snapshot: string; terms_version_id: string | null; terms_payload_sha256: string | null; occurred_at: Date | string; chain_position: string; prev_hmac: string; hmac: string }>(sql`select id, record_type, user_id_snapshot, terms_version_id, terms_payload_sha256, occurred_at, chain_position, prev_hmac, hmac from public.acceptance_records order by chain_position`);
          const [head] = await tx.execute<HeadSnapshot>(sql`select chain_position, head_hmac, signature from public.acceptance_chain_head where singleton=1`);
          const ledger: LedgerRecord[] = records.map((record) => ({ chainPosition: record.chain_position, recordId: record.id, recordType: record.record_type, userIdSnapshot: record.user_id_snapshot, termsVersionId: record.terms_version_id, termsPayloadSha256: record.terms_payload_sha256, occurredAt: record.occurred_at, prevHmac: record.prev_hmac, hmac: record.hmac }));
          return { current: { current_id: currentRow.current_id, current_sha: currentRow.current_sha, current_payload: currentRow.current_payload }, ledger, head: head ?? null };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
      if (!current || !head) return false;
      const currentPayload = termsManifestSchema.safeParse(current.current_payload);
      if (!currentPayload.success || termsPayloadSha256(currentPayload.data) !== current.current_sha) return false;
      if (!verifyAcceptanceLedger(ledger, { chainPosition: head.chain_position, headHmac: head.head_hmac, signature: head.signature })) return false;
      const tombstoned = ledger.some((record) => record.userIdSnapshot === userId && record.recordType === "erasure_tombstone");
      return !tombstoned && ledger.some((record) => record.userIdSnapshot === userId && record.recordType === "acceptance" && record.termsVersionId === current.current_id && record.termsPayloadSha256 === current.current_sha);
    } catch (error) {
      // Fail closed, but not silently: a store/integrity error here must not be
      // indistinguishable from "no consent" to operators.
      logError("consent.status_check_failed", error);
      return false;
    }
  },
};
