import { describe, expect, it } from "vitest";

import { formatStockholmDate, formatStockholmDateTime } from "./datetime";

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
});
