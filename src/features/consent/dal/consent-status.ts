import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { verifyAcceptanceLedger, type LedgerRecord } from "../crypto";

export interface ConsentStatusProvider {
  hasCurrentConsent(userId: string): Promise<boolean>;
}

export const productionConsentStatusProvider: ConsentStatusProvider = {
  async hasCurrentConsent(userId) {
    try {
      const rows = await getDatabase().execute<{ current_id: string | null; current_sha: string | null }>(sql`
        with current_terms as (
          select id, payload_sha256 from public.terms_versions
          where locale = 'sv-SE' order by published_at desc, id desc limit 1
        )
        select id as current_id, payload_sha256 as current_sha from current_terms
      `);
      const current = rows[0]; if (!current?.current_id || !current.current_sha) return false;
      const records = await getDatabase().execute<{ id: string; record_type: "acceptance" | "erasure_tombstone"; user_id_snapshot: string; terms_version_id: string | null; terms_payload_sha256: string | null; occurred_at: Date | string; chain_position: string; prev_hmac: string; hmac: string }>(sql`select id, record_type, user_id_snapshot, terms_version_id, terms_payload_sha256, occurred_at, chain_position, prev_hmac, hmac from public.acceptance_records order by chain_position`);
      const [head] = await getDatabase().execute<{ chain_position: string; head_hmac: string; signature: string }>(sql`select chain_position, head_hmac, signature from public.acceptance_chain_head where singleton=1`);
      if (!head) return false;
      const ledger: LedgerRecord[] = records.map((record) => ({ chainPosition: record.chain_position, recordId: record.id, recordType: record.record_type, userIdSnapshot: record.user_id_snapshot, termsVersionId: record.terms_version_id, termsPayloadSha256: record.terms_payload_sha256, occurredAt: record.occurred_at, prevHmac: record.prev_hmac, hmac: record.hmac }));
      if (!verifyAcceptanceLedger(ledger, { chainPosition: head.chain_position, headHmac: head.head_hmac, signature: head.signature })) return false;
      const tombstoned = ledger.some((record) => record.userIdSnapshot === userId && record.recordType === "erasure_tombstone");
      return !tombstoned && ledger.some((record) => record.userIdSnapshot === userId && record.recordType === "acceptance" && record.termsVersionId === current.current_id && record.termsPayloadSha256 === current.current_sha);
    } catch { return false; }
  },
};
