import "server-only";

export const PRE_CONSENT_OPERATIONS = [
  "getCurrentTerms",
  "acceptTerms",
  "declineTerms",
  "withdrawConsent",
  "getOwnAccountState",
] as const;

export type PreConsentOperation = (typeof PRE_CONSENT_OPERATIONS)[number];

function preConsentContext(operation: PreConsentOperation) {
  if (!PRE_CONSENT_OPERATIONS.includes(operation)) throw new Error("Forbidden pre-consent operation");
  return import("@/lib/auth").then(({ requireUserPreConsent }) => requireUserPreConsent());
}

export async function getOwnAccountState() {
  const context = await preConsentContext("getOwnAccountState");
  return context.accountState;
}

export async function getCurrentTerms() { await preConsentContext("getCurrentTerms"); const { readCurrentTerms } = await import("./terms"); return readCurrentTerms(); }
export async function acceptTerms() { const context = await preConsentContext("acceptTerms"); const { profiles } = await import("@/db/schema"); const { getDatabase } = await import("@/db/client"); const { eq } = await import("drizzle-orm"); const [profile] = await getDatabase().select({ email: profiles.email, fullName: profiles.fullName }).from(profiles).where(eq(profiles.id, context.userId)).limit(1); if (!profile?.fullName) throw new Error("Complete identity is required"); const { appendAcceptance } = await import("./acceptance"); return appendAcceptance(context.userId, { email: profile.email, fullName: profile.fullName }); }
