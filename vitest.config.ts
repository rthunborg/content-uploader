import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "e2e/**"],
    // Integration suites share one local Supabase database and several of them
    // reset or mutate that stack. File-level parallelism makes independent
    // workers stop/restart the same services underneath each other.
    fileParallelism: false,
  },
});
