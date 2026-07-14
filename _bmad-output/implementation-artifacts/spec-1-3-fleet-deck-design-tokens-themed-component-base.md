---
title: 'Story 1.3: Fleet Deck design tokens & themed component base'
type: 'feature'
created: '2026-07-14'
status: 'done'
baseline_revision: '566cd1d4c74f40c8939b17482954bebbf419e00d'
final_revision: 'c16f1d1df230648c6229b27cd93dd567ae7e795a'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '/mnt/c/stena-content-portal/_bmad-output/project-context.md'
warnings: [oversized]
---

<intent-contract>

## Intent

**Problem:** The scaffold exposes provisional colors and a stock button, but it does not yet provide the locked Fleet Deck typography, layout, loading, status, error, responsive, and accessibility patterns that later screens must inherit.

**Approach:** Lock the semantic CSS-first token layer, self-host Inter, and add small reusable themed primitives and layouts whose tests observe the rendered public surface and accessibility contract.

## Boundaries & Constraints

**Always:** Use only the approved Stena palette; keep page surfaces white and bounded panels beige without beige nesting; preserve 44 px targets, 16 px mobile controls, 2 px focus visibility, reduced-motion behavior, semantic markup, Swedish user copy, and color-independent state communication. Keep shared primitives generic and feature behavior outside `src/components/ui`.

**Block If:** The required Inter woff2 assets cannot be obtained with a verifiable SIL OFL license and committed for same-origin serving, or approved palette pairings cannot meet WCAG AA without changing a locked token.

**Never:** Load fonts from a third-party CDN; introduce green, yellow, dark-mode/off-palette state colors; use red outside destructive/error states; represent selection with Core Blue; show destructive actions outside a confirmation-dialog context; add a spinner; or expose unavailable bulk actions in phone check-in mode.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Delayed load | Content resolves before/after 200 ms | No skeleton before 200 ms; an ambient skeleton appears afterward | Timer is cancelled on resolve/unmount |
| Reduced motion | OS requests reduced motion | Skeleton/celebration remain understandable without animation | Static visual and text/icon meaning remain |
| Narrow admin view | Phone viewport | Single-column check-in content, no bulk controls | Unsupported operations are omitted, not disabled |
| Recoverable failure | What/why/remedy supplied | Swedish, semantic caution panel with primary remedy | Error icon/text accompany color |

</intent-contract>

## Code Map

- `src/app/globals.css`, `src/app/layout.tsx`, `src/app/fonts/` -- CSS-first Fleet Deck tokens, global foundations, and licensed same-origin Inter files.
- `src/components/ui/button.tsx` -- themed action hierarchy and target/focus guarantees.
- `src/components/ui/{soft-error,ambient-status,delayed-skeleton}.tsx` -- reusable feedback/loading patterns.
- `src/components/layout/{ambassador-shell,admin-shell}.tsx` -- phone-first ambassador and responsive admin foundations.
- `src/components/ui/*.test.tsx`, `src/components/layout/*.test.tsx`, `src/app/fleet-deck.test.ts` -- public-surface, timing, and token contract coverage.

## Tasks & Acceptance

**Execution:**
- `src/app/fonts/*`, `src/app/layout.tsx`, `public/fonts/OFL.txt` -- bundle licensed Inter woff2 assets and register them through `next/font/local` so requests remain on the application origin.
- `src/app/globals.css`, `src/app/fleet-deck.test.ts` -- replace placeholders/stock aliases with the locked semantic palette, approved hover/pressed derivations, type/spacing/layout utilities, tabular counts, global focus/reduced-motion/control floors, and source-level assertions excluding reserved/off-palette colors.
- `src/components/ui/button.tsx`, `src/components/ui/button.test.tsx` -- customize the owned shadcn Radix button with primary, secondary, tertiary/link, and dialog-only destructive presentation; ensure all sizes meet 44 px and link uses link blue.
- `src/components/ui/soft-error.tsx`, `src/components/ui/ambient-status.tsx` and tests -- add semantic Swedish-friendly APIs for what/why/remedy error structure and non-spinner status, with icon plus textual state.
- `src/components/ui/delayed-skeleton.tsx` and tests -- implement the 200 ms delayed skeleton with cleanup, `aria-hidden` presentation, and a non-animated reduced-motion state.
- `src/components/layout/ambassador-shell.tsx`, `src/components/layout/admin-shell.tsx` and tests -- establish 16 px phone margins and bottom-anchored ambassador CTA plus 12-column, 1440 px, 256 px-rail admin layout; render bulk actions only at supported tablet/desktop breakpoints.

