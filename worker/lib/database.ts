import postgres from "postgres";
let client: ReturnType<typeof postgres> | undefined;
export function getWorkerSql() { const url = process.env.DATABASE_SESSION_URL?.trim(); if (!url) throw new Error("DATABASE_SESSION_URL is required"); return client ??= postgres(url, { prepare: false }); }
