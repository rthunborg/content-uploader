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