**Acceptance Criteria:**
- Given the application stylesheet and root layout, when the production UI loads, then exact semantic roles use White `#ffffff`, Beige `#eae3d2`, Black `#1a1a1a`, Core Blue `#034592`, Link/Focus `#3344dd`, Light Blue `#cbe1f6`, Core Red `#e41f1f`, and Pink `#fbd4cd`; celebration and star resolve to approved blue roles, reserved green/yellow are absent, selection remains Light Blue, and Inter is served from the app origin under SIL OFL.
- Given any shared interactive primitive, when it is focused, pressed, disabled, or viewed on a phone, then it exposes a visible 2 px focus ring, approved 8–12% hover/pressed derivation, non-color state meaning, a target at least 44 px, and controls use at least 16 px text.
- Given an ambassador surface, when rendered from phone upward, then it remains a single column with 16 px phone margins and its sole primary CTA anchors at the bottom without covering content.
- Given an admin surface, when rendered at desktop and phone widths, then desktop uses a compact 12-column container capped at 1440 px with a 256 px rail, while phone check-in mode is single-column and omits bulk controls.
- Given delayed work, recoverable failure, ambient progress, or celebration, when the corresponding primitive renders, then no spinner appears, skeletons wait 200 ms, errors communicate what/why/remedy on Pink, and reduced-motion users receive an equivalent static, icon-and-text state.
- Given the component and token suites run, when rendered output and computed contracts are inspected, then brand AA pairings, Swedish example copy, sentence case, tabular counts, semantic roles, keyboard operation, and timing cleanup are verified at the outer component/CSS surface.

## Spec Change Log

## Review Triage Log

### 2026-07-14 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 9: (high 2, medium 7, low 0)
- defer: 0
- reject: 12: (high 0, medium 5, low 7)
- addressed_findings:
  - `[high]` `[patch]` Scoped legacy global button rules so they cannot override Fleet Deck component variants, and added cascade-sensitive verification.
  - `[high]` `[patch]` Replaced the static Inter Regular file falsely declared as 100–900 with a licensed variable font and verified its weight axis.
  - `[medium]` `[patch]` Restored color-independent pressed movement with a reduced-motion override.
  - `[medium]` `[patch]` Prevented pointer and keyboard activation of disabled slotted links and added mounted behavioral coverage.
  - `[medium]` `[patch]` Added phone safe-area padding to the ambassador CTA region.
  - `[medium]` `[patch]` Allocated an explicit 256 px admin rail without grid-column overflow.
  - `[medium]` `[patch]` Replaced helper/source-only skeleton checks with mounted 199/200 ms, rerender, and unmount lifecycle tests.
  - `[medium]` `[patch]` Strengthened token tests to prove exact semantic mappings, reserved-color exclusion, and truthful font metadata.
  - `[medium]` `[patch]` Added rendered DOM and emitted-CSS guardrails for button and responsive layout behavior within the currently navigable application surface.

### 2026-07-14 — Review pass 2 (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 1, medium 0, low 1)
- defer: 1
- reject: 16: (high 0, medium 3, low 13)
- addressed_findings:
  - `[high]` `[patch]` Self-hosted Inter was loaded but never rendered: `--font-inter` was applied on `<body>` (`layout.tsx`) while `globals.css` consumes it on the parent `<html>`, and CSS custom properties inherit downward only, so `html`'s `font-family` resolved to the Arial fallback and the entire app rendered in Arial. All four review layers flagged it independently and it was confirmed against the files. Moved `inter.variable` to `<html>` and added a source-linkage assertion in `fleet-deck.test.ts` tying the variable's host element to its CSS consumer so a green suite can no longer hide this regression.
  - `[low]` `[patch]` Pinned the five newly-added dev dependencies (`@testing-library/dom` 10.4.1, `@testing-library/react` 16.3.2, `@types/fontkit` 2.0.8, `fontkit` 2.0.4, `jsdom` 29.1.1) to exact versions, matching the repo's established exact-pin convention; resolved versions were already identical so the lockfile was unchanged.

