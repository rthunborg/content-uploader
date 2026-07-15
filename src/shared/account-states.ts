export const ACCOUNT_STATES = ["invited", "active", "inactive_declined", "inactive_withdrawn", "deactivated"] as const;
export type AccountState = (typeof ACCOUNT_STATES)[number];
