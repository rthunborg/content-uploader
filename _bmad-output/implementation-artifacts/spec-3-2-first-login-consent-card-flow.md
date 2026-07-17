---
title: 'Story 3.2: First-login consent card flow'
type: 'feature'
created: '2026-07-17'
status: 'done'
baseline_revision: 768adffe9c646eb6012663fbc6524a9ebe2314a4
final_revision: 9eba99260bc4a2f188d6a1655fdb77e8c56a578f
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/consent-cards.md'
warnings:
  - oversized
---

<intent-contract>

## Intent

**Problem:** Invited ambassadors reach a consent route that has no UI, and the existing acceptance seam records evidence without atomically activating the profile. First login therefore cannot complete the compliance-gated onboarding journey.

**Approach:** Render the current published Swedish terms as an accessible three-card server-backed flow, then atomically append acceptance evidence, emit its audit event, activate the invited profile, and continue to the protected task-list landing.

## Boundaries & Constraints

**Always:** Render card title, body, order, and legal text from the immutable current `terms_versions.payload`; sanitize `next` on both page load and submission; use `requireUserPreConsent()` before consent reads or writes; commit acceptance, audit, `active` state, and `first_accepted_at` in one transaction; make final submission idempotent; keep acceptance server-acknowledged and use Swedish centralized interface copy. Preserve keyboard focus, announce card position, restore focus after the modal sheet, retain ≥44 px controls, and meet WCAG AA.

**Block If:** No current complete published terms exist at runtime, cryptographic configuration is invalid, or the authenticated ambassador lacks the authoritative complete identity needed for evidence. Fail closed with a safe Swedish recovery surface; never fabricate legal content or partially activate the account.

**Never:** Hard-code or rewrite approved card content in React, accept a client-supplied terms version, trust an unsanitized continuation, persist one acceptance per card, activate outside the evidence transaction, add decline/re-accept behavior from Stories 3.3/3.4, expose provider/database errors, or implement Epic 5 task functionality beyond its protected empty landing shell.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First login | Invited ambassador and complete current terms | Show one of three ordered cards, runtime copy, progress, and legal sheet | Missing/incomplete terms show a safe retry/contact surface and write nothing |
| Final agreement | Invited ambassador agrees to all cards | One transaction appends evidence/audit, activates profile, sets first acceptance time, then redirects to sanitized `next` (default `/tasks`) | Any transaction failure rolls back every effect and keeps the user on consent with a safe message |
| Replayed submission | Same user/current terms submitted twice or concurrently | Return idempotent success with exactly one current acceptance and preserved first timestamp | Do not append duplicate evidence or duplicate audit events |
| Invalid continuation | External, protocol-relative, or disallowed `next` | Use `/tasks` | Never redirect outside the allow-list |
| Keyboard/legal detail | User advances cards and opens/closes legal text | Position is announced, focus follows the active card, sheet traps focus and restores it | Escape/close returns focus without advancing or accepting |

</intent-contract>

## Code Map

