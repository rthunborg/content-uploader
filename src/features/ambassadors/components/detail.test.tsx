// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import type { AdminProfile } from "../dal/admin";
import { AmbassadorDetail } from "./detail";

const anna: AdminProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  fullName: "Anna Andersson",
  email: "anna@example.com",
  mobile: null,
  accountState: "active",
  invitedAt: null,
  lastLoginAt: null,
};
const bo: AdminProfile = {
  ...anna,
  id: "00000000-0000-4000-8000-000000000002",
  fullName: "Bo Bengtsson",
  email: "bo@example.com",
  mobile: "+46 70 222 22 22",
};

afterEach(cleanup);

function detail(profile: AdminProfile) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <AmbassadorDetail profile={profile} />
    </QueryClientProvider>
  );
}

describe("AmbassadorDetail", () => {
  it("keeps the persisted read view and exposes the prefilled admin edit surface", () => {
    render(detail(anna));

    expect(screen.getByRole("heading", { level: 1, name: "Anna Andersson" })).toBeTruthy();
    expect(screen.getByText("anna@example.com")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Redigera kontaktuppgifter" })).toBeTruthy();
    expect(screen.getByLabelText("Fullständigt namn")).toHaveProperty("value", "Anna Andersson");
    expect(screen.getByLabelText("E-post")).toHaveProperty("value", "anna@example.com");
    expect(screen.getByText(/HR-system/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Spara kontaktuppgifter" }).className)
      .toContain("min-h-11");
  });

  it("remounts the contact form when the routed ambassador changes", () => {
    const rendered = render(detail(anna));
    fireEvent.change(screen.getByLabelText("Fullständigt namn"), {
      target: { value: "Unsaved Anna draft" },
    });
    expect(screen.getByLabelText("Fullständigt namn")).toHaveProperty(
      "value",
      "Unsaved Anna draft",
    );

    rendered.rerender(detail(bo));

    expect(screen.getByLabelText("Fullständigt namn")).toHaveProperty("value", "Bo Bengtsson");
    expect(screen.getByLabelText("E-post")).toHaveProperty("value", "bo@example.com");
    expect(screen.getByLabelText("Mobil (valfritt)")).toHaveProperty(
      "value",
      "+46 70 222 22 22",
    );
  });
});
