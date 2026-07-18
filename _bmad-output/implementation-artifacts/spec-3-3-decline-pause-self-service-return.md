---
title: 'Story 3.3: Decline pause and self-service return'
type: 'feature'
created: '2026-07-18'
status: 'done'
baseline_revision: e8a635c8fc3bc041c01084f93ed25eaa93cf25f3
final_revision: be5bf290f0170c67b732a04e0d1c9ef137d0949b
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings:
  - oversized
---

<intent-contract>

## Intent

**Problem:** Declining consent currently has no product path, and the shared auth guard and confirmation route make a declined ambassador unable to return to consent without administrator intervention. The existing pause screen also implies a terminal admin-managed state rather than a reversible pause.

**Approach:** Add an atomic, idempotent decline transition and a state-aware Swedish pause experience, then permit only `inactive_declined` ambassadors through the pre-consent boundary so a later login re-presents current terms and acceptance reactivates the account.

## Boundaries & Constraints

**Always:** Commit `inactive_declined` and one pseudonymous `consent.declined` audit event together; preserve the profile, content, prior evidence, acceptance-chain head, `first_accepted_at`, and session. Keep protected ambassador DAL access active-only while allowing invited, active, and declined users only through the existing pre-consent operation allow-list. Make duplicate/concurrent decline idempotent and serialize accept-versus-decline on the profile row. Render centralized Swedish copy stating that the account is paused, nothing was deleted, and return is possible at any time. Sanitize `next` at every page/action boundary, use server acknowledgement, and retain keyboard, visible-focus, Axe, and 44 px target guarantees.

**Block If:** The authenticated profile or current complete terms cannot be validated, cryptographic/audit configuration is invalid, or transactional state cannot be resolved without weakening the consent evidence or account-state invariants. Fail closed with safe copy and no partial mutation.

**Never:** Delete data, revoke the session, create acceptance evidence on decline, overwrite `first_accepted_at`, allow `deactivated` users into consent, add withdrawal behavior, implement stale-terms re-acceptance from Story 3.4, or implement Epic 5 task/message dispatch. Do not route new behavior through the orphaned unlocked `appendAcceptance` path or expand unrelated deferred markdown/schema work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| First decline | Invited ambassador chooses Decline on the final card | Atomically set `inactive_declined`, emit one decline audit, then show the reversible pause screen | Roll back state and audit together; keep consent visible with safe Swedish guidance |
| Replay or race | Duplicate declines, or accept and decline arrive concurrently | Profile lock produces one coherent terminal result with no duplicate audit/evidence or partial effects | Losing operation returns the already-committed safe state/result |
| Self-service return | Declined ambassador follows a later valid magic link | Route to current consent cards; acceptance activates without admin action and preserves existing first-acceptance time | Missing/tampered terms fail closed; malicious continuation becomes `/tasks` |
| Existing current evidence | Declined profile already has acceptance for current terms | Acceptance reactivates without a duplicate ledger record or accepted audit | Deactivated/missing profiles remain paused or forbidden |
| Other inactive state | Deactivated ambassador authenticates | Keep the terminal admin-help pause experience and protected/pre-consent access closed | Never expose provider or profile details |

</intent-contract>

## Code Map

