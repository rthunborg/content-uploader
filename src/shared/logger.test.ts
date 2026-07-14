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
