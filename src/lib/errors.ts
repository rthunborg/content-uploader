import { getHttpStatus, type ErrorCode } from "@/shared/error-codes";
import { logError } from "@/shared/logger";

export type ErrorRemedy = { action: string; next?: string };
export type ErrorEnvelope = {
  error: { code: ErrorCode; message: string; remedy?: ErrorRemedy };
};

const SAFE_MESSAGES: Record<ErrorCode, string> = {
  AUTH_REQUIRED: "Logga in för att fortsätta.", SESSION_REVOKED: "Sessionen har avslutats. Logga in igen.",
  FORBIDDEN: "Du har inte behörighet att göra detta.", ACCOUNT_INACTIVE: "Kontot är pausat.",
  NOT_FOUND: "Det du söker kunde inte hittas.", CONSENT_REQUIRED: "Godkänn de aktuella villkoren för att fortsätta.",
  CONFLICT: "Ändringen kunde inte genomföras på grund av en konflikt.", UPLOAD_INCOMPLETE: "Uppladdningen är inte klar.",
  LINK_EXPIRED: "Länken går inte längre att använda.", FILE_TOO_LARGE: "Filen är för stor.",
  UNSUPPORTED_FILE_TYPE: "Filtypen stöds inte.", VALIDATION_FAILED: "Kontrollera uppgifterna och försök igen.",
  BUDGET_REACHED: "Budgetgränsen är nådd.", RENDITION_FAILED: "Bearbetningen misslyckades.",
  EXPORT_FAILED: "Exporten misslyckades.", INTERNAL_ERROR: "Ett oväntat fel inträffade.",
};

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    _unsafeMessage?: string,
    public readonly remedy?: ErrorRemedy,
  ) {
    super(SAFE_MESSAGES[code]);
    this.name = "DomainError";
  }
}

export function toErrorResponse(
  error: unknown,
  event: string,
): { status: number; body: ErrorEnvelope } {
  if (error instanceof DomainError) {
    return {
      status: getHttpStatus(error.code),
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.remedy ? { remedy: error.remedy } : {}),
        },
      },
    };
  }
  logError(event, error);
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: SAFE_MESSAGES.INTERNAL_ERROR } },
  };
}
