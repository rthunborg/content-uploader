import { afterEach, describe, expect, it, vi } from "vitest";

import { initializeLogger, logCritical, logError } from "./logger";

afterEach(() => {
  initializeLogger();
  vi.restoreAllMocks();
});

describe("runtime-neutral structured logger", () => {
  it("serializes Error inputs to stderr", () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);

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
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);

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
    initializeLogger(() => {
      throw new Error("sink failed");
    });

    expect(() => logError("hostile.event", hostile, { hostile })).not.toThrow();
  });

  it("preserves shared non-cyclic references and marks only recursion cycles", () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);
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
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);

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
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logError("connection.test", null, {
      db: "postgresql://app:pg-pass@db.internal:5432/main",
      endpoint: "https://admin:http-pass@internal.example/hook",
    });

    const output = String(write.mock.calls[0]?.[0]);
    expect(output).not.toContain("pg-pass");
    expect(output).not.toContain("http-pass");
    expect(output).toContain("[REDACTED]");
  });

  it("redacts opaque credentials embedded in URL query parameters", () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const url =
      "https://storage.example/file?download=1&access_token=opaque-secret&X-Amz-Signature=signed-secret";

    logError("signed-url.failed", new Error(`Request failed: ${url}`), {
      callback: "https://example.test/cb?apikey=context-secret&safe=value",
    });

    const output = String(write.mock.calls[0]?.[0]);
    expect(output).not.toContain("opaque-secret");
    expect(output).not.toContain("signed-secret");
    expect(output).not.toContain("context-secret");
    expect(output).toContain("safe=value");
  });

  it("redacts opaque refresh, id, session, and provider-signature query values", () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logError(
      "session.failed",
      new Error(
        "callback https://auth.example/cb?refresh_token=refresh-secret&id_token=id-secret",
      ),
      {
        resume:
          "https://storage.example/o?session_token=session-secret&sig=sas-secret&sortkey=keep-me",
      },
    );

    const output = String(write.mock.calls[0]?.[0]);
    expect(output).not.toContain("refresh-secret");
    expect(output).not.toContain("id-secret");
    expect(output).not.toContain("session-secret");
    expect(output).not.toContain("sas-secret");
    expect(output).toContain("sortkey=keep-me");
  });

  it("redacts opaque credentials carried in a URL fragment", () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logError(
      "implicit-flow.failed",
      new Error(
        "redirect https://app.example/callback#refresh_token=fragment-secret&session_state=keep-me",
      ),
      {
        resume:
          "https://storage.example/o#access_token=fragment-access-secret&sig=fragment-sig-secret&page=2",
      },
    );

    const output = String(write.mock.calls[0]?.[0]);
    expect(output).not.toContain("fragment-secret");
    expect(output).not.toContain("fragment-access-secret");
    expect(output).not.toContain("fragment-sig-secret");
    expect(output).toContain("session_state=keep-me");
    expect(output).toContain("page=2");
  });

  it("redacts a leading query credential and single-credential URL userinfo", () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logError("bare.query", null, {
      body: "access_token=leading-secret&safe=value",
      endpoint: "https://token-only-secret@api.internal/resource",
    });

    const output = String(write.mock.calls[0]?.[0]);
    expect(output).not.toContain("leading-secret");
    expect(output).not.toContain("token-only-secret");
    expect(output).toContain("safe=value");
    expect(output).toContain("api.internal");
  });

  it("falls back to the known stdout transport when a replacement fails", () => {
    const stdout = vi.spyOn(console, "log").mockImplementation(() => undefined);
    initializeLogger(() => {
      throw new Error("replacement failed");
    });

    expect(() => logError("transport.failed", new Error("original"))).not.toThrow();
    expect(stdout).toHaveBeenCalledOnce();
    expect(stdout).toHaveBeenCalledWith(
      '{"level":"error","event":"logger.serialization_failed"}',
    );
  });

  it("redacts event, stack, and cause while retaining useful error detail", () => {
    const write = vi.spyOn(console, "log").mockImplementation(() => undefined);
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

  it("replaces transports deterministically and writes one JSON line", () => {
    const first = vi.fn();
    const replacement = vi.fn();
    initializeLogger(first);
    initializeLogger(replacement);

    logError("replacement.test", new Error("boom"));

    expect(first).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledTimes(1);
    expect(replacement.mock.calls[0]?.[0]).not.toContain("\n");
    expect(JSON.parse(String(replacement.mock.calls[0]?.[0]))).toMatchObject({
      level: "error",
      event: "replacement.test",
    });
  });

  it("rejects invalid initialization without replacing the active transport", () => {
    const active = vi.fn();
    initializeLogger(active);

    expect(() => initializeLogger(null as unknown as never)).toThrow(TypeError);
    logError("still.active", null);
    expect(active).toHaveBeenCalledTimes(1);
  });
});
