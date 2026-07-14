import { beforeEach, describe, expect, it, vi } from "vitest";
const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock("@/shared/logger", () => ({ logError }));
import { DomainError, toErrorResponse } from "./errors";
describe("error boundary", () => {
  beforeEach(() => vi.clearAllMocks());
  it("maps domain errors through the safe catalog without logging", () => {
    const response = toErrorResponse(new DomainError("CONSENT_REQUIRED", "raw database/provider detail"), "event");
    expect(response).toEqual({ status: 409, body: { error: { code: "CONSENT_REQUIRED", message: "Godkänn de aktuella villkoren för att fortsätta." } } });
    expect(JSON.stringify(response)).not.toContain("database/provider");
    expect(logError).not.toHaveBeenCalled();
  });
  it("logs unexpected errors once under the generic internal code", () => {
    expect(toErrorResponse(new Error("secret"), "event")).toMatchObject({ status: 500, body: { error: { code: "INTERNAL_ERROR" } } });
    expect(logError).toHaveBeenCalledOnce();
  });
});
