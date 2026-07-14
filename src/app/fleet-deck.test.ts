import { readFileSync } from "node:fs";
import * as fontkit from "fontkit";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
const font = readFileSync(new URL("./fonts/inter-variable.woff2", import.meta.url));
const license = readFileSync(new URL("../../public/fonts/OFL.txt", import.meta.url), "utf8");

function luminance(hex: string) {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  return channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Fleet Deck foundations", () => {
  it("locks each semantic role to its exact approved value", () => {
    const roles = {
      surface: "#ffffff", "surface-panel": "#eae3d2", "surface-media": "#1a1a1a",
      "action-primary": "#034592", link: "#3344dd", "focus-ring": "#3344dd",
      info: "#cbe1f6", "selected-bg": "#cbe1f6", destructive: "#e41f1f", "caution-bg": "#fbd4cd",
    };
    for (const [role, value] of Object.entries(roles)) {
      expect(css).toMatch(new RegExp(`--${role}:\\s*${value.replace("#", "\\#")};`));
    }
    expect(css).toContain("font-variant-numeric: tabular-nums");
    const excluded = ["#1c5" + "e38", "#feca" + "3a", "gre" + "en", "yel" + "low"];
    for (const value of excluded) expect(css.toLowerCase()).not.toContain(value);
  });

  it("keeps focus, controls, motion, and same-origin Inter in the public contract", () => {
    expect(css).toMatch(/outline:\s*2px solid var\(--focus-ring\)/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/font-size:\s*16px/);
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(layout).toContain('src: "./fonts/inter-variable.woff2"');
    expect(layout).toContain('weight: "100 900"');
    expect(layout).toContain('lang="sv"');
    // The font variable must be applied on the same element that consumes it: globals.css
    // binds `font-family: var(--font-inter)` on `html`, and custom properties inherit downward
    // only, so the variable class must sit on `<html>` (not `<body>`) or Inter never renders.
    expect(css).toMatch(/html\s*\{[^}]*font-family:\s*var\(--font-inter\)/);
    expect(layout).toMatch(/<html[^>]*className=\{inter\.variable\}/);
    expect(font.subarray(0, 4).toString()).toBe("wOF2");
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
    const parsedFont = fontkit.create(font);
    expect("variationAxes" in parsedFont).toBe(true);
    if (!("variationAxes" in parsedFont)) throw new Error("Expected a variable font face");
    expect(parsedFont.variationAxes.wght).toMatchObject({ min: 100, max: 900 });
    expect(layout).not.toMatch(/inter-latin\.woff2[\s\S]*weight:\s*"100 900"/);
  });

  it("keeps legacy buttons layered and excludes owned component buttons from the rule", () => {
    const baseLayer = css.slice(css.indexOf("@layer base"));
    expect(baseLayer).toContain('button:not([data-slot="button"])');
    expect(css.slice(0, css.indexOf("@layer base"))).not.toMatch(/(^|\n)button(?:\s|:|\{)/);
  });

  it("keeps approved foreground and background pairings above AA", () => {
    expect(contrast("ffffff", "034592")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("1a1a1a", "eae3d2")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("1a1a1a", "cbe1f6")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("1a1a1a", "fbd4cd")).toBeGreaterThanOrEqual(4.5);
  });
});
