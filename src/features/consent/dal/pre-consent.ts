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

export async function getCurrentTerms() { await preConsentContext("getCurrentTerms"); const { termsPayloadSha256 } = await import("../crypto"); const { readCurrentTerms, termsManifestSchema } = await import("./terms"); const terms = await readCurrentTerms(); if (!terms) return null; const parsed = termsManifestSchema.safeParse(terms.payload); return parsed.success && termsPayloadSha256(parsed.data) === terms.payloadSha256 ? { ...terms, payload: parsed.data } : null; }
export async function acceptTerms() { const context = await preConsentContext("acceptTerms"); const { acceptCurrentTermsAndActivate } = await import("./acceptance"); return acceptCurrentTermsAndActivate(context.userId); }
export async function declineTerms() { const context = await preConsentContext("declineTerms"); const { declineCurrentTerms } = await import("./acceptance"); return declineCurrentTerms(context.userId); }
