import "server-only";

import { and, asc, eq, gt, sql } from "drizzle-orm";
import { getDatabase } from "@/db/client";
import { profiles, type ProfileRow } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { revokeAllUserSessions } from "@/lib/auth/revocation";
import { DomainError } from "@/lib/errors";
import type { AccountState } from "@/shared/account-states";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { audit } from "@/shared/audit";
import { logCritical, logError } from "@/shared/logger";
import { accountLifecycleSchema, type AccountLifecycleInput } from "../schemas/account-lifecycle";
import { inviteAmbassadorSchema, type InviteAmbassadorInput } from "../schemas/invite-ambassador";
import { updateAmbassadorSchema, type UpdateAmbassadorInput } from "../schemas/update-ambassador";

export type AdminProfile = { id: string; fullName: string | null; email: string; mobile: string | null; accountState: AccountState; invitedAt: string | null; lastLoginAt: string | null };
export type AmbassadorPage = { items: AdminProfile[]; nextCursor: string | null };
export type InviteAmbassadorResult = AdminProfile & { deliveryStatus: "accepted" };
export type DeleteAccountResult = { id: string; deleted: true };
export const AMBASSADOR_PAGE_SIZE = 25;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ambassadorIdentity = sql<boolean>`exists (select 1 from auth.users where auth.users.id = ${profiles.id} and (auth.users.raw_app_meta_data -> 'admin') is distinct from 'true'::jsonb)`;
const AUTH_DUPLICATE_CODES = new Set(["email_exists", "user_already_exists", "identity_already_exists"]);

function mapProfile(row: typeof profiles.$inferSelect): AdminProfile {
  return { id: row.id, fullName: row.fullName, email: row.email, mobile: row.mobile, accountState: row.accountState, invitedAt: row.invitedAt?.toISOString() ?? null, lastLoginAt: row.lastLoginAt?.toISOString() ?? null };
}

function lifecycleSnapshot(row: ProfileRow, nextState: AccountState, updatedAt: Date) {
  return {
    fullName: row.fullName,
    email: row.email,
    mobile: row.mobile,
    beforeAccountState: row.accountState,
    afterAccountState: nextState,
    updatedAt: updatedAt.toISOString(),
  };
}

