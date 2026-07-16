import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { publishTerms } from "../src/features/consent/dal/terms.ts";

export async function publishTermsFile(path: string) { const manifest: unknown = JSON.parse(await readFile(path, "utf8")); return publishTerms(manifest); }
async function main() { const path = process.argv[2]; if (!path) throw new Error("Usage: npm run publish-terms -- <manifest.json>"); const result = await publishTermsFile(path); process.stdout.write(`${result.id}\n`); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "Terms publication failed"}\n`); process.exitCode = 1; });
