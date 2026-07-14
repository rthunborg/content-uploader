import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "../ui/button";
import { AmbassadorShell } from "./ambassador-shell";

describe("AmbassadorShell", () => {
  it("uses phone margins and a bottom-anchored sole action without covering content", () => {
    const html = renderToStaticMarkup(<AmbassadorShell primaryAction={<Button>Fortsätt</Button>}><h1>Din uppgift</h1></AmbassadorShell>);
    expect(html).toContain("px-4");
    expect(html).toContain("min-h-dvh");
    expect(html).toContain("sticky bottom-0");
    expect(html).toContain("pb-6");
    expect(html).toContain("env(safe-area-inset-bottom)");
    expect(html).toContain("Fortsätt");
  });
});
