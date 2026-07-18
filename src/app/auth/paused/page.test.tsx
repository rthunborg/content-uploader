import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getState: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/consent/dal/pre-consent", () => ({ getOwnAccountState: mocks.getState }));

import PausedPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((destination: string) => { throw new Error(`REDIRECT:${destination}`); });
});

describe("paused account page", () => {
  it("offers a safe self-service return only to declined ambassadors", async () => {
    mocks.getState.mockResolvedValue("inactive_declined");
    const markup = renderToStaticMarkup(await PausedPage({ searchParams: Promise.resolve({ next: "/upload" }) }));
    expect(markup).toContain("Inget har raderats");
    expect(markup).toContain("komma tillbaka när som helst");
    expect(markup).toContain('href="/auth/consent?next=%2Fupload"');
  });

  it("keeps deactivated ambassadors on the terminal help state", async () => {
    mocks.getState.mockResolvedValue("deactivated");
    const markup = renderToStaticMarkup(await PausedPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain("Kontakta en administratör");
    expect(markup).not.toContain("Gå tillbaka till villkoren");
  });

  it("sanitizes the declined return destination", async () => {
    mocks.getState.mockResolvedValue("inactive_declined");
    const markup = renderToStaticMarkup(await PausedPage({ searchParams: Promise.resolve({ next: "https://evil.example" }) }));
    expect(markup).toContain('href="/auth/consent?next=%2Ftasks"');
  });
});
