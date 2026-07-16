import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requirePre: vi.fn(), append: vi.fn(), read: vi.fn(), profile: { email: "person@example.test", fullName: "Person Name" as string | null } }));
vi.mock("@/lib/auth", () => ({ requireUserPreConsent: mocks.requirePre }));
vi.mock("./acceptance", () => ({ appendAcceptance: mocks.append }));
vi.mock("./terms", () => ({ readCurrentTerms: mocks.read }));
vi.mock("@/db/client", () => ({ getDatabase: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ ...mocks.profile }] }) }) }) }) }));
import { acceptTerms, getCurrentTerms } from "./pre-consent";

beforeEach(() => { mocks.requirePre.mockReset().mockResolvedValue({ userId: "00000000-0000-4000-8000-000000000001", accountState: "invited" }); mocks.append.mockReset().mockResolvedValue({ id: "record" }); mocks.read.mockReset().mockResolvedValue({ id: "terms" }); mocks.profile.email = "person@example.test"; mocks.profile.fullName = "Person Name"; });
describe("pre-consent DAL", () => {
  it("reads current terms only after requireUserPreConsent", async () => { await expect(getCurrentTerms()).resolves.toEqual({ id: "terms" }); expect(mocks.requirePre).toHaveBeenCalledOnce(); expect(mocks.read).toHaveBeenCalledOnce(); });
  it("passes the authenticated user's authoritative profile identity", async () => { await acceptTerms(); expect(mocks.requirePre).toHaveBeenCalledOnce(); expect(mocks.append).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", { email: "person@example.test", fullName: "Person Name" }); });
  it("rejects incomplete identity without appending", async () => { mocks.profile.fullName = null; await expect(acceptTerms()).rejects.toThrow("Complete identity"); expect(mocks.append).not.toHaveBeenCalled(); });
});
