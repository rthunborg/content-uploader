import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { RosterPageContent } from "./page";
describe("RosterPageContent", () => {
  it("distinguishes the global empty roster from a stale outer page", () => {
    const empty = renderToStaticMarkup(<RosterPageContent page={{ items: [], nextCursor: null }} />);
    const stale = renderToStaticMarkup(<RosterPageContent cursor="00000000-0000-4000-8000-000000000001" page={{ items: [], nextCursor: null }} />);
    expect(empty).toContain("Inga ambassadörer än"); expect(empty).not.toContain("inga ambassadörer kvar");
    expect(stale).toContain("inga ambassadörer kvar"); expect(stale).toContain("min-h-11"); expect(stale).toContain("focus-visible:outline-2");
  });
});
