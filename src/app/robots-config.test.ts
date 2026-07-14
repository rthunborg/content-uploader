import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";
import vercelConfig from "../../vercel.json";

const ROBOTS_HEADER = { key: "X-Robots-Tag", value: "noindex, nofollow" };

describe("global robots configuration", () => {
  it.each(["/auth/login", "/auth/confirm", "/tasks", "/admin/library"])(
    "applies the exact header to representative path %s through Next config",
    async () => {
      const rules = await nextConfig.headers?.();
      expect(rules).toEqual([
        { source: "/:path*", headers: [ROBOTS_HEADER] },
      ]);
    },
  );

  it("applies the same exact global header through Vercel config", () => {
    expect(vercelConfig.headers).toEqual([
      { source: "/(.*)", headers: [ROBOTS_HEADER] },
    ]);
  });

  it("pins Vercel functions to the Stockholm (arn1) EU region", () => {
    expect(vercelConfig.regions).toEqual(["arn1"]);
  });
});
