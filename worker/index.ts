import { execFileSync } from "node:child_process";

function firstLine(command: string, args: string[]) {
  return execFileSync(command, args, { encoding: "utf8" })
    .trim()
    .split("\n")[0];
}

function versions() {
  console.log(firstLine(process.execPath, ["--version"]));
  console.log(firstLine("ffmpeg", ["-version"]));
}

if (process.argv.includes("--versions")) {
  versions();
  process.exit(0);
}

versions();
console.log(
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    event: "worker.ready",
    region: process.env.RAILWAY_REPLICA_REGION ?? "not-reported",
  }),
);

setInterval(() => undefined, 60_000);
