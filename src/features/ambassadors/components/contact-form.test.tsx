// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import type { AdminProfile } from "../dal/admin";
import { ContactForm } from "./contact-form";

const profile = {
  id: "00000000-0000-4000-8000-000000000001",
  fullName: "Anna Andersson",
  email: "anna@example.com",
  mobile: "+46 70 123 45 67",
  accountState: "active" as const,
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
      <ContactForm profile={{ ...profile, ...overrides }} />
    </QueryClientProvider>,
  );
}

function fillValid() {
  fireEvent.change(screen.getByLabelText("Fullständigt namn"), {
    target: { value: "  Anna Ny  " },
  });
  fireEvent.change(screen.getByLabelText("E-post"), {
    target: { value: " ANNA.NY@EXAMPLE.COM " },
  });
  fireEvent.change(screen.getByLabelText("Mobil (valfritt)"), {
    target: { value: "" },
  });
}

describe("ContactForm", () => {
  it("prefills every contact value and makes the no-HR admin duty visible", () => {
    setup();

    expect(screen.getByLabelText("Fullständigt namn")).toHaveProperty("value", "Anna Andersson");
    expect(screen.getByLabelText("E-post")).toHaveProperty("value", "anna@example.com");
    expect(screen.getByLabelText("Mobil (valfritt)")).toHaveProperty("value", "+46 70 123 45 67");
    expect(screen.getByText(/är inte kopplad till något HR-system/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Spara kontaktuppgifter" }).className).toContain("min-h-11");
  });

  it("validates on blur and focuses the first invalid field on submit", async () => {
    setup({ fullName: null, mobile: null });
    const name = screen.getByLabelText("Fullständigt namn");

    fireEvent.blur(name);
    expect(await screen.findByText("Fältet måste fyllas i.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("E-post"), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: "Spara kontaktuppgifter" }));

    await waitFor(() => expect(document.activeElement).toBe(name));
  });

  it("retains all entered values and focuses the first server-invalid field", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({
        error: {
          code: "VALIDATION_FAILED",
          fields: {
            email: "Ange en giltig e-postadress.",
            mobile: "Ange ett giltigt mobilnummer.",
          },
        },
      }),
    }));
    setup();
    fillValid();

    fireEvent.click(screen.getByRole("button", { name: "Spara kontaktuppgifter" }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("E-post")));
    expect(screen.getByText("Ange en giltig e-postadress.")).toBeTruthy();
    expect(screen.getByLabelText("Fullständigt namn")).toHaveProperty("value", "  Anna Ny  ");
    expect(screen.getByLabelText("E-post")).toHaveProperty("value", "ANNA.NY@EXAMPLE.COM");
    expect(screen.getByLabelText("Mobil (valfritt)")).toHaveProperty("value", "");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("deduplicates pending submission and refreshes only after an acknowledged profile", async () => {
    let resolve!: (value: unknown) => void;
    const fetchMock = vi.fn(() => new Promise((done) => {
      resolve = done;
    }));
    vi.stubGlobal("fetch", fetchMock);
    setup();
    fillValid();

    const form = screen.getByRole("button", { name: "Spara kontaktuppgifter" }).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();

    resolve({
      ok: true,
      text: async () => JSON.stringify({
        ...profile,
        fullName: "Anna Ny",
        email: "anna.ny@example.com",
        mobile: null,
      }),
    });

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status").textContent).toContain("Kontaktuppgifterna har sparats");
    expect(screen.getByLabelText("Fullständigt namn")).toHaveProperty("value", "Anna Ny");
    expect(screen.getByLabelText("E-post")).toHaveProperty("value", "anna.ny@example.com");
    expect(fetchMock).toHaveBeenCalledWith(`/api/ambassadors/${profile.id}`, expect.objectContaining({
      method: "PATCH",
    }));
  });

  it("shows conflict feedback without clearing values or refreshing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ error: { code: "CONFLICT" } }),
    }));
    setup();
    fillValid();

    fireEvent.click(screen.getByRole("button", { name: "Spara kontaktuppgifter" }));

    expect(await screen.findByText(/redan av ett annat konto/)).toBeTruthy();
    expect(screen.getByLabelText("E-post")).toHaveProperty("value", "ANNA.NY@EXAMPLE.COM");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("handles malformed server responses safely and clears settled status after editing", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        text: async () => "gateway html",
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          ...profile,
          fullName: "Anna Ny",
          email: "anna.ny@example.com",
          mobile: null,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    setup();
    fillValid();

    fireEvent.click(screen.getByRole("button", { name: "Spara kontaktuppgifter" }));
    expect(await screen.findByText(/kunde inte sparas/)).toBeTruthy();
    expect(screen.getByLabelText("Fullständigt namn")).toHaveProperty("value", "  Anna Ny  ");

    fireEvent.click(screen.getByRole("button", { name: "Spara kontaktuppgifter" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("har sparats"));
    fireEvent.change(screen.getByLabelText("Fullständigt namn"), { target: { value: "Bo" } });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(""));
  });

  it("renders only string messages from the server field envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({
        error: {
          code: "VALIDATION_FAILED",
          fields: {
            fullName: { message: "must not render" },
            email: "Server email message",
            mobile: 42,
            accountState: "must not be accepted",
          },
        },
      }),
    }));
    setup();
    fillValid();

    fireEvent.click(screen.getByRole("button", { name: "Spara kontaktuppgifter" }));

    expect(await screen.findByText("Server email message")).toBeTruthy();
    expect(screen.queryByText("must not render")).toBeNull();
    expect(screen.queryByText("must not be accepted")).toBeNull();
    expect(screen.getByLabelText("Fullständigt namn").getAttribute("aria-invalid")).toBe("false");
    expect(screen.getByLabelText("Mobil (valfritt)").getAttribute("aria-invalid")).toBe("false");
  });
});
