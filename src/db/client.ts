import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export const POSTGRES_OPTIONS = { prepare: false } as const;

export function createDatabaseClient(url: string): PostgresJsDatabase<typeof schema> {
  if (!url.trim()) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = postgres(url, POSTGRES_OPTIONS);
  return drizzle(sql, { casing: "snake_case", schema });
}

let database: PostgresJsDatabase<typeof schema> | undefined;

export function getDatabase(): PostgresJsDatabase<typeof schema> {
  database ??= createDatabaseClient(process.env.DATABASE_URL ?? "");
  return database;
}
