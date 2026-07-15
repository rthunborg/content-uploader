import "server-only";

import { and, asc, eq, gt, sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { profiles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { DomainError } from "@/lib/errors";
import type { AccountState } from "@/shared/account-states";

export type AdminProfile = { id: string; fullName: string | null; email: string; mobile: string | null; accountState: AccountState; invitedAt: string | null; lastLoginAt: string | null };
export type AmbassadorPage = { items: AdminProfile[]; nextCursor: string | null };
export const AMBASSADOR_PAGE_SIZE = 25;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ambassadorIdentity = sql<boolean>`exists (select 1 from auth.users where auth.users.id = ${profiles.id} and (auth.users.raw_app_meta_data -> 'admin') is distinct from 'true'::jsonb)`;

function mapProfile(row: typeof profiles.$inferSelect): AdminProfile {
  return { id: row.id, fullName: row.fullName, email: row.email, mobile: row.mobile, accountState: row.accountState, invitedAt: row.invitedAt?.toISOString() ?? null, lastLoginAt: row.lastLoginAt?.toISOString() ?? null };
}

export async function listAmbassadors(cursor?: string | null): Promise<AmbassadorPage> {
  await requireAdmin();
  if (cursor != null && !UUID_V4_PATTERN.test(cursor)) throw new DomainError("VALIDATION_FAILED");
  const rows = await getDatabase().select().from(profiles).where(and(ambassadorIdentity, cursor ? gt(profiles.id, cursor) : undefined)).orderBy(asc(profiles.id)).limit(AMBASSADOR_PAGE_SIZE + 1);
  return { items: rows.slice(0, AMBASSADOR_PAGE_SIZE).map(mapProfile), nextCursor: rows.length > AMBASSADOR_PAGE_SIZE ? rows[AMBASSADOR_PAGE_SIZE - 1]!.id : null };
}

export async function getProfileForAdmin(profileId: string): Promise<AdminProfile> {
  await requireAdmin();
  if (!UUID_V4_PATTERN.test(profileId)) throw new DomainError("NOT_FOUND");
  const [row] = await getDatabase().select().from(profiles).where(and(eq(profiles.id, profileId), ambassadorIdentity)).limit(1);
  if (!row) throw new DomainError("NOT_FOUND");
  return mapProfile(row);
}