- `src/features/consent/dal/acceptance.ts` -- global evidence-chain transaction; extend it with atomic first-login activation and replay handling.
- `src/features/consent/dal/pre-consent.ts` -- authenticated allow-listed facade for current terms and final acceptance.
- `src/features/consent/dal/terms.ts` -- authoritative structured runtime card payload.
- `src/app/auth/consent/{page,actions}.tsx` -- server-rendered entry and server action with independently sanitized continuation.
- `src/features/consent/components/consent-card-stack.tsx` -- client-only card navigation, pending state, announcements, and sheet control.
- `src/components/ui/sheet.tsx` -- reusable Radix modal sheet with Fleet Deck styling and focus behavior.
- `src/app/(ambassador)/tasks/page.tsx` -- protected task-list empty landing seam until Epic 5 supplies data.
- `worker/jobs/verify-acceptance-chain.ts` -- verifier whose ledger/head reads must share a consistent snapshot once appends are live.
- `e2e/onboarding-consent.spec.ts` -- critical first-login journey, accessibility, continuation, and persisted evidence.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/consent/dal/acceptance.ts`, `src/features/consent/dal/pre-consent.ts`, and co-located tests -- lock and validate the invited profile, read current terms inside the transaction, append evidence/audit, activate it, and set `first_accepted_at` atomically; make same-version retries/concurrency idempotent and map expected failures to safe domain errors.
- [x] `src/features/consent/dal/consent-store.integration.test.ts` -- prove real-Postgres success, exact evidence/current-version binding, preserved chain integrity, one audit event, replay deduplication, and full rollback on mutation failure.
- [x] `worker/jobs/verify-acceptance-chain.ts` and tests -- read records and signed head in one repeatable-read snapshot so concurrent live acceptance cannot cause a false integrity alert; add real-store concurrency coverage where practical.
- [x] `src/features/consent/copy.ts`, `src/components/ui/sheet.tsx`, `src/features/consent/components/consent-card-stack.tsx`, and tests -- add centralized Swedish chrome and the one-at-a-time responsive card flow using payload copy verbatim, semantic headings, icons, dots plus text position, deterministic focus, accessible sheet, pending/error state, and no optimistic completion.
- [x] `src/app/auth/consent/page.tsx`, `src/app/auth/consent/actions.ts`, and tests -- load terms through the pre-consent boundary, sanitize continuations twice, render safe fail-closed states, invoke the atomic mutation, and redirect only after commit.
- [x] `src/app/(ambassador)/tasks/page.tsx` and test -- provide the protected `/tasks` empty-state landing without adding task domain behavior.
- [x] `e2e/fixtures/auth.ts`, `e2e/pages/auth-page.ts`, and `e2e/onboarding-consent.spec.ts` -- publish unmistakably synthetic complete terms locally and cover invite magic link through cards to `/tasks`, keyboard/sheet focus, mobile targets, Axe, malicious `next`, and database/profile/audit assertions.

**Acceptance Criteria:**
- Given an invited ambassador and a published three-card `sv-SE` payload, when consent loads, then exactly one canonical-order card is visible with its verbatim title/body, icon, semantic heading, progress dots and announced position, and its full legal text opens in a same-document modal sheet.
- Given keyboard or screen-reader navigation, when the card changes or legal sheet opens and closes, then focus moves predictably, stays trapped in the modal, returns to the invoking control, and all interactive targets are at least 44 px with visible focus.
- Given all three agreements, when the final server action commits, then exactly one current-version acceptance and `consent.accepted` event exist, the profile becomes `active`, `first_accepted_at` matches the first acceptance and is never overwritten, and the user reaches the sanitized continuation or `/tasks`.
- Given duplicate/concurrent final submissions or a database/audit/crypto failure, when the mutation executes, then it either returns the already-committed success or rolls back completely; no duplicate or partial evidence, audit, or activation remains.
- Given absent/incomplete published terms, incomplete identity, invalid crypto configuration, or malicious continuation, when the flow is used, then it fails closed with safe Swedish guidance, writes nothing, and never leaves an allow-listed local destination.

## Spec Change Log

## Review Triage Log

### 2026-07-17 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 1, medium 2, low 1)
- defer: 0
- reject: 1: (high 0, medium 1, low 0)
- addressed_findings:
  - `[high]` `[patch]` Recomputed and verified the canonical terms payload SHA-256 before both display and acceptance so corrupted payload/hash pairs fail closed instead of producing misbound evidence.
  - `[medium]` `[patch]` Routed forbidden or missing profiles to the paused terminal surface instead of leaving them in an infinite consent retry loop.
  - `[medium]` `[patch]` Reused one stable synthetic E2E terms version so repeated tests no longer append an authoritative terms version for every case and run.
  - `[low]` `[patch]` Added compensating auth-user deletion when invited-profile or magic-link fixture setup fails.

### 2026-07-17 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 1, medium 0, low 1)
- defer: 3: (high 0, medium 2, low 1)
- reject: 14: (high 1, medium 1, low 12)
- addressed_findings:
  - `[high]` `[patch]` Fixed the worker verifier's atomic snapshot isolation level in `worker/lib/maintenance.ts` (`sql.begin("repeatable read", …)` → `sql.begin("isolation level repeatable read", …)`). postgres.js emits `begin repeatable read`, which is invalid SQL, so the default reader — the production `consumeOneMaintenanceJob` path — would have thrown on every real chain-verification run; added a guard test that drives the default reader's snapshot and asserts the valid isolation string (closes the zero-coverage gap that let the defect ship).
  - `[low]` `[patch]` Made `acceptConsent` (`src/app/auth/consent/actions.ts`) relocate the user on auth/account-state failures — `/auth/login` for `AUTH_REQUIRED`/`SESSION_REVOKED`, `/auth/paused` for `ACCOUNT_INACTIVE`/`FORBIDDEN` — instead of stranding them on the consent form with an inline error, matching the page loader and `requireUserOrRedirect`.
- deferred_findings (new ledger entries):
  - `[low]` orphaned `appendAcceptance` second acceptance path after the pre-consent rewiring.
  - `[medium]` single-acceptance per (user, terms_version) enforced only in app code; no DB-level unique constraint.
  - `[medium]` `legalTextMarkdown` rendered as raw text with no markdown parser.
- rejected (out of scope or by-design): active-user re-consent lockout (Story 3.4, spec-forbidden here); displayed-vs-accepted terms TOCTOU (spec Design Notes intentionally re-read the current version under the locking transaction); `DomainError` custom messages discarded (pre-existing codebase-wide convention; user still sees a safe message); reconciliation branch activating without a fresh audit (the normal path also emits no separate activation event); ephemeral per-card "Godkänn" navigation (spec: stepper owns ephemeral presentation state only); e2e synthetic-terms reuse and append-only ledger residue (deliberate prior-pass design / inherent to the append-only chain); persistent terms-unavailable retry (fail-closed surface directs to HR per spec); admin hitting `/tasks` re-throwing `FORBIDDEN` (pre-existing guard behavior; admins use `/admin`); plus minor cosmetics (test crypto constants, duplicated `next` normalization, `/admin` in the continuation allow-list, `first_accepted_at`/`updated_at` clock sources — the former is required to match `occurred_at`).

## Design Notes

The stepper owns only ephemeral presentation state. The server receives no card content or terms identifier: final submission means “accept the complete current version,” which is re-read under the same transaction that locks the profile. A profile already active with valid current evidence is the idempotent success case; active-but-stale behavior remains Story 3.4. The protected `/tasks` page is deliberately an empty landing seam, not an early task implementation.

## Verification

**Commands:**
- `npm run typecheck` -- expected: strict TypeScript passes.
- `npm run lint` -- expected: server/client and feature boundaries pass.
- `npm test` -- expected: all Vitest unit and local-Postgres integration tests pass.
- `npm run build` -- expected: Next.js production build succeeds.
- `npm run e2e -- e2e/onboarding-consent.spec.ts` -- expected: the complete onboarding, accessibility, continuation, and persistence journey passes against local Supabase/Mailpit.
- `git diff --check` -- expected: no whitespace errors.

## Auto Run Result

Status: done

Summary: Implemented the first-login consent journey from magic-link confirmation through an accessible three-card Swedish flow to atomic account activation and the protected task landing. Acceptance evidence, audit emission, profile activation, and first-acceptance timestamp now commit together and replay idempotently; worker verification reads a consistent evidence snapshot.

Files changed:
- `_bmad-output/implementation-artifacts/epic-3-context.md` -- regenerated the current Epic 3 planning context.
- `_bmad-output/implementation-artifacts/spec-3-2-first-login-consent-card-flow.md` -- captured the frozen intent, completed tasks, review triage, and run result.
- `src/features/consent/dal/{acceptance,pre-consent}.ts` and tests -- added authenticated atomic activation, replay handling, payload/hash validation, rollback and real-Postgres coverage.
- `src/features/consent/{copy.ts,components/consent-card-stack.tsx}` and tests -- added centralized Swedish UI copy and the accessible one-card-at-a-time flow.
- `src/components/ui/sheet.tsx` -- added the Fleet Deck Radix legal-text modal sheet.
- `src/app/auth/consent/{page.tsx,actions.ts}` -- added fail-closed terms loading, safe server submission, and sanitized continuation handling.
- `src/app/(ambassador)/tasks/page.tsx` -- added the protected empty task-list landing seam.
- `worker/jobs/verify-acceptance-chain.ts`, `worker/lib/maintenance.ts`, and tests -- added repeatable-read ledger/head verification.
- `e2e/{fixtures/auth.ts,pages/auth-page.ts,onboarding-consent.spec.ts}` and `playwright.config.ts` -- added synthetic consent setup and the complete mobile, keyboard, Axe, continuation, and persistence journey.

Review findings: 4 patches applied (high 1, medium 2, low 1); 0 items deferred; 1 Story 3.4 re-acceptance finding rejected as explicitly out of scope.

Follow-up review recommendation: true -- the final pass repaired a high-consequence evidence-binding check plus cross-layer auth and test-isolation behavior.

Verification:
- `npm run typecheck` -- passed.
- `npm run lint` -- passed.
- Focused Vitest -- passed 20/20.
- Full `npm test` -- 437 passed and 14 skipped; the consent integration `beforeAll` exceeded its known 60-second local Supabase reset budget during the combined run.
- Isolated real-Postgres consent integration -- passed 9/9 after the stack stabilized.
- `npm run build` -- passed.
- `npx supabase --profile supabase/cli-profile.yaml db reset` -- passed.
- `npm run e2e -- e2e/onboarding-consent.spec.ts` -- passed 2/2 on a clean local database.
- `git diff --check` -- passed.

Residual risk: The full Vitest run remains susceptible to the pre-existing 60-second Supabase reset hook timeout under container churn; the affected integration suite passes in isolation. Re-acceptance for active users after a terms change remains intentionally assigned to Story 3.4.

## Auto Run Result — Follow-up review pass (2026-07-17)

Status: done

Summary: Independent follow-up review (Blind Hunter + Edge Case Hunter) of the full Story 3.2 diff since baseline `768adff`. Two findings were patched, three were newly deferred, the rest rejected as by-design or out of scope.

Patches applied:
- `[high]` `worker/lib/maintenance.ts` — corrected the newly added atomic-snapshot isolation level from `sql.begin("repeatable read", …)` to `sql.begin("isolation level repeatable read", …)`. postgres.js renders the option verbatim after `begin `, so the previous string produced the invalid statement `begin repeatable read`; the default reader is the production `consumeOneMaintenanceJob` path, so the scheduled acceptance-chain verification job would have thrown on every real run. Added a `worker/lib/maintenance.test.ts` case that drives the default reader's `snapshot()` and asserts the valid isolation string, closing the coverage gap that let the defect ship (both prior worker tests inject a reader and never exercised the real snapshot).
- `[low]` `src/app/auth/consent/actions.ts` — `acceptConsent` now redirects on auth/account-state `DomainError`s (`/auth/login` for `AUTH_REQUIRED`/`SESSION_REVOKED`, `/auth/paused` for `ACCOUNT_INACTIVE`/`FORBIDDEN`) rather than returning an inline error that stranded the user on the consent form, matching `page.tsx` and `requireUserOrRedirect`.

Deferred (new `deferred-work.md` entries; existing entries untouched):
- Orphaned `appendAcceptance` second acceptance path after the pre-consent rewiring (low).
- Single-acceptance per (user, terms_version) enforced only in application code, no DB-level unique constraint (medium).
- `legalTextMarkdown` rendered as raw text with no markdown parser (medium).

Rejected: active-user re-consent lockout (Story 3.4, spec forbids adding re-accept here), displayed-vs-accepted terms TOCTOU (spec Design Notes re-read the current version under the locking transaction by design), discarded `DomainError` custom messages (pre-existing codebase-wide convention, user still sees a safe message), reconciliation-branch activation without a fresh audit event (normal path emits none either), ephemeral per-card navigation labels (spec: stepper holds ephemeral state only), e2e synthetic-terms reuse / append-only ledger residue (deliberate prior-pass design / inherent to the chain), persistent terms-unavailable retry (fail-closed surface directs to HR per spec), admin `/tasks` FORBIDDEN re-throw (pre-existing guard behavior), and assorted cosmetics.

Verification: `npm run typecheck` passed · `npm run lint` passed · `npx vitest run worker/lib/maintenance.test.ts worker/jobs/verify-acceptance-chain.test.ts` passed 20/20 · `npx vitest run src/features/consent src/app/auth` passed 65/65 · `npm run build` passed · `git diff --check` clean.

Residual risk: The worker snapshot fix is validated by a mock-level guard test asserting the isolation string, not by a live-Postgres run of the scheduled job; the deferred-work ledger already tracks the absence of real-Postgres coverage for the worker default reader. Follow-up review not recommended: the two fixes are localized and verified.
