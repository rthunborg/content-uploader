/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsentCardStack } from "./consent-card-stack";
import type { TermsManifest } from "../dal/terms";

const terms: TermsManifest = { schemaVersion: 1, version: "1.0.0", locale: "sv-SE", cards: [
  { id: "content_usage" as const, title: "Exakt rubrik ett", body: "Exakt brödtext ett", legalTextMarkdown: "Juridisk text ett" },
  { id: "bystander_consent" as const, title: "Exakt rubrik två", body: "Exakt brödtext två", legalTextMarkdown: "Juridisk text två" },
  { id: "user_control" as const, title: "Exakt rubrik tre", body: "Exakt brödtext tre", legalTextMarkdown: "Juridisk text tre" },
] };
const termsEvidence = { termsVersionId: "00000000-0000-4000-8000-000000000002", termsPayloadSha256: "a".repeat(64) };
afterEach(cleanup);

describe("ConsentCardStack", () => {
  it("shows one verbatim card at a time with text progress and deterministic focus", () => {
    render(<ConsentCardStack terms={terms} {...termsEvidence} next="/tasks" action={vi.fn()} />);
    expect(screen.getByRole("heading", { name: terms.cards[0].title })).toBeTruthy();
    expect(screen.getByText(terms.cards[0].body)).toBeTruthy();
    expect(screen.queryByText(terms.cards[1].body)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Godkänn och fortsätt" }));
    expect(screen.getByRole("heading", { name: terms.cards[1].title })).toBe(document.activeElement);
    expect(screen.getAllByText("Del 2 av 3").length).toBeGreaterThan(0);
  });

  it("does not skip a card when the advance control receives rapid duplicate clicks", () => {
    vi.useFakeTimers();
    try {
      const action = vi.fn();
      render(<ConsentCardStack terms={terms} {...termsEvidence} next="/tasks" action={action} />);
      const originalAdvance = screen.getByRole("button", { name: "Godkänn och fortsätt" });
      fireEvent.click(originalAdvance);
      fireEvent.click(originalAdvance);
      const newlyRenderedAdvance = screen.getByRole("button", { name: "Godkänn och fortsätt" });
      expect(newlyRenderedAdvance.hasAttribute("disabled")).toBe(true);
      fireEvent.click(newlyRenderedAdvance);
      expect(screen.getByRole("heading", { name: terms.cards[1].title })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: terms.cards[2].title })).toBeNull();
      act(() => vi.advanceTimersByTime(500));
      fireEvent.click(screen.getByRole("button", { name: "Godkänn och fortsätt" }));
      expect(screen.getByRole("heading", { name: terms.cards[2].title })).toBeTruthy();
      const finish = screen.getByRole("button", { name: "Godkänn och aktivera konto" });
      expect(document.querySelector<HTMLInputElement>('input[name="termsVersionId"]')?.value).toBe(termsEvidence.termsVersionId);
      expect(document.querySelector<HTMLInputElement>('input[name="termsPayloadSha256"]')?.value).toBe(termsEvidence.termsPayloadSha256);
      expect(finish.hasAttribute("disabled")).toBe(true);
      fireEvent.click(finish);
      expect(action).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(500));
      expect(finish.hasAttribute("disabled")).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it("opens legal text in a labelled modal and restores focus when closed", async () => {
    render(<ConsentCardStack terms={terms} {...termsEvidence} next="/tasks" action={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Läs hela villkorstexten" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Juridisk text ett")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stäng" }));
    await waitFor(() => expect(trigger).toBe(document.activeElement));
  });

  it("offers decline only on the final card with a 44px secondary target", async () => {
    render(<ConsentCardStack terms={terms} {...termsEvidence} next="/tasks" action={vi.fn()} declineAction={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Pausa mitt konto" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Godkänn och fortsätt" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Godkänn och fortsätt" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Godkänn och fortsätt" }));
    expect(screen.getByRole("button", { name: "Pausa mitt konto" }).className).toContain("min-h-11");
  });

  it("announces re-acceptance and marks every changed card with text and styling", async () => {
    render(<ConsentCardStack terms={terms} {...termsEvidence} next="/upload/deep?task=1" action={vi.fn()} mode="reaccept" changedCardIds={["content_usage", "bystander_consent"]} />);
    expect(screen.getByRole("status").textContent).toContain("Villkoren har ändrats");
    expect(screen.getByText("Ändrad sedan ditt senaste godkännande")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Godkänn och fortsätt" }));
    expect(screen.getByText("Ändrad sedan ditt senaste godkännande")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Godkänn och fortsätt" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Godkänn och fortsätt" }));
    expect(screen.queryByText("Ändrad sedan ditt senaste godkännande")).toBeNull();
    expect(screen.getByRole("button", { name: "Godkänn uppdaterade villkor" })).toBeTruthy();
  });

  it("uses generic changed-terms guidance when prior evidence cannot support precise markers", () => {
    render(<ConsentCardStack terms={terms} {...termsEvidence} next="/tasks" action={vi.fn()} mode="reaccept" changedCardIds={null} />);
    expect(screen.getByRole("status").textContent).toContain("Läs igenom alla delar");
    expect(screen.queryByText("Ändrad sedan ditt senaste godkännande")).toBeNull();
  });

  it("uses generic changed-terms guidance when a new version has no identifiable card changes", () => {
    render(<ConsentCardStack terms={terms} {...termsEvidence} next="/tasks" action={vi.fn()} mode="reaccept" changedCardIds={[]} />);
    expect(screen.getByRole("status").textContent).toContain("Läs igenom alla delar");
    expect(screen.getByRole("status").textContent).not.toContain("markerade");
    expect(screen.queryByText("Ändrad sedan ditt senaste godkännande")).toBeNull();
  });
});