function snapshotTimestamp(value: Date | string | null) {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function deletionSnapshot(row: ProfileRow) {
  return {
    fullName: row.fullName,
    email: row.email,
    mobile: row.mobile,
    accountState: row.accountState,
    invitedAt: snapshotTimestamp(row.invitedAt),
    lastLoginAt: snapshotTimestamp(row.lastLoginAt),
  };
}

function authErrorContext(error: unknown) {
  if (!error || typeof error !== "object") return { status: null, code: null };
  return {
    status: "status" in error && typeof error.status === "number" ? error.status : null,
    code: "code" in error && typeof error.code === "string" ? error.code : null,
  };
}

function normalizedAuthEmail(email: string | undefined | null) {
  return email?.trim().toLowerCase() ?? null;
}

async function compensateAmbassadorAuthEmail({
  admin,
  attemptedEmail,
  priorAuthEmail,
  priorProfileEmail,
  profileId,
}: {
  admin: ReturnType<typeof createAdminSupabaseClient>["auth"]["admin"];
  attemptedEmail: string;
  priorAuthEmail: string;
  priorProfileEmail: string;
  profileId: string;
}) {
  const reconciliationContext = {
    profileId,
    operation: "restoreAuthEmail",
  };
  const reconciliationRequired = (
    error: unknown,
    context: Record<string, unknown> = {},
  ) => {
    logCritical("ambassador.contact_reconciliation_required", error, {
      ...reconciliationContext,
      ...context,
    });
  };

  try {
    await getDatabase().transaction(async (tx) => {
      const [lockedProfile] = await tx.execute<{ id: string; email: string }>(sql`
        select p.id, p.email
        from public.profiles p
        where p.id = ${profileId}
        for update of p
      `);
      if (!lockedProfile) {
        reconciliationRequired(new Error("Profile missing during Auth email reconciliation"), {
          reason: "profile_missing",
        });
        return;
      }

      let authUserResponse;
      try {
        authUserResponse = await admin.getUserById(profileId);
      } catch (error) {
        reconciliationRequired(error, {
          reason: "auth_lookup_threw",
          ...authErrorContext(error),
        });
        return;
      }
      if (authUserResponse.error) {
        reconciliationRequired(new Error("Auth lookup failed during email reconciliation"), {
          reason: "auth_lookup_failed",
          ...authErrorContext(authUserResponse.error),
        });
        return;
      }

      const currentAuthUser = authUserResponse.data.user;
      const currentAuthEmail = normalizedAuthEmail(currentAuthUser?.email);
      if (
        !currentAuthUser
        || currentAuthUser.id !== profileId
        || !currentAuthEmail
      ) {
        reconciliationRequired(new Error("Auth identity was unsafe during email reconciliation"), {
          reason: currentAuthUser?.id && currentAuthUser.id !== profileId
            ? "auth_user_mismatch"
            : "auth_identity_missing",
        });
        return;
      }

      if (currentAuthEmail === priorAuthEmail) return;

      const currentProfileEmail = normalizedAuthEmail(lockedProfile.email);
      if (currentProfileEmail !== priorProfileEmail) {
        if (currentProfileEmail === currentAuthEmail) return;
        reconciliationRequired(new Error("A newer profile edit has divergent Auth state"), {
          reason: "newer_profile_auth_mismatch",
        });
        return;
      }
      if (currentAuthEmail !== attemptedEmail) {
        reconciliationRequired(new Error("Auth email changed to an unexpected value"), {
          reason: "unexpected_auth_email",
        });
        return;
      }

      let restored;
      try {
        restored = await admin.updateUserById(profileId, { email: priorAuthEmail });
      } catch (error) {
        reconciliationRequired(error, {
          reason: "restore_threw",
          ...authErrorContext(error),
        });
        return;
      }
      const restoredUser = restored.data.user;
      if (
        restored.error
        || !restoredUser
        || restoredUser.id !== profileId
        || normalizedAuthEmail(restoredUser.email) !== priorAuthEmail
      ) {
        reconciliationRequired(
          restored.error ?? new Error("Auth email restoration was not acknowledged"),
          {
            reason: "restore_failed",
            ...authErrorContext(restored.error),
          },
        );
      }
    });
  } catch (error) {
    reconciliationRequired(error, {
      reason: "profile_lock_failed",
      ...authErrorContext(error),
    });
  }
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

export async function updateAmbassadorContact(profileId: string, input: UpdateAmbassadorInput): Promise<AdminProfile> {
  await requireAdmin();
  if (!UUID_V4_PATTERN.test(profileId)) throw new DomainError("NOT_FOUND");
  const parsed = updateAmbassadorSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION_FAILED");

  const values = parsed.data;
  const admin = createAdminSupabaseClient().auth.admin;
  let priorAuthEmail: string | null = null;
  let priorProfileEmail: string | null = null;
  let forwardAuthUpdateAttempted = false;

  try {
    const updated = await getDatabase().transaction(async (tx) => {
      const [target] = await tx.execute<{ id: string; email: string }>(sql`
        select p.id, p.email
        from public.profiles p
        where p.id = ${profileId}
          and exists (
            select 1
            from auth.users u
            where u.id = p.id
              and (u.raw_app_meta_data -> 'admin') is distinct from 'true'::jsonb
          )
        for update of p
      `);
      if (!target) throw new DomainError("NOT_FOUND");
      priorProfileEmail = normalizedAuthEmail(target.email);
      if (!priorProfileEmail) {
        logError("ambassador.contact_persistence_failed", new Error("Profile has no email"), {
          profileId,
        });
        throw new DomainError("INTERNAL_ERROR");
      }

      let authUserResponse;
      try {
        authUserResponse = await admin.getUserById(profileId);
      } catch (error) {
        logError("ambassador.contact_auth_lookup_failed", error, {
          profileId,
          operation: "getUserById",
          ...authErrorContext(error),
        });
        throw new DomainError("INTERNAL_ERROR");
      }
      if (authUserResponse.error) {
        const context = authErrorContext(authUserResponse.error);
        if (context.status === 404 || context.code === "user_not_found") throw new DomainError("NOT_FOUND");
        logError("ambassador.contact_auth_lookup_failed", new Error("Auth user lookup failed"), {
          profileId,
          operation: "getUserById",
          ...context,
        });
        throw new DomainError("INTERNAL_ERROR");
      }
      const authUser = authUserResponse.data.user;
      priorAuthEmail = normalizedAuthEmail(authUser?.email);
      if (!authUser || authUser.id !== profileId || !priorAuthEmail) {
        logError("ambassador.contact_auth_lookup_failed", new Error("Auth user identity did not match the profile"), {
          profileId,
          operation: "getUserById",
          status: null,
          code: null,
          reason: authUser?.id && authUser.id !== profileId
            ? "auth_user_mismatch"
            : "auth_identity_missing",
        });
        throw new DomainError("INTERNAL_ERROR");
      }

      let duplicate;
      try {
        [duplicate] = await tx.execute<{ exists: boolean }>(sql`
          select exists (
            select 1
            from public.profiles
            where id <> ${profileId} and lower(email) = ${values.email}
            union all
            select 1
            from auth.users
            where id <> ${profileId} and lower(email) = ${values.email}
          ) as exists
        `);
      } catch (error) {
        logError("ambassador.contact_identity_lookup_failed", error, {
          profileId,
          operation: "identityExists",
        });
        throw new DomainError("INTERNAL_ERROR");
      }
      if (duplicate?.exists) throw new DomainError("CONFLICT");

      if (priorAuthEmail !== values.email) {
        forwardAuthUpdateAttempted = true;
        let authUpdate;
        try {
          authUpdate = await admin.updateUserById(profileId, { email: values.email });
        } catch (error) {
          logError("ambassador.contact_auth_update_failed", error, {
            profileId,
            operation: "updateUserById",
            ...authErrorContext(error),
          });
          throw new DomainError("INTERNAL_ERROR");
        }
        if (authUpdate.error) {
          const context = authErrorContext(authUpdate.error);
          if (context.code && AUTH_DUPLICATE_CODES.has(context.code)) throw new DomainError("CONFLICT");
          logError("ambassador.contact_auth_update_failed", new Error("Auth email update failed"), {
            profileId,
            operation: "updateUserById",
            ...context,
          });
          throw new DomainError("INTERNAL_ERROR");
        }
        if (
          !authUpdate.data.user
          || authUpdate.data.user.id !== profileId
          || normalizedAuthEmail(authUpdate.data.user.email) !== values.email
        ) {
          logError("ambassador.contact_auth_update_failed", new Error("Auth email update was not acknowledged"), {
            profileId,
            operation: "updateUserById",
            status: null,
            code: null,
          });
          throw new DomainError("INTERNAL_ERROR");
        }
      }

      const [row] = await tx.update(profiles).set({
        fullName: values.fullName,
        email: values.email,
        mobile: values.mobile,
        updatedAt: new Date(),
      }).where(and(eq(profiles.id, profileId), ambassadorIdentity)).returning();
      if (!row) throw new DomainError("NOT_FOUND");
      return row;
    });

    forwardAuthUpdateAttempted = false;
    return mapProfile(updated);
  } catch (error) {
    if (
      forwardAuthUpdateAttempted
      && priorAuthEmail
      && priorProfileEmail
    ) {
      await compensateAmbassadorAuthEmail({
        admin,
        attemptedEmail: values.email,
        priorAuthEmail,
        priorProfileEmail,
        profileId,
      });
    }
    if (!(error instanceof DomainError)) {
      logError("ambassador.contact_persistence_failed", error, { profileId });
      throw new DomainError("INTERNAL_ERROR");
    }
    throw error;
  }
}

async function authUserNoLongerExists(
  admin: ReturnType<typeof createAdminSupabaseClient>["auth"]["admin"],
  profileId: string,
) {
  try {
    const lookup = await admin.getUserById(profileId);
    const context = authErrorContext(lookup.error);
    return context.status === 404 || context.code === "user_not_found";
  } catch {
    return false;
  }
}

export async function updateAmbassadorLifecycle(profileId: string, input: AccountLifecycleInput): Promise<AdminProfile> {
  const actor = await requireAdmin();
  if (!UUID_V4_PATTERN.test(profileId)) throw new DomainError("NOT_FOUND");
  const parsed = accountLifecycleSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION_FAILED");

  const { action } = parsed.data;
  let revocationAttempted = false;
  let revocationSucceeded = false;
  try {
    const updated = await getDatabase().transaction(async (tx) => {
      const [target] = await tx.execute<ProfileRow>(sql`
        select
          p.id,
          p.full_name as "fullName",
          p.email,
          p.mobile,
          p.account_state as "accountState",
          p.invited_at as "invitedAt",
          p.first_accepted_at as "firstAcceptedAt",
          p.first_upload_at as "firstUploadAt",
          p.last_login_at as "lastLoginAt",
          p.created_at as "createdAt",
          p.updated_at as "updatedAt"
        from public.profiles p
        where p.id = ${profileId}
          and exists (
            select 1
            from auth.users u
            where u.id = p.id
              and (u.raw_app_meta_data -> 'admin') is distinct from 'true'::jsonb
          )
        for update of p
      `);
      if (!target) throw new DomainError("NOT_FOUND");

      if (action === "deactivate") {
        if (target.accountState === "deactivated") return target;
        if (target.accountState !== "active" && target.accountState !== "invited") throw new DomainError("CONFLICT");
        revocationAttempted = true;
        try {
          await revokeAllUserSessions(profileId);
          revocationSucceeded = true;
        } catch (error) {
          logError("ambassador.lifecycle_revocation_failed", error, {
            profileId,
            operation: "revokeAllUserSessions",
          });
          throw new DomainError("INTERNAL_ERROR");
        }
        const updatedAt = new Date();
        const [row] = await tx.update(profiles).set({
          accountState: "deactivated",
          updatedAt,
        }).where(and(eq(profiles.id, profileId), ambassadorIdentity)).returning();
        if (!row) throw new DomainError("NOT_FOUND");
        await audit.emit(tx, {
          type: "account.deactivated",
          actor: { id: actor.actorId, nameSnapshot: actor.actorNameSnapshot },
          entity: {
            id: profileId,
            snapshot: lifecycleSnapshot(target, "deactivated", updatedAt),
          },
        });
        return row;
      }

      if (target.accountState === "active") return target;
      if (target.accountState !== "deactivated") throw new DomainError("CONFLICT");
      const updatedAt = new Date();
      const [row] = await tx.update(profiles).set({
        accountState: "active",
        updatedAt,
      }).where(and(eq(profiles.id, profileId), ambassadorIdentity)).returning();
      if (!row) throw new DomainError("NOT_FOUND");
      await audit.emit(tx, {
        type: "account.reactivated",
        actor: { id: actor.actorId, nameSnapshot: actor.actorNameSnapshot },
        entity: {
          id: profileId,
          snapshot: lifecycleSnapshot(target, "active", updatedAt),
        },
      });
      return row;
    });

    return mapProfile(updated);
  } catch (error) {
    if (error instanceof DomainError) {
      if (revocationSucceeded && error.code !== "INTERNAL_ERROR") {
        logError("ambassador.lifecycle_persistence_failed", error, {
          profileId,
          action,
          revocationAttempted,
          revocationSucceeded,
        });
        throw new DomainError("INTERNAL_ERROR");
      }
      throw error;
    }
    logError("ambassador.lifecycle_persistence_failed", error, {
      profileId,
      action,
      revocationAttempted,
      revocationSucceeded,
    });
    throw new DomainError("INTERNAL_ERROR");
  }
}

export async function deleteAccount(profileId: string): Promise<DeleteAccountResult> {
  const actor = await requireAdmin();
  if (!UUID_V4_PATTERN.test(profileId)) throw new DomainError("NOT_FOUND");

  const admin = createAdminSupabaseClient().auth.admin;
  let authDeleted = false;
  try {
    return await getDatabase().transaction(async (tx) => {
      const [target] = await tx.execute<ProfileRow>(sql`
        select
          p.id,
          p.full_name as "fullName",
          p.email,
          p.mobile,
          p.account_state as "accountState",
          p.invited_at as "invitedAt",
          p.first_accepted_at as "firstAcceptedAt",
          p.first_upload_at as "firstUploadAt",
          p.last_login_at as "lastLoginAt",
          p.created_at as "createdAt",
          p.updated_at as "updatedAt"
        from public.profiles p
        where p.id = ${profileId}
          and exists (
            select 1
            from auth.users u
            where u.id = p.id
              and (u.raw_app_meta_data -> 'admin') is distinct from 'true'::jsonb
          )
        for update of p
      `);
      if (!target) throw new DomainError("NOT_FOUND");

      try {
        await revokeAllUserSessions(profileId);
      } catch (error) {
        logError("ambassador.deletion_revocation_failed", error, {
          profileId,
          operation: "revokeAllUserSessions",
        });
        throw new DomainError("INTERNAL_ERROR");
      }

      let deletion;
      try {
        deletion = await admin.deleteUser(profileId);
      } catch (error) {
        if (await authUserNoLongerExists(admin, profileId)) {
          authDeleted = true;
          throw error;
        }
        logError("ambassador.deletion_provider_failed", error, {
          profileId,
          operation: "deleteUser",
          ...authErrorContext(error),
        });
        throw new DomainError("INTERNAL_ERROR");
      }
      if (deletion.error) {
        if (await authUserNoLongerExists(admin, profileId)) {
          authDeleted = true;
          throw deletion.error;
        }
        logError("ambassador.deletion_provider_failed", new Error("Auth user deletion failed"), {
          profileId,
          operation: "deleteUser",
          ...authErrorContext(deletion.error),
        });
        throw new DomainError("INTERNAL_ERROR");
      }
      authDeleted = true;

      const [deleted] = await tx.delete(profiles)
        .where(eq(profiles.id, profileId))
        .returning({ id: profiles.id });
      if (!deleted) throw new Error("Profile deletion returned no row");

      await audit.emit(tx, {
        type: "account.deleted",
        actor: { id: actor.actorId, nameSnapshot: actor.actorNameSnapshot },
        entity: { id: profileId, snapshot: deletionSnapshot(target) },
      });
      return { id: profileId, deleted: true };
    });
  } catch (error) {
    if (authDeleted) {
      logCritical("ambassador.deletion_reconciliation_required", error, {
        profileId,
        operation: "deleteAccount",
        authDeleted: true,
        profileDeletionCommitted: false,
        auditCommitted: false,
      });
      throw new DomainError("INTERNAL_ERROR");
    }
    if (error instanceof DomainError) throw error;
    logError("ambassador.deletion_persistence_failed", error, { profileId });
    throw new DomainError("INTERNAL_ERROR");
  }
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
