import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/db/client";
import { termsVersions, type TermsPayload } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import { audit } from "@/shared/audit";
import { termsPayloadSha256, validateConsentKeys } from "../crypto";

const CARD_IDS = ["content_usage", "bystander_consent", "user_control"] as const;
export const CURRENT_TERMS_LOCK_ID = 3_100_002;
const cardSchema = z.object({ id: z.enum(CARD_IDS), title: z.string().trim().min(1), body: z.string().trim().min(1), legalTextMarkdown: z.string().trim().min(1) }).strict();
export const termsManifestSchema = z.object({ schemaVersion: z.literal(1), version: z.string().regex(/^\d+\.\d+\.\d+$/), locale: z.literal("sv-SE"), cards: z.tuple([cardSchema, cardSchema, cardSchema]) }).strict().superRefine((value, ctx) => { value.cards.forEach((card, index) => { if (card.id !== CARD_IDS[index]) ctx.addIssue({ code: "custom", path: ["cards", index, "id"], message: `Expected ${CARD_IDS[index]}` }); }); });
export type TermsManifest = z.infer<typeof termsManifestSchema>;
export type CurrentTerms = { id: string; payload: TermsPayload; payloadSha256: string; publishedAt: string };

export async function publishTerms(input: unknown): Promise<CurrentTerms> {
  validateConsentKeys();
  const parsed = termsManifestSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION_FAILED", "Villkorsmanifestet är ofullständigt eller ogiltigt.");
  const payload = parsed.data as TermsPayload;
  const sha = termsPayloadSha256(payload);
  try {
    return await getDatabase().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${CURRENT_TERMS_LOCK_ID})`);
      const [row] = await tx.insert(termsVersions).values({ version: payload.version, locale: payload.locale, schemaVersion: 1, payload, payloadSha256: sha }).returning();
      if (!row) throw new Error("Terms insert did not return a row");
      await audit.emit(tx, { type: "terms.version_created", actor: { id: null, nameSnapshot: "system" }, entity: { id: row.id, snapshot: { version: row.version, locale: row.locale, payloadSha256: row.payloadSha256 } } });
      return { id: row.id, payload: row.payload, payloadSha256: row.payloadSha256, publishedAt: row.publishedAt.toISOString() };
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? error.code
      : error && typeof error === "object" && "cause" in error && error.cause && typeof error.cause === "object" && "code" in error.cause
        ? error.cause.code
        : null;
    if (code === "23505") throw new DomainError("CONFLICT", "Den här villkorsversionen finns redan.");
    throw error;
  }
}
export async function readCurrentTerms(): Promise<CurrentTerms | null> { const [row] = await getDatabase().select().from(termsVersions).where(eq(termsVersions.locale, "sv-SE")).orderBy(desc(termsVersions.publishedAt), desc(termsVersions.id)).limit(1); return row ? { id: row.id, payload: row.payload, payloadSha256: row.payloadSha256, publishedAt: row.publishedAt.toISOString() } : null; }
