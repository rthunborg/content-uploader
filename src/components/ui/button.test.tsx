/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Button, buttonVariants } from "./button";

describe("Button", () => {
  it.each(["primary", "secondary", "tertiary", "link", "dialogDestructive"] as const)("renders the %s action hierarchy", (variant) => {
    const html = renderToStaticMarkup(<Button variant={variant}>Fortsätt</Button>);
    expect(html).toContain(`data-variant="${variant}"`);
    expect(html).toContain("min-h-11");
    expect(html).toContain("text-base");
    expect(html).toContain("focus-visible:outline-2");
    expect(html).toContain("active:translate-y-px");
    expect(html).toContain("motion-reduce:active:translate-y-0");
  });

  it("uses link blue and does not expose an ordinary destructive variant", () => {
    expect(buttonVariants({ variant: "link" })).toContain("text-link");
    expect(buttonVariants({ variant: "dialogDestructive" })).toContain("bg-destructive");
    expect(buttonVariants.toString()).not.toContain('destructive:');
  });

  it("keeps a disabled asChild link out of focus order and prevents pointer or keyboard activation", () => {
    const activated = vi.fn();
    render(<Button asChild aria-disabled="true"><a href="/delete" onClick={activated}>Ta bort</a></Button>);
    const link = screen.getByRole("link", { name: "Ta bort" });
    expect(link.getAttribute("tabindex")).toBe("-1");
    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(fireEvent.click(link)).toBe(false);
    fireEvent.keyDown(link, { key: "Enter" });
    fireEvent.keyUp(link, { key: "Enter" });
    expect(activated).not.toHaveBeenCalled();
  });
});
