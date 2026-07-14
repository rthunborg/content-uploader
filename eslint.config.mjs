import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const FEATURES = [
  "upload",
  "triage",
  "library",
  "consent",
  "tasks",
  "messaging",
  "ambassadors",
  "export",
];

const restrictedAuthContexts = {
  name: "@/lib/auth",
  importNames: ["requireUserPreConsent", "systemContext"],
  message: "Privileged auth contexts are restricted to approved entrypoints.",
};

const featureDalBoundaries = FEATURES.map((feature) => {
  const otherFeatures = FEATURES.filter((candidate) => candidate !== feature).join("|");

  return {
    files: [`src/features/${feature}/dal/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [restrictedAuthContexts],
          patterns: [
            {
              group: FEATURES.filter((candidate) => candidate !== feature).flatMap(
                (candidate) => [
                  `@/features/${candidate}/dal`,
                  `@/features/${candidate}/dal/*`,
                ],
              ),
            },
            {
              regex:
                `^(?:\\.\\./)+(?:src/features/|features/)?(?:${otherFeatures})/dal(?:/|$)`,
            },
          ],
        },
      ],
    },
  };
});

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "node_modules/**"]),
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            "server-only",
            "react",
          ],
          patterns: [
            {
              regex: "^@/db/client(?:/|$)",
              message: "The runtime-neutral audit emitter must never capture the global database client.",
            },
            {
              group: [
                "next",
                "next/*",
                "react/*",
                "@/app",
                "@/app/*",
                "@/db",
                "@/features",
                "@/features/*",
                "@/lib",
                "@/lib/*",
                "@/worker",
                "@/worker/*",
              ],
            },
            { regex: "^@/db/(?!client(?:/|$))" },
            { regex: "^(?:\\.\\./)+(?:src/)?(?:app|db|features|lib|worker)(?:/|$)" },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["src/app/api/webhooks/**/*.{ts,tsx}", "src/app/api/cron/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { paths: [restrictedAuthContexts], patterns: [
        { group: ["@/db", "@/db/*"] },
        { regex: "^(?:\\.\\./)+(?:src/)?db(?:/|$)" },
      ] }],
    },
  },
  {
    files: ["src/lib/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}"],
    ignores: ["src/lib/auth.ts", "src/features/*/dal/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [restrictedAuthContexts],
        patterns: [
          { group: ["@/db", "@/db/*"] },
          { regex: "^(?:\\.\\./)+(?:src/)?db(?:/|$)" },
        ],
      }],
    },
  },
  {
    files: ["src/app/api/webhooks/**/*.{ts,tsx}", "src/app/api/cron/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", {
      paths: [{ name: "@/lib/auth", importNames: ["requireUserPreConsent"] }],
      patterns: [{ group: ["@/db", "@/db/*"] }],
    }] },
  },
  {
    files: ["worker/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [restrictedAuthContexts],
          patterns: [
            {
              // Worker may import ONLY @/db/schema (of @/db), @/shared, and worker/lib.
              // @/db/client is the app-only transaction-pool client (wrong connection
              // mode for the worker), so it is forbidden explicitly while @/db/schema
              // stays allowed; @/app, @/components, @/lib, @/features are also off-limits.
              group: [
                "@/app",
                "@/app/*",
                "@/components",
                "@/components/*",
                "@/lib",
                "@/lib/*",
                "@/features",
                "@/features/*",
                "@/db/client",
                "@/db/client/*",
              ],
            },
            { regex: "^(?:\\.\\./)+(?:src/)?(?:lib|features|app|components)(?:/|$)" },
            {
              regex: "^(?:\\.\\./)+(?:src/)?db(?:$|/(?!schema(?:/|$)))",
            },
          ],
        },
      ],
    },
  },
  ...featureDalBoundaries,
  {
    files: ["src/features/consent/dal/pre-consent.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [
      { group: FEATURES.filter((feature) => feature !== "consent").flatMap((feature) => [`@/features/${feature}/dal`, `@/features/${feature}/dal/*`]) },
    ] }] },
  },
  {
    // Route handlers AND server components (page/layout) compose features and read
    // through the DAL/query layer — never @/db directly. The DAL is the compliance
    // choke point, so bypassing it from the app layer is a boundary violation.
    files: ["src/app/**/{route,page,layout}.{ts,tsx}"],
    ignores: ["src/app/api/webhooks/**/*.{ts,tsx}", "src/app/api/cron/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [restrictedAuthContexts],
          patterns: [
            { group: ["@/db", "@/db/*"] },
            { regex: "^(?:\\.\\./)+(?:src/)?db(?:/|$)" },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/(ambassador)/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [restrictedAuthContexts],
          patterns: [
            { group: ["@/db", "@/db/*"] },
            { group: ["@/features/*/dal/admin", "@/features/*/dal/admin/*"] },
            {
              regex:
                "^(?:\\.\\./)+(?:src/)?features/[^/]+/dal/admin(?:/|$)",
            },
          ],
        },
      ],
    },
  },
]);
