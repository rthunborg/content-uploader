import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LinkErrorPage from "./page";

describe("link error page", () => {
  it("explains the expired or used link and offers a safe fresh-link remedy", async () => {
    const markup = renderToStaticMarkup(
      await LinkErrorPage({ searchParams: Promise.resolve({ next: "/tasks" }) }),
    );

    expect(markup).toContain("Länken går inte längre att använda");
    expect(markup).toContain("Länken kan ha gått ut eller redan ha använts");
    expect(markup).toContain('href="/auth/login?next=%2Ftasks"');
    expect(markup).not.toContain("token_hash");
    expect(markup).not.toContain("email=");
  });

  it("drops unsafe continuation input", async () => {
    const markup = renderToStaticMarkup(
      await LinkErrorPage({ searchParams: Promise.resolve({ next: "https://evil.example" }) }),
    );
    expect(markup).toContain('href="/auth/login?next=%2F"');
  });
});
