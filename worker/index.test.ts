import { afterEach, describe, expect, it, vi } from "vitest";

import { initializeLogger } from "../src/shared/logger";
import { runWorker, startMaintenancePolling } from "./index";

afterEach(() => {
  initializeLogger();
  vi.restoreAllMocks();
});

describe("maintenance polling", () => {
  it("never overlaps polls while the prior consume is unresolved", async () => {
    let release!: () => void; const pending = new Promise<void>((resolve) => { release = resolve; });
    const consume = vi.fn().mockReturnValueOnce(pending).mockResolvedValue(false); let tick!: () => void;
    startMaintenancePolling(consume, (callback) => { tick = callback; return 1; });
    expect(consume).toHaveBeenCalledOnce(); tick(); tick(); expect(consume).toHaveBeenCalledOnce();
    release(); await pending; await Promise.resolve(); tick(); expect(consume).toHaveBeenCalledTimes(2);
  });
});

describe("worker entry point", () => {
  it.each([
    ["version probe", ["node", "worker/index.ts", "--versions"]],
    ["normal startup", ["node", "worker/index.ts"]],
  ])("logs and rethrows a failed %s", (_name, args) => {
    const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
    initializeLogger(output);
    const failure = new Error("ffmpeg unavailable");

    expect(() =>
      runWorker({
        args,
        probeVersions: () => {
          throw failure;
        },
        keepAlive: vi.fn(),
      }),
    ).toThrow(failure);

    expect(output).toHaveBeenCalledOnce();
    expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toMatchObject({
      level: "critical",
      event: "worker.startup_failed",
      error: { message: "ffmpeg unavailable" },
    });
  });

  it("emits worker.ready and stays alive on a successful normal startup", () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const keepAlive = vi.fn();
    const probeVersions = vi.fn();
    const startMaintenance = vi.fn();

    runWorker({ args: ["node", "worker/index.ts"], probeVersions, keepAlive, startMaintenance });

    expect(probeVersions).toHaveBeenCalledOnce();
    expect(keepAlive).toHaveBeenCalledOnce();
    expect(startMaintenance).toHaveBeenCalledOnce();
    const ready = output.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.includes("worker.ready"));
    expect(ready, "worker.ready line was not emitted").toBeDefined();
    expect(JSON.parse(String(ready))).toMatchObject({
      level: "info",
      event: "worker.ready",
    });
  });

  it("short-circuits on --versions without readiness or keep-alive", () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const keepAlive = vi.fn();

    runWorker({
      args: ["node", "worker/index.ts", "--versions"],
      probeVersions: vi.fn(),
      keepAlive,
    });

    expect(keepAlive).not.toHaveBeenCalled();
    expect(
      output.mock.calls.some((call) => String(call[0]).includes("worker.ready")),
    ).toBe(false);
  });
});
