import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function messagesFor(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter(({ ruleId }) => ruleId === "no-restricted-imports");
}

async function expectRestricted(code: string, filePath: string, prohibited: string) {
  const messages = await messagesFor(code, filePath);
  expect(messages.length).toBeGreaterThan(0);
  expect(messages.some(({ message }) => message.includes(`'${prohibited}'`))).toBe(true);
}

describe("architectural import boundaries", () => {
  it.each([
    ["src/shared/example.ts", 'import "server-only";'],
    ["src/shared/example.ts", 'import React from "react";'],
    ["src/shared/nested/example.ts", 'import { profiles } from "../../db/schema";'],
    ["src/shared/audit.ts", 'import { getDatabase } from "@/db/client";'],
    ["src/shared/example.ts", 'import x from "@/features/upload/dal/ambassador";'],
    ["worker/jobs/example.ts", 'import { requireUser } from "@/lib/auth";'],
    ["worker/jobs/example.ts", 'import { requireUser } from "../../src/lib/auth";'],
    ["worker/jobs/example.ts", 'import { getDatabase } from "@/db/client";'],
    ["worker/jobs/example.ts", 'import { getDatabase } from "../../src/db/client";'],
    ["src/features/upload/dal/example.ts", 'import x from "@/features/tasks/dal/admin";'],
    ["src/features/upload/dal/example.ts", 'import x from "../../../tasks/dal/admin";'],
    ["src/app/example/route.ts", 'import { profiles } from "@/db/schema";'],
    ["src/app/example/route.ts", 'import { profiles } from "../../db/schema";'],
    ["src/app/example/page.tsx", 'import { profiles } from "@/db/schema";'],
    ["src/app/example/layout.tsx", 'import { getDatabase } from "@/db/client";'],
    ["src/app/example/actions.ts", 'import { getDatabase } from "@/db/client";'],
    ["src/components/example.tsx", 'import { getDatabase } from "@/db/client";'],
    ["src/features/upload/example.ts", 'import { systemContext } from "@/lib/auth";'],
    ["src/features/upload/dal/example.ts", 'import { requireUserPreConsent } from "@/lib/auth";'],
    ["src/app/example/route.ts", 'import { requireUserPreConsent } from "@/lib/auth";'],
    ["src/components/example.tsx", 'import { systemContext } from "@/lib/auth";'],
    ["src/lib/helper.ts", 'import { systemContext } from "@/lib/auth";'],
    ["src/lib/helper.ts", 'import { getDatabase } from "@/db/client";'],
    ["src/features/upload/helper.ts", 'import { getDatabase } from "@/db/client";'],
    [
      "src/app/(ambassador)/example/page.tsx",
      'import x from "@/features/ambassadors/dal/admin";',
    ],
    [
      "src/app/(ambassador)/example/page.tsx",
      'import x from "@/features/ambassadors/dal/admin/private";',
    ],
    [
      "src/app/(ambassador)/example/page.tsx",
      'import x from "../../../features/ambassadors/dal/admin/private";',
    ],
  ])(
    "rejects %s importing a forbidden layer",
    async (filePath, code) => {
      const prohibited = code.match(/from\s+"([^"]+)"|import\s+"([^"]+)"/)?.slice(1).find(Boolean);
      expect(prohibited).toBeDefined();
      await expectRestricted(code, filePath, prohibited ?? "");
    },
    60_000,
  );

  it.each([
    ["src/shared/example.ts", 'import { logger } from "./logger";'],
    ["worker/jobs/example.ts", 'import { assets } from "@/db/schema";'],
    ["worker/jobs/example.ts", 'import { assets } from "../../src/db/schema";'],
    ["src/app/example/route.ts", 'import x from "@/features/upload/dal/ambassador";'],
    ["src/features/upload/dal/example.ts", 'import x from "@/features/upload/dal/private";'],
    ["src/features/consent/dal/pre-consent.ts", 'import { requireUserPreConsent } from "@/lib/auth";'],
    ["src/app/api/webhooks/example/route.ts", 'import { systemContext } from "@/lib/auth";'],
    ["src/app/api/cron/example/route.ts", 'import { systemContext } from "@/lib/auth";'],
    ["src/features/upload/dal/example.ts", 'import { getDatabase } from "@/db/client";'],
    ["src/features/upload/dal/example.ts", 'import { audit } from "@/shared/audit";'],
    ["worker/jobs/example.ts", 'import { audit } from "@/shared/audit";'],
    ["worker/jobs/example.ts", 'import { auditEvents } from "@/db/schema";'],
  ])("allows %s importing an approved layer", async (filePath, code) => {
    expect(await messagesFor(code, filePath)).toHaveLength(0);
  });
});
