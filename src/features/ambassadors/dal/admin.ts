import "server-only";

import { and, asc, eq, gt, sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { profiles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { DomainError } from "@/lib/errors";
import type { AccountState } from "@/shared/account-states";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { audit } from "@/shared/audit";
import { logError } from "@/shared/logger";
import { inviteAmbassadorSchema, type InviteAmbassadorInput } from "../schemas/invite-ambassador";

export type AdminProfile = { id: string; fullName: string | null; email: string; mobile: string | null; accountState: AccountState; invitedAt: string | null; lastLoginAt: string | null };
export type AmbassadorPage = { items: AdminProfile[]; nextCursor: string | null };
export type InviteAmbassadorResult = AdminProfile & { deliveryStatus: "accepted" };
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

function confirmationRedirect() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw new Error("NEXT_PUBLIC_APP_URL is required");
  const url = new URL(configured);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1"))) throw new Error("Invitation redirect origin is not allow-listed");
  return new URL("/auth/confirm?next=/", url.origin).toString();
}

export async function inviteAmbassador(input: InviteAmbassadorInput): Promise<InviteAmbassadorResult> {
  const actor = await requireAdmin();
  const parsed = inviteAmbassadorSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION_FAILED");
  const values = parsed.data;
  const db = getDatabase();
  try {
    const [duplicate] = await db.execute<{ exists: boolean }>(sql`select exists (
      select 1 from public.profiles where lower(email) = ${values.email}
      union all
      select 1 from auth.users where lower(email) = ${values.email}
    ) as exists`);
    if (duplicate?.exists) throw new DomainError("CONFLICT");
  } catch (error) {
    if (error instanceof DomainError) throw error;
    logError("ambassador.invite_identity_lookup_failed", error, { operation: "identityExists" });
    throw new DomainError("INTERNAL_ERROR");
  }

  let redirectTo: string;
  try { redirectTo = confirmationRedirect(); }
  catch (error) {
    logError("ambassador.invite_redirect_misconfigured", error, { operation: "confirmationRedirect" });
    throw new DomainError("INTERNAL_ERROR");
  }

  const admin = createAdminSupabaseClient().auth.admin;
  let invitedId: string;
  try {
    const invitation = await admin.inviteUserByEmail(values.email, { redirectTo });
    // 422 alone is not proof of a duplicate: signup_disabled and email_address_invalid share it.
    if (invitation.error?.code === "email_exists") throw new DomainError("CONFLICT");
    if (invitation.error || !invitation.data.user?.id) {
      logError("ambassador.invite_provider_failed", new Error("Provider rejected invitation"), { operation: "inviteUserByEmail", status: invitation.error?.status ?? null, code: invitation.error?.code ?? null });
      throw new DomainError("INTERNAL_ERROR");
    }
    invitedId = invitation.data.user.id;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    logError("ambassador.invite_provider_failed", error, { operation: "inviteUserByEmail" });
    throw new DomainError("INTERNAL_ERROR");
  }

  const invitedAt = new Date();
  try {
    const [created] = await db.transaction(async (tx) => {
      const inserted = await tx.insert(profiles).values({ id: invitedId, fullName: values.fullName, email: values.email, mobile: values.mobile, accountState: "invited", invitedAt }).returning();
      if (!inserted[0]) throw new Error("Profile insertion returned no row");
      await audit.emit(tx, { type: "account.invited", actor: { id: actor.actorId, nameSnapshot: actor.actorNameSnapshot }, entity: { id: invitedId, snapshot: { fullName: values.fullName, email: values.email, mobile: values.mobile, accountState: "invited", invitedAt: invitedAt.toISOString(), deliveryStatus: "accepted" } } });
      return inserted;
    });
    return { ...mapProfile(created), deliveryStatus: "accepted" };
  } catch (error) {
    try { const result = await admin.deleteUser(invitedId); if (result.error) logError("ambassador.invite_compensation_failed", result.error, { userId: invitedId }); }
    catch (compensationError) { logError("ambassador.invite_compensation_failed", compensationError, { userId: invitedId }); }
    logError("ambassador.invite_persistence_failed", error, { userId: invitedId });
    throw new DomainError("INTERNAL_ERROR");
  }
}