### 2026-07-14 — Review pass 3 (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 1
- reject: 22: (high 0, medium 6, low 16)
- addressed_findings:
  - none

## Design Notes

The design layer should expose semantic intent rather than raw brand names: selection and information may share Light Blue, but Core Blue remains the primary/star mark and link/focus retains its distinct link blue. Destructive styling is available only through an explicitly named dialog action variant so ordinary views do not accidentally normalize red actions.

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test && npm run build` -- expected: all static, component, timing, and production font/build gates pass.
- `git diff --check && rg -n '#1c5e38|#feca3a|green|yellow|animate-spin|border-spinner' src` -- expected: clean diff and no reserved colors or spinner patterns in the themed surface.

## Auto Run Result

Status: done

Summary: Locked the Fleet Deck semantic design system, self-hosted licensed variable Inter, and added accessible action, feedback, loading, ambassador, and admin layout primitives. The implementation was hardened through four independent review layers and a consolidated patch pass.

Files changed:
- `package.json`, `package-lock.json` — add DOM/component and variable-font metadata test support.
- `src/app/globals.css`, `src/app/layout.tsx`, `src/app/fonts/inter-variable.woff2`, `public/fonts/OFL.txt` — define locked tokens/foundations and serve truthful licensed Inter from the application origin.
- `src/app/fleet-deck.test.ts` — verify exact token mappings, AA pairings, exclusions, font axes, focus/control/motion contracts, and cascade safety.
- `src/components/ui/button.tsx` and test — provide themed hierarchy, 44 px controls, focus/pressed behavior, and disabled slotted-link semantics.
- `src/components/ui/{soft-error,ambient-status,delayed-skeleton}.tsx` and tests — provide semantic remedy-led errors, non-spinner status, and lifecycle-tested delayed skeletons.
- `src/components/layout/{ambassador-shell,admin-shell}.tsx` and tests — provide safe-area-aware phone CTA layout and non-overflowing responsive admin foundations.

Review findings breakdown: patch 9 (high 2, medium 7, low 0); defer 0; reject 12 (high 0, medium 5, low 7). Follow-up review recommendation: true because high-severity patches were applied; medium/low score is `3 × 7 + 0 = 21`.

Verification performed: `npm run typecheck`, `npm run lint`, `npm test` (118 passed, 5 environment-dependent database tests skipped), and `npm run build` all passed. `git diff --check` passed with WSL line-ending notices only; the reserved-color/spinner scan returned no matches. Every edge-case matrix row is covered by an executed component or layout test.

Residual risk: responsive geometry and focus visuals are guarded through rendered DOM, generated classes, source cascade rules, and emitted production CSS rather than screenshot/measured browser tests because these primitives are not yet mounted on navigable feature pages.

### Follow-up review pass (2026-07-14)

Summary: A fresh four-layer review of the committed story 1.3 change (blind adversarial, edge-case, verification-gap, and intent-alignment auditors) surfaced one high-severity, load-bearing defect that all layers converged on independently: the self-hosted Inter face was loaded but never applied, because its `--font-inter` variable was bound on `<body>` while the sole consuming rule sits on the parent `<html>`. Under CSS's downward-only custom-property inheritance, every surface silently fell back to Arial — the story's headline deliverable was inert in production. This was patched (variable moved to `<html>`) and the token suite was strengthened with a linkage assertion so the same class of bug cannot pass green again. Dependency pins were normalized to the repo convention. The broader "tests observe source strings/class names rather than the computed rendered surface" pattern — the gap that let the font bug through — was deferred to the ledger for browser-level (Playwright) verification once these primitives are mounted on navigable feature pages, matching the previously recorded residual risk.

Files changed in this pass:
- `src/app/layout.tsx` — apply `inter.variable` on `<html>` (the element whose `font-family` consumes `--font-inter`) instead of `<body>`, so Inter actually renders.
- `src/app/fleet-deck.test.ts` — assert the font variable is hosted on the same element (`<html>`) that consumes it in `globals.css`, closing the silent-regression hole.
- `package.json` — pin the five new dev dependencies to exact versions per repo convention (lockfile unchanged).

Review findings breakdown: patch 2 (high 1, medium 0, low 1); defer 1; reject 16 (high 0, medium 3, low 13). Follow-up review recommendation: true — a high-severity finding was patched. Patched-severity score: `3 × 0 (medium) + 1 × 1 (low) = 1`, but the high-severity patch alone sets the recommendation to true.

Verification performed: `npm run typecheck`, `npm run lint`, `npm test` (118 passed, 5 environment-dependent database tests skipped, including the new font-linkage assertion), and `npm run build` all passed. `git diff --check` passed with WSL line-ending notices only; the reserved-color/spinner scan (`grep -rniE '#1c5e38|#feca3a|green|yellow|animate-spin|border-spinner' src`) returned no matches.

Residual risk: unchanged from above — the primitives' computed-style and phone-viewport behaviors remain guarded by static/class-string assertions rather than a real layout engine until a feature screen mounts them (now tracked in the deferred-work ledger).

### Follow-up review pass 3 (2026-07-14)

Summary: A third independent four-layer review (blind adversarial, edge-case, verification-gap, and intent-alignment auditors) of the already-committed story 1.3 change produced no `intent_gap`, no `bad_spec`, and no `patch` findings — the story stands as shipped. One new, confidently-real accessibility gap was deferred; the remaining findings were rejected as already-tracked, pre-existing, cosmetic, defensible design boundaries, or speculative. No code was changed in this pass.

Findings breakdown: intent_gap 0; bad_spec 0; patch 0; defer 1; reject 22 (high 0, medium 6, low 16). Follow-up review recommendation: false — zero patched findings this pass (no high patch; score `3 × 0 + 1 × 0 = 0`).

Deferred (new ledger entry): the `dialogDestructive` variant pairs white on Core Red `#e41f1f` at ~4.48:1, marginally below the 4.5:1 normal-text AA floor for its 16 px semibold label, and no approved palette foreground clears AA on Core Red. Deferred rather than blocked because the variant is dialog-only per intent and is not yet mounted, so no user is currently affected; resolution belongs to the story that first builds a destructive confirmation dialog.

