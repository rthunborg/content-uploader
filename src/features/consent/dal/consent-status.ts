import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { logError } from "@/shared/logger";
import { verifyAcceptanceLedger, type LedgerRecord } from "../crypto";

export interface ConsentStatusProvider {
  hasCurrentConsent(userId: string): Promise<boolean>;
}

type CurrentTermsSnapshot = { current_id: string; current_sha: string };
type HeadSnapshot = { chain_position: string; head_hmac: string; signature: string };

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
          const currentRows = await tx.execute<{ current_id: string | null; current_sha: string | null }>(sql`
            with current_terms as (
              select id, payload_sha256 from public.terms_versions
              where locale = 'sv-SE' order by published_at desc, id desc limit 1
            )
            select id as current_id, payload_sha256 as current_sha from current_terms
          `);
          const currentRow = currentRows[0];
          if (!currentRow?.current_id || !currentRow.current_sha) return { current: null, ledger: [], head: null };
          const records = await tx.execute<{ id: string; record_type: "acceptance" | "erasure_tombstone"; user_id_snapshot: string; terms_version_id: string | null; terms_payload_sha256: string | null; occurred_at: Date | string; chain_position: string; prev_hmac: string; hmac: string }>(sql`select id, record_type, user_id_snapshot, terms_version_id, terms_payload_sha256, occurred_at, chain_position, prev_hmac, hmac from public.acceptance_records order by chain_position`);
          const [head] = await tx.execute<HeadSnapshot>(sql`select chain_position, head_hmac, signature from public.acceptance_chain_head where singleton=1`);
          const ledger: LedgerRecord[] = records.map((record) => ({ chainPosition: record.chain_position, recordId: record.id, recordType: record.record_type, userIdSnapshot: record.user_id_snapshot, termsVersionId: record.terms_version_id, termsPayloadSha256: record.terms_payload_sha256, occurredAt: record.occurred_at, prevHmac: record.prev_hmac, hmac: record.hmac }));
          return { current: { current_id: currentRow.current_id, current_sha: currentRow.current_sha }, ledger, head: head ?? null };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
      if (!current || !head) return false;
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
