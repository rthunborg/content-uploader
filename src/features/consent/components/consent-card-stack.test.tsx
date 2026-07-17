/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsentCardStack } from "./consent-card-stack";
import type { TermsManifest } from "../dal/terms";

const terms: TermsManifest = { schemaVersion: 1, version: "1.0.0", locale: "sv-SE", cards: [
  { id: "content_usage" as const, title: "Exakt rubrik ett", body: "Exakt brödtext ett", legalTextMarkdown: "Juridisk text ett" },
  { id: "bystander_consent" as const, title: "Exakt rubrik två", body: "Exakt brödtext två", legalTextMarkdown: "Juridisk text två" },
  { id: "user_control" as const, title: "Exakt rubrik tre", body: "Exakt brödtext tre", legalTextMarkdown: "Juridisk text tre" },
] };
afterEach(cleanup);

describe("ConsentCardStack", () => {
  it("shows one verbatim card at a time with text progress and deterministic focus", () => {
    render(<ConsentCardStack terms={terms} next="/tasks" action={vi.fn()} />);
    expect(screen.getByRole("heading", { name: terms.cards[0].title })).toBeTruthy();
    expect(screen.getByText(terms.cards[0].body)).toBeTruthy();
    expect(screen.queryByText(terms.cards[1].body)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Godkänn och fortsätt" }));
    expect(screen.getByRole("heading", { name: terms.cards[1].title })).toBe(document.activeElement);
    expect(screen.getAllByText("Del 2 av 3").length).toBeGreaterThan(0);
  });

  it("opens legal text in a labelled modal and restores focus when closed", async () => {
    render(<ConsentCardStack terms={terms} next="/tasks" action={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Läs hela villkorstexten" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Juridisk text ett")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stäng" }));
    await waitFor(() => expect(trigger).toBe(document.activeElement));
  });
});