Rejected (representative): the "tests assert on source strings / Tailwind class names rather than the computed rendered surface" pattern surfaced by three of the four layers is already tracked in the deferred-work ledger (from review pass 2) and was not re-added. The `button.test.tsx` keyboard-activation assertion is vacuous under jsdom, but the disabled-activation guard it nominally covers is already verified by the pointer-click assertion (`fireEvent.click(link)` returns `false`, proving `onClickCapture` cancels the event) and holds in a real browser where Enter on a focused anchor dispatches the same cancellable click — so no real behavior is unverified. The global `button:not([data-slot="button"])` base rule and the leftover `.auth-*`/element styles are pre-existing (the prior stylesheet styled all bare buttons even more broadly); the sticky ambassador footer reserves layout space (it is `sticky`, not `fixed`) so it does not overlap content; the remaining items (AmbientStatus `children: string`, redundant `role`+`aria-live`, duplicated 256 px rail width, nominal 12-column wrapper, anchor-case event typing, OFL file placement, `focus-visible` element scope, `tnum` opt-in, NaN `lines` misuse) are cosmetic, defensible, or require caller misuse.

Verification performed: no code changed this pass, so the previously-recorded green gates (`npm run typecheck`, `npm run lint`, `npm test` — 118 passed/5 DB-skipped, `npm run build`) remain authoritative for the reviewed revision. This pass committed only the review record (this spec's triage log and Auto Run Result, and the new deferred-work ledger entry).

Residual risk: unchanged — computed-style/phone-viewport behavior remains guarded by static assertions (tracked in the ledger), and the dialog-only white-on-Core-Red AA gap is now tracked for the story that mounts a destructive dialog.