- `src/lib/auth.ts` -- separate authenticated profile lookup from state policy; keep `requireUser` protected and narrowly admit declined users through `requireUserPreConsent`.
- `src/features/consent/dal/acceptance.ts` -- own locked decline/idempotence and declined-to-active acceptance transitions.
- `src/features/consent/dal/pre-consent.ts` -- expose the authenticated allow-listed decline facade.
- `src/app/auth/confirm/route.ts` -- route `inactive_declined` back to consent while keeping deactivated users paused.
- `src/app/auth/consent/{page.tsx,actions.ts}` -- load declined users, submit decline, sanitize continuations, and redirect only after commit.
- `src/app/auth/paused/page.tsx` -- render state-aware reversible-decline versus terminal-deactivation copy and CTA.
- `src/features/consent/{copy.ts,components/consent-card-stack.tsx}` -- centralize warm Swedish copy and add final-card-only quiet Decline behavior.
- `e2e/onboarding-consent.spec.ts` -- prove the complete decline, pause, later login, and self-service acceptance journey.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/auth.ts`, `src/lib/auth.test.ts`, `src/app/auth/confirm/route.ts`, and `route.test.ts` -- implement and prove the account-state authorization/routing matrix: declined may use pre-consent and returns to cards; deactivated remains terminal; protected DAL remains active-only.
- [x] `src/features/consent/dal/acceptance.ts`, its unit tests, and `consent-store.integration.test.ts` -- add transactional idempotent decline, extend locked acceptance/reactivation for declined profiles, preserve `first_accepted_at`, and cover replay, rollback, ledger immutability, current-evidence replay, and accept/decline concurrency in real Postgres.
- [x] `src/features/consent/dal/pre-consent.ts` and tests -- wire decline through `requireUserPreConsent` and the closed operation allow-list without trusting client state or terms identifiers.
- [x] `src/app/auth/consent/{page.tsx,actions.ts}` and tests -- admit declined profiles, add the decline server action, independently sanitize continuation input, map auth/account failures safely, and redirect to the pause surface only after commit.
- [x] `src/features/consent/copy.ts`, `src/features/consent/components/consent-card-stack.tsx`, and tests -- add centralized Swedish pause/decline strings and a final-card-only quiet secondary action with mutually exclusive pending states, deterministic focus, accessible errors, and no optimistic state.
- [x] `src/app/auth/paused/page.tsx` and tests -- distinguish the warm reversible declined state from deactivated admin-help state and provide a consent-return CTA that preserves only a sanitized local continuation.
- [x] `e2e/fixtures/auth.ts`, `e2e/pages/auth-page.ts`, and `e2e/onboarding-consent.spec.ts` -- cover invite through decline/pause, accessibility/mobile behavior, later magic-link return, acceptance/reactivation, malicious `next`, deactivated routing, and persisted state/audit/evidence assertions.

**Acceptance Criteria:**
- Given an invited ambassador on the final consent card, when Decline is server-confirmed, then the account becomes `inactive_declined`, exactly one `consent.declined` event exists, no acceptance/content/profile data is deleted or created, and the Swedish pause screen states paused, nothing deleted, and return anytime.
- Given repeated or concurrent decline and acceptance requests, when transactions complete, then profile locking yields a coherent state with no duplicate audit/evidence, no partial mutation, and unchanged `first_accepted_at`.
- Given an `inactive_declined` ambassador, when they authenticate later, then confirmation re-presents the canonical current card stack and accepting activates them without admin action, duplicate evidence, or overwriting their first acceptance timestamp.
- Given a declined ambassador before re-acceptance, when they invoke a protected ambassador DAL operation, then access remains blocked; task/message dispatch suppression stays explicitly owned by Epic 5.
- Given keyboard, screen-reader, or mobile use, when the ambassador declines, views pause, and returns, then focus is predictable, state is not conveyed by color alone, controls are at least 44 px, and the changed journey has no Axe violations.

## Spec Change Log

## Review Triage Log

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 1, medium 2, low 0)
- defer: 0
- reject: 10: (high 0, medium 4, low 6)
- addressed_findings:
  - `[high]` `[patch]` Restricted the decline transaction to `invited` profiles so an active ambassador cannot use the pre-consent endpoint as an unintended consent-withdrawal path; added a real-Postgres rejection assertion.
  - `[medium]` `[patch]` Strengthened the accept-versus-decline concurrency test to correlate settled operation results with the deterministic active final state and exact audit counts.
  - `[medium]` `[patch]` Added a forced decline-audit failure test proving the profile transition rolls back with the audit transaction.

### 2026-07-18 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 2, low 0)
- defer: 0
- reject: 9: (high 0, medium 0, low 9)
- addressed_findings:
  - `[medium]` `[patch]` `declineCurrentTerms` threw `ACCOUNT_INACTIVE` (403 — semantically wrong for an active account) when declining from a non-invited/non-declined state, contradicting the sibling accept path and the integration assertion that expects `CONFLICT`. Changed it to `CONFLICT` (409). The full real-Postgres consent-store suite (12/12) now passes green, including the previously-unobserved decline/reactivation/race/rollback cases.
  - `[medium]` `[patch]` `requireUser` threw `ACCOUNT_INACTIVE` for `invited` ambassadors, so `requireUserOrRedirect` routed them to `/auth/paused` — dropping their `next` deep link and briefly showing a "paused" screen to a never-declined user. Now throws `CONSENT_REQUIRED` for `invited` so they route to `/auth/consent` with continuation preserved; `inactive_declined`/`deactivated` still fail closed to `/auth/paused` (locked by `auth.test.ts`).

## Design Notes

`inactive_declined` is reversible without session revocation. The pause route therefore reads only the caller's own account state through the pre-consent boundary and presents two distinct states: declined receives the self-service consent CTA; deactivated receives terminal admin-help copy. Acceptance re-reads current terms and locks the profile inside the live transaction; an existing same-version acceptance may reactivate the declined profile without appending duplicate evidence.

## Verification

**Commands:**
- `npm run typecheck` -- expected: strict TypeScript and state unions pass.
- `npm run lint` -- expected: server/client and feature import boundaries pass.
- `npm test` -- expected: unit and local-Postgres integration suites pass, including the state and concurrency matrices.
- `npm run build` -- expected: the production Next.js build succeeds.
- `npm run e2e -- e2e/onboarding-consent.spec.ts` -- expected: decline/pause/return/reactivation, Axe, mobile, continuation, and persistence checks pass against local Supabase.
- `git diff --check` -- expected: no whitespace errors.

## Auto Run Result

Status: done

Summary: Added the reversible consent-decline journey. Invited ambassadors can pause atomically without deletion or session revocation, see a warm Swedish self-service pause state, return through a later magic link, and reactivate through the current consent cards without administrator intervention or duplicate evidence.

Files changed:
- `src/features/consent/dal/{acceptance,pre-consent}.ts` and tests -- added the locked decline transition, declined-user pre-consent access, replay-safe reactivation, rollback and concurrency coverage.
- `src/lib/auth.ts` and tests -- admitted declined profiles only through the pre-consent boundary while retaining active-only protected/admin access.
- `src/app/auth/confirm/route.ts`, `src/app/auth/consent/{page,actions}.tsx`, and tests -- routed declined users back to consent and added safe server-acknowledged decline handling.
- `src/app/auth/paused/page.tsx` and tests -- added state-aware reversible-decline and terminal-deactivation surfaces with sanitized continuation handling.
- `src/features/consent/{copy.ts,components/consent-card-stack.tsx}` and tests -- added centralized Swedish pause copy and the accessible final-card secondary action.
- `e2e/{pages/auth-page.ts,onboarding-consent.spec.ts}` -- added the decline, pause, later-login, reactivation, accessibility, mobile, and persistence journey.

Review findings: 3 patches applied (high 1, medium 2); 0 items deferred; 10 findings rejected as pre-existing design, already-covered behavior, or disproportionate/noise.

Follow-up review recommendation: true -- the final review closed a high-consequence account-state authorization defect and strengthened transactional concurrency/rollback evidence.

Verification:
- `npm run typecheck` -- passed.
- `npm run lint` -- passed.
- Focused Vitest -- 35/35 passed.
- `npm run build` -- passed.
- `git diff --check` -- passed.
- Real-Postgres integration runner -- local Supabase `db reset` repeatedly terminated the Vitest process before a summary; the new cases are present but were not observed green in this run.
- `npm run e2e -- e2e/onboarding-consent.spec.ts` -- local run reached the pre-existing first-login acceptance action but remained pending beyond 15 seconds, so the new serial decline case did not execute.

Residual risk: The database-backed decline tests and complete Playwright journey require a stable isolated local Supabase run. The repeated first-login action stall appears in the existing Story 3.2 case before the new decline scenario and leaves no active database wait after teardown, but its cause remains unresolved.

### 2026-07-18 — Follow-up review pass

Status: done

Summary: A fresh independent adversarial + edge-case review of the Story 3.3 diff surfaced two medium-severity, this-story defects, both fixed as patches. No intent gaps or spec-level defects were found; nine remaining findings were rejected as spec-aligned Block-If behavior, defensible safe-copy fallbacks, correct-by-design Postgres semantics, or low-consequence noise.

Files changed this pass:
- `src/features/consent/dal/acceptance.ts` — decline from a non-invited/non-declined state now throws `CONFLICT` (was `ACCOUNT_INACTIVE`), aligning with the sibling accept path and the integration assertion.
- `src/lib/auth.ts` — `requireUser` now throws `CONSENT_REQUIRED` for `invited` ambassadors (routing them to consent with `next` preserved) instead of `ACCOUNT_INACTIVE`; non-active/non-invited states still fail closed to the paused surface.

Review findings breakdown: 2 patches applied (both medium); 0 deferred; 9 rejected.

Verification (this pass):
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused Vitest (auth, consent actions, paused page, pre-consent, consent-card-stack, confirm route) — 35/35 passed.
- Real-Postgres `consent-store.integration.test.ts` — 12/12 passed (warm Docker, 41s), first green observation of the decline/CONFLICT/reactivation/race/rollback cases. Note: the `beforeAll` `supabase db reset` (~53s bare) intermittently exceeds the test's hardcoded 60s hook timeout on a cold Docker in this WSL environment; pre-warming the stack yields a clean pass. This is the same pre-existing Story 3.1 test-infra flake, not a code defect.

Residual risk: The Playwright journey was not re-run this pass; DB-level and unit coverage for the decline/return flow is now comprehensive and green. The `beforeAll` reset-vs-timeout margin remains an environmental flake that a stable/warm local stack (or a higher `hookTimeout`) resolves.
