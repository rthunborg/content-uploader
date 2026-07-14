import { defineConfig } from "drizzle-kit";

const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  throw new Error("DIRECT_URL is required to generate database migrations");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./supabase/migrations",
  casing: "snake_case",
  migrations: { prefix: "supabase" },
  dbCredentials: { url: directUrl },
  schemaFilter: ["public"],
});
