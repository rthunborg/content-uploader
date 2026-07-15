import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityTime } from "./activity-time";

describe("ActivityTime", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");
  it.each([
    ["2026-07-15T10:00:00.000Z", "I dag", "2026-07-15 12:00"],
    ["2026-07-14T10:00:00.000Z", "I går", "2026-07-14 12:00"],
    ["2026-07-10T10:00:00.000Z", "5 dagar sedan", "2026-07-10 12:00"],
    ["2026-07-16T10:00:00.000Z", "Framtida tid", "2026-07-16 12:00"],
  ])("renders relative and exact values for %s", (value, relative, exact) => {
    const html = renderToStaticMarkup(<ActivityTime value={value} now={now} />);
    expect(html).toContain(relative); expect(html).toContain(exact);
    expect(html).toContain(`<time class="text-sm" dateTime="${value}">`);
  });
});
