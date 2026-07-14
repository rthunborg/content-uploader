type LogContext = Record<string, unknown>;

const SENSITIVE_KEY =
  /(?:authorization|cookie|pass(?:word|phrase)|secret|token|api[-_]?key|private[-_]?key|dsn)/i;
const SECRET_VALUE =
  /(?:Bearer\s+\S+|sb_secret_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@)/gi;

function sanitizeString(value: string) {
  return value.replace(SECRET_VALUE, "[REDACTED]");
}

function serializable(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (typeof value === "string") return sanitizeString(value);
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined") return null;
  if (typeof value === "function" || typeof value === "symbol") {
    return String(value);
  }
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item) => serializable(item, seen));
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[REDACTED]" : serializable(nested, seen),
      ]),
    );
  } catch {
    return "[UNSERIALIZABLE]";
  }
}

function errorPayload(error: unknown) {
  try {
    return error instanceof Error
      ? {
          name: sanitizeString(error.name),
          message: sanitizeString(error.message),
          ...(error.stack ? { stack: sanitizeString(error.stack) } : {}),
          ...(error.cause === undefined
            ? {}
            : { cause: serializable(error.cause) }),
        }
      : { value: serializable(error) };
  } catch {
    return { value: "[UNSERIALIZABLE]" };
  }
}

function write(
  level: "error" | "critical",
  event: string,
  error: unknown,
  context: LogContext,
) {
  try {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        event: sanitizeString(String(event)),
        error: errorPayload(error),
        context: serializable(context),
      }),
    );
  } catch {
    try {
      console.error('{"level":"error","event":"logger.serialization_failed"}');
    } catch {
      // Logging must never interrupt the application path.
    }
  }
}

export function logError(
  event: string,
  error: unknown,
  context: LogContext = {},
) {
  write("error", event, error, context);
}

export function logCritical(
  event: string,
  error: unknown,
  context: LogContext = {},
) {
  write("critical", event, error, context);
}
