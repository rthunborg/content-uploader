import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminShell } from "./admin-shell";

describe("AdminShell", () => {
  it("exposes the capped 12-column desktop layout and 256 px rail", () => {
    const html = renderToStaticMarkup(<AdminShell rail={<nav>Filter</nav>}>Innehåll</AdminShell>);
    expect(html).toContain("max-w-[1440px]");
    expect(html).toContain("md:grid-cols-[256px_minmax(0,1fr)]");
    expect(html).toContain("w-64");
    expect(html).toContain("grid-cols-12");
    expect(html).toContain("min-w-0");
  });

  it("omits bulk actions from phone check-in presentation", () => {
    const html = renderToStaticMarkup(<AdminShell bulkActions={<button>Markera alla</button>}>Checka in</AdminShell>);
    expect(html).toContain('data-bulk-actions="true"');
    expect(html).toContain("hidden md:block");
  });
});
