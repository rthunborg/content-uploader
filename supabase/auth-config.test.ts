import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const config = readFileSync(resolve(root, "supabase/config.toml"), "utf8");
const magicLink = readFileSync(resolve(root, "supabase/templates/magic_link.html"), "utf8");
const invite = readFileSync(resolve(root, "supabase/templates/invite.html"), "utf8");

describe("local Supabase email authentication contract", () => {
  it("disables project signup, enables email login, and expires links after 15 minutes", () => {
    expect(config).toMatch(/\[auth\][\s\S]*?enable_signup = false/);
    expect(config).toMatch(/\[auth\.email\][\s\S]*?enable_signup = true/);
    expect(config).toMatch(/otp_expiry = 900/);
    expect(config).toContain('site_url = "http://localhost:3000"');
    expect(config).toContain('additional_redirect_urls = ["http://localhost:3000"]');
  });

  it.each([
    ["invite", "./supabase/templates/invite.html"],
    ["magic_link", "./supabase/templates/magic_link.html"],
  ])("wires the %s email through the custom token-hash template", (name, path) => {
    expect(config).toMatch(
      new RegExp(
        `\\[auth\\.email\\.template\\.${name}\\][\\s\\S]*?content_path = "${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
      ),
    );
  });

  it.each([
    ["magiclink", magicLink],
    ["invite", invite],
  ])("routes %s token hashes through the single confirmation endpoint", (type, template) => {
    expect(template).toContain("{{ .RedirectTo }}");
    expect(template).toContain("token_hash={{ .TokenHash }}");
    expect(template).toContain(`type=${type}`);
    expect(template).not.toContain("{{ .ConfirmationURL }}");
  });
});
