export const AUDIT_EVENT_TYPES = [
  "asset.uploaded",
  "asset.deleted",
  "asset.erased",
  "export.created",
  "asset.shared",
  "asset.used_confirmed",
  "auth.logged_in",
  "account.invited",
  "account.deactivated",
  "account.reactivated",
  "account.deleted",
  "consent.accepted",
  "consent.declined",
  "consent.withdrawn",
  "terms.version_created",
  "task.created",
  "task.completed",
  "message.sent",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
