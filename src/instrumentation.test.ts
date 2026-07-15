import { beforeEach, describe, expect, it, vi } from "vitest";

const initializeLogger = vi.fn();
vi.mock("@/shared/logger", () => ({ initializeLogger }));

describe("server instrumentation", () => {
  beforeEach(() => {
    initializeLogger.mockClear();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
  });

  it("initializes logging for the Node.js server runtime", async () => {
    const { register } = await import("./instrumentation");
    register();
    expect(initializeLogger).toHaveBeenCalledOnce();
  });

  it("does not initialize it in another runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    const { register } = await import("./instrumentation");
    register();
    expect(initializeLogger).not.toHaveBeenCalled();
  });
});
