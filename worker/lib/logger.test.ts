import { afterEach, describe, expect, it, vi } from "vitest";

import { initializeLogger } from "../../src/shared/logger";
import { initializeWorkerLogger, logCritical } from "./logger";

afterEach(() => {
  initializeLogger();
  vi.restoreAllMocks();
});

describe("worker logger", () => {
  it("initializes the shared stdout transport", () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
    initializeWorkerLogger();
    logCritical("worker.alert", new Error("queue unavailable"));
    expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toMatchObject({
      level: "critical",
      event: "worker.alert",
    });
  });
});
