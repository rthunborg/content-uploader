// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import type { AdminProfile } from "../dal/admin";
import { DeleteAccountForm } from "./delete-account-form";

const profile: AdminProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  fullName: "Anna Andersson",
  email: "anna@example.com",
  mobile: null,
  accountState: "active",
  invitedAt: null,
  lastLoginAt: null,
};

function renderForm() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <DeleteAccountForm profile={profile} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  replace.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DeleteAccountForm", () => {
  it("states the retained scope and requires deliberate confirmation", () => {
    renderForm();
    expect(screen.getByText(/Uppladdningar och dokumenterad villkorsacceptans finns kvar/)).toBeTruthy();
    const submit = screen.getByRole("button", { name: "Ta bort kontopost" });
    expect(submit).toHaveProperty("disabled", true);
    expect(submit.className).toContain("min-h-11");
    fireEvent.click(screen.getByLabelText(/tas bort permanent/));
    expect(submit).toHaveProperty("disabled", false);
  });

  it("deduplicates submission and navigates only after exact server acknowledgement", async () => {
    let resolveResponse!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => { resolveResponse = resolve; }));
    renderForm();
    fireEvent.click(screen.getByLabelText(/tas bort permanent/));
    const submit = screen.getByRole("button", { name: "Ta bort kontopost" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(replace).not.toHaveBeenCalled();
    resolveResponse(new Response(JSON.stringify({ id: profile.id, deleted: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/ambassadors"));
  });

  it("keeps the user in place and announces safe server failures", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: { code: "INTERNAL_ERROR" },
    }), { status: 500 }));
    renderForm();
    fireEvent.click(screen.getByLabelText(/tas bort permanent/));
    fireEvent.click(screen.getByRole("button", { name: "Ta bort kontopost" }));
    expect(await screen.findByText(/kunde inte tas bort/)).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("rejects malformed success acknowledgements without navigating", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      id: "00000000-0000-4000-8000-000000000099",
      deleted: true,
    }), { status: 200 }));
    renderForm();
    fireEvent.click(screen.getByLabelText(/tas bort permanent/));
    fireEvent.click(screen.getByRole("button", { name: "Ta bort kontopost" }));
    expect(await screen.findByText(/kunde inte tas bort/)).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("announces when the account was already removed", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: { code: "NOT_FOUND" },
    }), { status: 404 }));
    renderForm();
    fireEvent.click(screen.getByLabelText(/tas bort permanent/));
    fireEvent.click(screen.getByRole("button", { name: "Ta bort kontopost" }));
    expect(await screen.findByText("Ambassadören finns inte längre.")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});
