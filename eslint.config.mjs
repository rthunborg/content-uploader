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

const featureDalBoundaries = FEATURES.map((feature) => {
  const otherFeatures = FEATURES.filter((candidate) => candidate !== feature).join("|");

  return {
    files: [`src/features/${feature}/dal/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
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
          paths: ["server-only", "react"],
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "react/*",
                "@/app",
                "@/app/*",
                "@/db",
                "@/db/*",
                "@/features",
                "@/features/*",
                "@/lib",
                "@/lib/*",
                "@/worker",
                "@/worker/*",
              ],
            },
            { regex: "^(?:\\.\\./)+(?:src/)?(?:app|db|features|lib|worker)(?:/|$)" },
          ],
        },
      ],
    },
  },
  {
    files: ["worker/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
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
    // Route handlers AND server components (page/layout) compose features and read
    // through the DAL/query layer — never @/db directly. The DAL is the compliance
    // choke point, so bypassing it from the app layer is a boundary violation.
    files: ["src/app/**/{route,page,layout}.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
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
          patterns: [
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
