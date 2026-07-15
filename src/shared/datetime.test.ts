import { describe, expect, it } from "vitest";

import { formatStockholmDate, formatStockholmDateTime, stockholmCalendarDaysAgo } from "./datetime";

describe("Stockholm datetime helpers", () => {
  it("formats dates deterministically with Swedish conventions", () => {
    const instant = "2026-01-15T12:34:00.000Z";

    expect(formatStockholmDate(instant)).toBe("2026-01-15");
    expect(formatStockholmDateTime(instant)).toBe("2026-01-15 13:34");
  });

  it("observes Stockholm daylight saving time", () => {
    expect(formatStockholmDateTime("2026-07-15T12:34:00.000Z")).toBe(
      "2026-07-15 14:34",
    );
  });

  it("uses Stockholm calendar boundaries rather than elapsed 24-hour periods", () => {
    expect(stockholmCalendarDaysAgo("2026-07-14T21:59:00Z", "2026-07-14T22:01:00Z")).toBe(1);
  });

  it("remains calendar-correct across both DST transitions", () => {
    expect(stockholmCalendarDaysAgo("2026-03-28T12:00:00Z", "2026-03-29T11:00:00Z")).toBe(1);
    expect(stockholmCalendarDaysAgo("2026-10-24T11:00:00Z", "2026-10-25T12:00:00Z")).toBe(1);
  });
});
