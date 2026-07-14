import { afterEach, describe, expect, it, vi } from "vitest";

import { logCritical, logError } from "./logger";

afterEach(() => vi.restoreAllMocks());

describe("runtime-neutral structured logger", () => {
  it("serializes Error inputs to stderr", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logError("worker.failed", new Error("transcode stopped"), {
      assetId: "asset-1",
    });

    const payload = JSON.parse(String(write.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({
      level: "error",
      event: "worker.failed",
      error: { name: "Error", message: "transcode stopped" },
      context: { assetId: "asset-1" },
    });
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("serializes non-Error values and redacts likely secrets", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logCritical("auth.failed", { reason: "bad input" }, {
      passphrase: "do-not-log",
      authorization: "Bearer eyJhbGciOi.fake.token",
      nested: { apiKey: "sb_secret_never-log" },
    });

    const output = String(write.mock.calls[0]?.[0]);
    const payload = JSON.parse(output);
    expect(payload.error).toEqual({ value: { reason: "bad input" } });
    expect(payload.context).toEqual({
      passphrase: "[REDACTED]",
      authorization: "[REDACTED]",
      nested: { apiKey: "[REDACTED]" },
    });
    expect(output).not.toContain("do-not-log");
    expect(output).not.toContain("sb_secret_never-log");
    expect(output).not.toContain("eyJhbGciOi.fake.token");
  });

  it("never throws for hostile objects or a failing output sink", () => {
    const hostile = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => {
        throw new Error("getter secret");
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("sink failed");
    });

    expect(() => logError("hostile.event", hostile, { hostile })).not.toThrow();
  });

  it("preserves shared non-cyclic references and marks only recursion cycles", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const shared = { status: "safe" };
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    logError("references.test", null, { first: shared, second: shared, cyclic });

    const payload = JSON.parse(String(write.mock.calls[0]?.[0]));
    expect(payload.context).toEqual({
      first: { status: "safe" },
      second: { status: "safe" },
      cyclic: { self: "[CIRCULAR]" },
    });
  });

  it("redacts common credential, signing, access, refresh, and session keys", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logError("credentials.test", null, {
      credentials: "hidden-1",
      signingKey: "hidden-2",
      accessToken: "hidden-3",
      refresh_token: "hidden-4",
      sessionId: "hidden-5",
    });

    const output = String(write.mock.calls[0]?.[0]);
    expect(JSON.parse(output).context).toEqual({
      credentials: "[REDACTED]",
      signingKey: "[REDACTED]",
      accessToken: "[REDACTED]",
      refresh_token: "[REDACTED]",
      sessionId: "[REDACTED]",
    });
    expect(output).not.toContain("hidden-");
  });

  it("redacts embedded credentials in URLs of any scheme, not only postgres", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logError("connection.test", null, {
      db: "postgresql://app:pg-pass@db.internal:5432/main",
      endpoint: "https://admin:http-pass@internal.example/hook",
    });

    const output = String(write.mock.calls[0]?.[0]);
    expect(output).not.toContain("pg-pass");
    expect(output).not.toContain("http-pass");
    expect(output).toContain("[REDACTED]");
  });

  it("redacts event, stack, and cause while retaining useful error detail", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("Bearer private-token", {
      cause: { apiKey: "sb_secret_hidden", reason: "timeout" },
    });

    logError("auth.Bearer private-event", error);

    const output = String(write.mock.calls[0]?.[0]);
    const payload = JSON.parse(output);
    expect(payload.event).not.toContain("private-event");
    expect(payload.error.message).toContain("[REDACTED]");
    expect(payload.error.stack).toContain("[REDACTED]");
    expect(payload.error.cause).toEqual({ apiKey: "[REDACTED]", reason: "timeout" });
    expect(output).not.toContain("sb_secret_hidden");
  });
});
