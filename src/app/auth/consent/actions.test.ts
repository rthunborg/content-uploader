import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ accept: vi.fn(), decline: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/consent/dal/pre-consent", () => ({ acceptTerms: mocks.accept, declineTerms: mocks.decline }));

import { acceptConsent, declineConsent } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.decline.mockResolvedValue({ alreadyDeclined: false });
  mocks.accept.mockResolvedValue({ alreadyAccepted: false });
  mocks.redirect.mockImplementation((destination: string) => { throw new Error(`REDIRECT:${destination}`); });
});

describe("declineConsent", () => {
  it("commits before redirecting to the reversible pause state", async () => {
    const data = new FormData();
    data.set("next", "/upload");
    await expect(declineConsent({ error: null }, data)).rejects.toThrow("REDIRECT:/auth/paused?next=%2Fupload");
    expect(mocks.decline).toHaveBeenCalledOnce();
  });

  it("drops an unsafe continuation", async () => {
    const data = new FormData();
    data.set("next", "//evil.example/steal");
    await expect(declineConsent({ error: null }, data)).rejects.toThrow("REDIRECT:/auth/paused?next=%2F");
  });
});

describe("acceptConsent", () => {
  it("waits for authoritative acceptance before resuming a safe deep continuation", async () => {
    const data = new FormData(); data.set("next", "/tasks/open?theme=deck");
    await expect(acceptConsent({ error: null }, data)).rejects.toThrow("REDIRECT:/tasks/open?theme=deck");
    expect(mocks.accept).toHaveBeenCalledOnce();
  });

  it("falls back to tasks after an unsafe continuation", async () => {
    const data = new FormData(); data.set("next", "https://evil.example/steal");
    await expect(acceptConsent({ error: null }, data)).rejects.toThrow("REDIRECT:/tasks");
  });
});
