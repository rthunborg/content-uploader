import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ requirePre: vi.fn(), accept: vi.fn(), decline: vi.fn(), read: vi.fn(), parse: vi.fn(), hash: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUserPreConsent: mocks.requirePre }));
vi.mock("./acceptance", () => ({ acceptCurrentTermsAndActivate: mocks.accept, declineCurrentTerms: mocks.decline }));
vi.mock("./terms", () => ({ readCurrentTerms: mocks.read, termsManifestSchema: { safeParse: mocks.parse } }));
vi.mock("../crypto", () => ({ termsPayloadSha256: mocks.hash }));
import { acceptTerms, declineTerms, getCurrentTerms } from "./pre-consent";

beforeEach(() => { mocks.requirePre.mockReset().mockResolvedValue({ userId: "00000000-0000-4000-8000-000000000001", accountState: "invited" }); mocks.accept.mockReset().mockResolvedValue({ id: "record" }); mocks.decline.mockReset().mockResolvedValue({ alreadyDeclined: false }); mocks.read.mockReset().mockResolvedValue({ id: "terms", payload: { cards: [] }, payloadSha256: "trusted" }); mocks.parse.mockReset().mockReturnValue({ success: true, data: { cards: [1, 2, 3] } }); mocks.hash.mockReset().mockReturnValue("trusted"); });
describe("pre-consent DAL", () => {
  it("reads and validates current terms only after requireUserPreConsent", async () => { await expect(getCurrentTerms()).resolves.toEqual({ id: "terms", payload: { cards: [1, 2, 3] }, payloadSha256: "trusted" }); expect(mocks.requirePre).toHaveBeenCalledOnce(); expect(mocks.read).toHaveBeenCalledOnce(); });
  it("fails closed for an incomplete published payload", async () => { mocks.parse.mockReturnValue({ success: false }); await expect(getCurrentTerms()).resolves.toBeNull(); });
  it("fails closed when the published payload does not match its evidence hash", async () => { mocks.hash.mockReturnValue("different"); await expect(getCurrentTerms()).resolves.toBeNull(); });
  it("delegates atomic acceptance for the authenticated user", async () => { await acceptTerms(); expect(mocks.requirePre).toHaveBeenCalledOnce(); expect(mocks.accept).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001"); });
  it("delegates atomic decline for the authenticated user", async () => { await declineTerms(); expect(mocks.requirePre).toHaveBeenCalledOnce(); expect(mocks.decline).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001"); });
});
