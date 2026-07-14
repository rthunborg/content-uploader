import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import { profiles } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";

export type AdminProfile = { id: string; email: string; mobile: string | null; accountState: string; invitedAt: string | null; lastLoginAt: string | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getProfileForAdmin(profileId: string): Promise<AdminProfile> {
  await requireAdmin();
  // Reject malformed ids up front: an invalid uuid otherwise reaches Postgres as a 22P02
  // and surfaces as a spurious INTERNAL_ERROR 500 with an incident log instead of a clean 404.
  if (!UUID_PATTERN.test(profileId)) throw new DomainError("NOT_FOUND", "Profilen kunde inte hittas.");
  const [row] = await getDatabase().select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!row) throw new DomainError("NOT_FOUND", "Profilen kunde inte hittas.");
  return { id: row.id, email: row.email, mobile: row.mobile, accountState: row.accountState, invitedAt: row.invitedAt?.toISOString() ?? null, lastLoginAt: row.lastLoginAt?.toISOString() ?? null };
}
