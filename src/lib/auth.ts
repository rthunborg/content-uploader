import "server-only";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { profiles, type ProfileRow } from "@/db/schema";
import { getDatabase } from "@/db/client";
import { productionConsentStatusProvider, type ConsentStatusProvider } from "@/features/consent/dal/consent-status";
import { DomainError } from "@/lib/errors";
import { safeContinuation } from "@/lib/auth/continuation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AuthUser = { id: string; email?: string; app_metadata?: Record<string, unknown> };
export type UserActor = { actorId: string; actorNameSnapshot: string };
export type UserContext = UserActor & { userId: string; accountState: ProfileRow["accountState"]; role: "ambassador" };
export type AdminContext = UserActor & { userId: string; accountState: ProfileRow["accountState"]; role: "admin" };
export type SystemContext = { actorId: null; actorNameSnapshot: "system"; role: "system" };

type Dependencies = {
  getAuth: () => Promise<{ user: AuthUser | null; hadSession: boolean }>;
  getProfile: (id: string) => Promise<ProfileRow | null>;
  consent: ConsentStatusProvider;
};

async function defaultGetAuth() {
  const client = await createServerSupabaseClient();
  // Capture only evidence that the request arrived with a local session before
  // getUser network validation can clear an invalidated client session.
  const { data: sessionData } = await client.auth.getSession();
  const { data, error } = await client.auth.getUser();
  if (!error && data.user) return { user: data.user as AuthUser, hadSession: true };
  return { user: null, hadSession: Boolean(sessionData.session) };
}

async function defaultGetProfile(id: string) {
  const [profile] = await getDatabase().select().from(profiles).where(eq(profiles.id, id)).limit(1);
  return profile ?? null;
}

export function createAuthGuards(deps: Dependencies) {
  async function authenticated() {
    const { user, hadSession } = await deps.getAuth();
    if (!user) {
      throw new DomainError(
        hadSession ? "SESSION_REVOKED" : "AUTH_REQUIRED",
        hadSession ? "Sessionen har avslutats. Logga in igen." : "Logga in för att fortsätta.",
        { action: "login" },
      );
    }
    const profile = await deps.getProfile(user.id);
    if (!profile) throw new DomainError("FORBIDDEN", "Kontot saknar åtkomst.");
    return { user, profile };
  }

  function actor(user: AuthUser, profile: ProfileRow): UserActor {
    return { actorId: user.id, actorNameSnapshot: profile.email };
  }

  return {
    async requireUserPreConsent(): Promise<UserContext> {
      const { user, profile } = await authenticated();
      if (user.app_metadata?.admin === true) throw new DomainError("FORBIDDEN", "Ambassadörsåtkomst krävs.");
      if (!(["active", "invited", "inactive_declined"] as const).includes(profile.accountState as "active" | "invited" | "inactive_declined")) {
        throw new DomainError("ACCOUNT_INACTIVE", "Kontot är pausat.", { action: "paused" });
      }
      return { ...actor(user, profile), userId: user.id, accountState: profile.accountState, role: "ambassador" };
    },
    async requireUser(): Promise<UserContext> {
      const { user, profile } = await authenticated();
      if (user.app_metadata?.admin === true) throw new DomainError("FORBIDDEN", "Ambassadörsåtkomst krävs.");
      if (profile.accountState !== "active") {
        // Invited ambassadors can still reach consent to activate, so route them
        // there (preserving their continuation) rather than to the paused surface.
        if (profile.accountState === "invited") throw new DomainError("CONSENT_REQUIRED", "Godkänn de aktuella villkoren för att fortsätta.", { action: "consent" });
        throw new DomainError("ACCOUNT_INACTIVE", "Kontot är pausat.", { action: "paused" });
      }
      if (!(await deps.consent.hasCurrentConsent(user.id))) {
        throw new DomainError("CONSENT_REQUIRED", "Godkänn de aktuella villkoren för att fortsätta.", { action: "consent" });
      }
      return { ...actor(user, profile), userId: user.id, accountState: profile.accountState, role: "ambassador" };
    },
    async requireAdmin(): Promise<AdminContext> {
      const { user, profile } = await authenticated();
      if (user.app_metadata?.admin !== true) throw new DomainError("FORBIDDEN", "Administratörsåtkomst krävs.");
      if (profile.accountState !== "active") throw new DomainError("ACCOUNT_INACTIVE", "Kontot är pausat.", { action: "paused" });
      return { ...actor(user, profile), userId: user.id, accountState: profile.accountState, role: "admin" };
    },
  };
}

const guards = createAuthGuards({ getAuth: defaultGetAuth, getProfile: defaultGetProfile, consent: productionConsentStatusProvider });
export const requireUser = guards.requireUser;
export const requireAdmin = guards.requireAdmin;
export const requireUserPreConsent = guards.requireUserPreConsent;
export function systemContext(): SystemContext { return { actorId: null, actorNameSnapshot: "system", role: "system" }; }
export async function revokeUserSessionsById(userId: string) {
  await getDatabase().execute(sql`delete from auth.sessions where user_id = ${userId}::uuid`);
}

export async function requireUserOrRedirect(next = "/") {
  try { return await requireUser(); } catch (error) {
    if (error instanceof DomainError && error.code === "CONSENT_REQUIRED") redirect(`/auth/consent?next=${encodeURIComponent(safeContinuation(next))}`);
    if (error instanceof DomainError && (error.code === "AUTH_REQUIRED" || error.code === "SESSION_REVOKED")) redirect(`/auth/login?next=${encodeURIComponent(safeContinuation(next))}`);
    if (error instanceof DomainError && error.code === "ACCOUNT_INACTIVE") redirect("/auth/paused");
    throw error;
  }
}
