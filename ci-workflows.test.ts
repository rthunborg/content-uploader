import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function workflow(name: string) {
  return readFileSync(resolve(process.cwd(), ".github/workflows", name), "utf8");
}

function expectOrdered(source: string, markers: string[]) {
  let previous = -1;
  for (const marker of markers) {
    const current = source.indexOf(marker);
    expect(current, `missing workflow marker: ${marker}`).toBeGreaterThan(-1);
    expect(current, `${marker} must appear after ${markers[markers.indexOf(marker) - 1]}`)
      .toBeGreaterThan(previous);
    previous = current;
  }
}

describe("CI/CD workflow contracts", () => {
  it("runs the PR quality gates against local Supabase in the required order", () => {
    const source = workflow("ci.yml");

    expect(source).toContain("pull_request:");
    expect(source).toContain("permissions:\n  contents: read");
    expectOrdered(source, [
      "name: Start local Supabase",
      "run: npx supabase start",
      "name: Reset local Supabase",
      "name: Typecheck",
      "run: npm run typecheck",
      "name: Lint",
      "run: npm run lint",
      "name: Vitest",
      "run: npm test",
      "name: Playwright and axe",
      "run: npm run e2e",
      "name: Build worker image",
      "name: Smoke worker versions",
    ]);
    expect(source).toContain("name: Upload Playwright diagnostics");
    expect(source).toContain("if: failure()");
    expect(source).toContain("playwright-report/");
    expect(source).toContain("test-results/");
    expect(source).toContain("name: Stop local Supabase");
    expect(source).toContain("if: always()");
  });

  it("serializes fresh successful main releases and migrates before Railway", () => {
    const source = workflow("deploy.yml");

    expect(source).toContain("workflow_run:");
    expect(source).toContain("workflows: [Quality]");
    expect(source).toContain("types: [completed]");
    expect(source).toContain("branches: [main]");
    expect(source).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(source).toContain("group: production-release");
    expect(source).toContain("cancel-in-progress: false");
    expect(source).toContain("timeout-minutes: 30");
    expectOrdered(source, [
      "name: Ignore stale successful quality runs",
      "git ls-remote origin refs/heads/main",
      'if [ "$remote_main_sha" != "$TESTED_SHA" ]',
      "name: Link production Supabase project",
      "name: Apply production migrations",
      "run: npx supabase db push",
      "name: Deploy Railway worker",
      "run: npx --yes @railway/cli@5.26.1 up",
    ]);
    expect(source.match(/if: steps\.freshness\.outputs\.current == 'true'/g))
      .toHaveLength(3);
    expect(source).not.toMatch(/supabase db push[^\n]*(?:\|\| true|; true)/);
    expect(source).not.toMatch(/@railway\/cli[^\n]*(?:\|\| true|; true)/);
  });
});
