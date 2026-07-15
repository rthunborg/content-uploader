import { initializeLogger } from "@/shared/logger";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") initializeLogger();
}
