import { describe, expect, it } from "vitest";

import { safeContinuation } from "./continuation";

describe("safeContinuation", () => {
  it.each([
    ["/", "/"],
    ["/tasks?filter=open", "/tasks?filter=open"],
    ["/admin/library#asset", "/admin/library#asset"],
    ["/my-uploads", "/my-uploads"],
  ])("accepts allow-listed relative paths", (value, expected) => {
    expect(safeContinuation(value)).toBe(expected);
  });

  it.each([
    null,
    "",
    "https://evil.example/tasks",
    "//evil.example/tasks",
    "/\\\\evil.example/tasks",
    "/auth/login",
    "/unknown",
  ])("falls back to root for unsafe or unknown input: %s", (value) => {
    expect(safeContinuation(value)).toBe("/");
  });
});
