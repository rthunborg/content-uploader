import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AmbientStatus } from "./ambient-status";

describe("AmbientStatus", () => {
  it("provides icon and text without a spinner", () => {
    const html = renderToStaticMarkup(<AmbientStatus tone="celebration">Klart – filen är sparad</AmbientStatus>);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Klart – filen är sparad");
    expect(html).not.toContain("spinner");
  });
});
