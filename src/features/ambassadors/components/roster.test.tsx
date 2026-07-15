import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AmbassadorRoster } from "./roster";
const item = { id: "00000000-0000-4000-8000-000000000001", fullName: " ", email: "anna@example.test", mobile: "", accountState: "active" as const, invitedAt: null, lastLoginAt: null };
describe("AmbassadorRoster", () => {
  it("renders defensive missing values, localized state, semantic desktop and phone surfaces", () => { const html = renderToStaticMarkup(<AmbassadorRoster page={{ items: [item], nextCursor: null }} />); expect(html).toContain("<table"); expect(html).toContain("<ul"); expect(html).toContain("Namn saknas"); expect(html).toContain("Saknas"); expect(html).toContain("Aldrig"); expect(html).toContain("Aktiv"); expect(html).not.toContain("overflow-x-auto"); });
  it("renders the explanatory empty state", () => { expect(renderToStaticMarkup(<AmbassadorRoster page={{ items: [], nextCursor: null }} />)).toContain("Inga ambassadörer än"); });
  it("wires the next cursor", () => { expect(renderToStaticMarkup(<AmbassadorRoster page={{ items: [item], nextCursor: item.id }} />)).toContain(`cursor=${item.id}`); });
});
