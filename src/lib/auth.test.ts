import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createAuthGuards } from "./auth";

const profile = { id: "user-1", email: "user@example.com", mobile: null, accountState: "active" as const, invitedAt: null, firstAcceptedAt: null, firstUploadAt: null, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date() };
function guards(user: { id: string; app_metadata?: Record<string, unknown> } | null, options: { session?: boolean; consent?: boolean; state?: string } = {}) {
  return createAuthGuards({ getAuth: vi.fn().mockResolvedValue({ user, hadSession: options.session ?? false }), getProfile: vi.fn().mockResolvedValue(user ? { ...profile, accountState: options.state ?? "active" } : null), consent: { hasCurrentConsent: vi.fn().mockResolvedValue(options.consent ?? true) } });
}

describe("auth context matrix", () => {
  it("distinguishes absent and revoked sessions after getUser failure", async () => {
    await expect(guards(null).requireUser()).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(guards(null, { session: true }).requireUser()).rejects.toMatchObject({ code: "SESSION_REVOKED" });
  });
  it("fails closed for stale consent while permitting the pre-consent context", async () => {
    await expect(guards({ id: "user-1" }, { consent: false }).requireUser()).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    await expect(guards({ id: "user-1" }, { consent: false }).requireUserPreConsent()).resolves.toMatchObject({ role: "ambassador" });
  });
  it("resolves the ambassador context when the injected provider reports current consent", async () => {
    await expect(guards({ id: "user-1" }, { consent: true }).requireUser()).resolves.toEqual({
      role: "ambassador",
      userId: "user-1",
      actorId: "user-1",
      actorNameSnapshot: "user@example.com",
      accountState: "active",
    });
  });
  it("derives admin authority only from app metadata and skips consent", async () => {
    await expect(guards({ id: "user-1" }).requireAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(guards({ id: "user-1", app_metadata: { admin: true } }, { consent: false }).requireAdmin()).resolves.toMatchObject({ role: "admin" });
  });
  it("forbids an admin from acting through the ambassador context", async () => {
    await expect(guards({ id: "user-1", app_metadata: { admin: true } }).requireUser()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("blocks inactive accounts", async () => {
    await expect(guards({ id: "user-1", app_metadata: { admin: true } }, { state: "deactivated" }).requireAdmin()).rejects.toMatchObject({ code: "ACCOUNT_INACTIVE" });
  });
});
