import { describe, expect, it } from "vitest";

import { ERROR_HTTP_STATUS } from "./error-codes";

describe("ERROR_HTTP_STATUS", () => {
  it("maps every canonical domain error to its HTTP status", () => {
    expect(ERROR_HTTP_STATUS).toEqual({
      AUTH_REQUIRED: 401,
      SESSION_REVOKED: 401,
      FORBIDDEN: 403,
      ACCOUNT_INACTIVE: 403,
      NOT_FOUND: 404,
      CONSENT_REQUIRED: 409,
      CONFLICT: 409,
      UPLOAD_INCOMPLETE: 409,
      LINK_EXPIRED: 410,
      FILE_TOO_LARGE: 413,
      UNSUPPORTED_FILE_TYPE: 415,
      VALIDATION_FAILED: 422,
      BUDGET_REACHED: 429,
      RENDITION_FAILED: 500,
      EXPORT_FAILED: 500,
      INTERNAL_ERROR: 500,
    });
  });
});
