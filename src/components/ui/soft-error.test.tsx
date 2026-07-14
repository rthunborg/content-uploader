import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { SoftError } from "./soft-error";

describe("SoftError", () => {
  it("communicates what happened, why, and a remedy in Swedish", () => {
    const html = renderToStaticMarkup(<SoftError what="Uppladdningen pausades" why="Anslutningen bröts." remedy={<Button variant="secondary">Försök igen</Button>} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Uppladdningen pausades");
    expect(html).toContain("Anslutningen bröts.");
    expect(html).toContain("Försök igen");
    expect(html).toContain("bg-caution-bg");
    expect(html).toContain('aria-hidden="true"');
  });
});
