import { beforeEach, describe, expect, it, vi } from "vitest";

const { database, drizzleMock, postgresMock, sqlClient } = vi.hoisted(() => ({
  database: { kind: "database" },
  drizzleMock: vi.fn(),
  postgresMock: vi.fn(),
  sqlClient: { end: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("postgres", () => ({ default: postgresMock }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: drizzleMock }));

import { createDatabaseClient, POSTGRES_OPTIONS } from "./client";
import * as schema from "./schema";

describe("createDatabaseClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postgresMock.mockReturnValue(sqlClient);
    drizzleMock.mockReturnValue(database);
  });

  it("uses the transaction-pool-safe postgres configuration without connecting", () => {
    const url = "postgres://postgres:secret@localhost:6543/postgres";
    const result = createDatabaseClient(url);

    expect(POSTGRES_OPTIONS).toEqual({ prepare: false });
    expect(postgresMock).toHaveBeenCalledExactlyOnceWith(url, { prepare: false });
    expect(drizzleMock).toHaveBeenCalledExactlyOnceWith(sqlClient, {
      casing: "snake_case",
      schema,
    });
    expect(result).toBe(database);
    expect(sqlClient.end).not.toHaveBeenCalled();
  });

  it.each(["", " ", "\n\t"])("rejects a blank database URL", (url) => {
    expect(() => createDatabaseClient(url)).toThrow("DATABASE_URL is required");
    expect(postgresMock).not.toHaveBeenCalled();
    expect(drizzleMock).not.toHaveBeenCalled();
  });
});
