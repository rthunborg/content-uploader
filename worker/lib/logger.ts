import { initializeLogger, logCritical, logError } from "../../src/shared/logger.ts";

export function initializeWorkerLogger() {
  initializeLogger();
}

export { logCritical, logError };
