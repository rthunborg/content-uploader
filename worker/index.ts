import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { initializeWorkerLogger, logCritical } from "./lib/logger.ts";
import { consumeOneMaintenanceJob } from "./lib/maintenance.ts";

initializeWorkerLogger();

function firstLine(command: string, args: string[]) {
  return execFileSync(command, args, { encoding: "utf8" })
    .trim()
    .split("\n")[0];
}

export function versions() {
  console.log(firstLine(process.execPath, ["--version"]));
  console.log(firstLine("ffmpeg", ["-version"]));
}

type WorkerEntryOptions = {
  args?: string[];
  probeVersions?: () => void;
  keepAlive?: () => void;
  startMaintenance?: () => void;
};

export function startMaintenancePolling(
  consume: () => Promise<unknown> = consumeOneMaintenanceJob,
  schedule: (callback: () => void, milliseconds: number) => unknown = setInterval,
) {
  let running = false;
  const poll = () => {
    if (running) return;
    running = true;
    void consume().catch((error: unknown) => logCritical("worker.maintenance_failed", error)).finally(() => { running = false; });
  };
  poll();
  return schedule(poll, 60_000);
}

export function runWorker({
  args = process.argv,
  probeVersions = versions,
  keepAlive = () => setInterval(() => undefined, 60_000),
  startMaintenance = () => { startMaintenancePolling(); },
}: WorkerEntryOptions = {}) {
  try {
    probeVersions();
    if (args.includes("--versions")) return;

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        event: "worker.ready",
        region: process.env.RAILWAY_REPLICA_REGION ?? "not-reported",
      }),
    );
    startMaintenance();
    keepAlive();
  } catch (error) {
    logCritical("worker.startup_failed", error);
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runWorker();
}
