// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import type { AdminProfile } from "../dal/admin";
import { AccountLifecycleForm } from "./account-lifecycle-form";

const profile: AdminProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  fullName: "Anna Andersson",
  email: "anna@example.com",
  mobile: null,
  accountState: "active",
  invitedAt: null,
  lastLoginAt: null,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function setup(overrides: Partial<AdminProfile> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })}>
      <AccountLifecycleForm profile={{ ...profile, ...overrides }} />
    </QueryClientProvider>,
  );
}

describe("AccountLifecycleForm", () => {
  it("requires consequence confirmation before deactivation", async () => {
    let resolve!: (value: unknown) => void;
    const fetchMock = vi.fn(() => new Promise((done) => {
      resolve = done;
    }));
    vi.stubGlobal("fetch", fetchMock);
    setup();

    const button = screen.getByRole("button", { name: "Avaktivera konto" });
    expect(screen.getByText(/avslutar aktiva sessioner/)).toBeTruthy();
    expect(button).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByLabelText(/Jag förstår/));
    expect(button).toHaveProperty("disabled", false);
    const form = button.closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();

    resolve({
      ok: true,
      text: async () => JSON.stringify({
        ...profile,
        accountState: "deactivated",
      }),
    });

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status").textContent).toContain("avaktiverats");
    expect(fetchMock).toHaveBeenCalledWith(`/api/ambassadors/${profile.id}`, expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ action: "deactivate" }),
    }));
  });

  it("reactivates a deactivated account without a confirmation checkbox", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ...profile,
        accountState: "active",
      }),
    }));
    setup({ accountState: "deactivated" });

    expect(screen.queryByLabelText(/Jag förstår/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Återaktivera konto" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status").textContent).toContain("återaktiverats");
    expect(fetch).toHaveBeenCalledWith(`/api/ambassadors/${profile.id}`, expect.objectContaining({
      body: JSON.stringify({ action: "reactivate" }),
    }));
  });

  it("lets admins deactivate invited accounts from the detail surface", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ...profile,
        accountState: "deactivated",
      }),
    }));
    setup({ accountState: "invited" });

    expect(screen.getByText(/avslutar aktiva sessioner/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Jag förstår/));
    fireEvent.click(screen.getByRole("button", { name: "Avaktivera konto" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(`/api/ambassadors/${profile.id}`, expect.objectContaining({
      body: JSON.stringify({ action: "deactivate" }),
    }));
  });

  it("shows server-owned conflict feedback without refreshing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ error: { code: "CONFLICT" } }),
    }));
    setup({ accountState: "deactivated" });

    fireEvent.click(screen.getByRole("button", { name: "Återaktivera konto" }));

    expect(await screen.findByText(/kan inte ändras/)).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps inactive states visible but blocks unsupported client submission", () => {
    setup({ accountState: "inactive_withdrawn" });

    expect(screen.getByText("Kontoåtkomsten kan inte ändras från den här statusen.")).toBeTruthy();
    expect(screen.queryByText(/avslutar aktiva sessioner/)).toBeNull();
    expect(screen.queryByLabelText(/Jag förstår/)).toBeNull();
    expect(screen.getByRole("button", { name: "Kontoåtkomst kan inte ändras" }))
      .toHaveProperty("disabled", true);
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
