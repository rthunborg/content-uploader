import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { publishTerms } = vi.hoisted(() => ({ publishTerms: vi.fn() }));
vi.mock("../src/features/consent/dal/terms.ts", () => ({ publishTerms }));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn().mockResolvedValue('{"schemaVersion":1}') }));
import { publishTermsFile } from "./publish-terms";
describe("terms publisher", () => {
  it("passes the supplied manifest to the DAL without embedded legal text", async () => { publishTerms.mockResolvedValue({ id: "id" }); await publishTermsFile("manifest.json"); expect(publishTerms).toHaveBeenCalledWith({ schemaVersion: 1 }); });

  it("starts the real server-only DAL before validating CLI arguments", () => {
    const result = spawnSync("npm", ["run", "publish-terms", "--"], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage: npm run publish-terms -- <manifest.json>");
    expect(result.stderr).not.toContain("This module cannot be imported from a Client Component module");
  });
});
