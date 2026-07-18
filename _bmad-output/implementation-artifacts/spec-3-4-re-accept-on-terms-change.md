---
title: 'Story 3.4: Re-accept on terms change'
type: 'feature'
created: '2026-07-18'
status: 'done'
baseline_revision: 1b2b03e28cb8c487d9de72b4d19c88dc49316ad8
final_revision: b7f4cc33a9d9a1f01675ce7c1798aee1d111c966
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings:
  - oversized
---

<intent-contract>

## Intent

**Problem:** Active ambassadors whose acceptance is older than the current terms are correctly blocked by the protected auth guard, but they cannot currently accept or decline the replacement terms, cannot see what changed, and therefore cannot resume their original task safely.

**Approach:** Generalize the locked consent transitions for active stale-consent users, derive a trustworthy re-accept presentation from their latest verified acceptance, and interpose an accessible Swedish changed-terms variant that resumes only a sanitized original destination after server-confirmed acceptance.

## Boundaries & Constraints

**Always:** Treat the transaction's current published terms as authoritative; lock the profile before accept/decline; append exactly one acceptance and `consent.accepted` audit per newly accepted version; preserve `first_accepted_at`; keep re-accepting users active and move decliners atomically to `inactive_declined`; validate acceptance-chain evidence before using it to describe prior consent; identify changed cards by comparing title, body, and full legal text; mark every changed card with text and styling; sanitize `next` at every boundary; keep acceptance and decline server-acknowledged; retain active-only protection for tasks/uploads and keep admins entirely outside the consent gate.

**Block If:** Current complete terms, the authenticated profile, prior acceptance integrity, cryptographic/audit configuration, or the locked transactional outcome cannot be established without weakening consent evidence. Fail closed with safe centralized copy and no partial mutation.

**Never:** Trust client-supplied version or changed-card identifiers, accept a version superseded before commit, overwrite prior evidence or `first_accepted_at`, optimistically unlock protected work, create an open redirect or consent loop, add upload/task implementations owned by later epics, change admin authorization, or weaken append-only/HMAC protections.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Stale active acceptance | Active ambassador accepted v1; v2 is current | Protected access returns `CONSENT_REQUIRED`; consent shows changed-terms mode and all changed cards; accepting v2 appends one evidence/audit pair, preserves first acceptance, remains active, and resumes safe `next` | Missing or invalid current/prior evidence fails closed without claiming which cards changed |
| Decline replacement terms | Active stale ambassador declines current terms | Atomically set `inactive_declined`, emit one decline audit, retain all acceptance evidence, and route to the reversible pause state | Roll back profile and audit together; protected work remains blocked |
| Replay or race | Repeated accepts, repeated declines, accept-versus-decline, or a newer version publishes during submission | Profile/current-version locking yields one coherent outcome, no duplicate evidence/audits, and never treats superseded evidence as current | Losing/replayed operation returns the committed safe state or a typed conflict |
| Multiple or legal-only edits | Several cards differ, or only `legalTextMarkdown` differs | Mark each changed card accessibly; first-login presentation remains unchanged | If comparison cannot be trusted, show generic changed-terms notice without false precision |
| Continuation and role isolation | Deep local path/query, unsafe URL, or admin request | Re-accept resumes an allow-listed relative destination; unsafe input falls back safely; admin proceeds without consulting consent | Prevent external/protocol-relative redirects and redirect loops |

</intent-contract>

## Code Map

- `src/features/consent/dal/acceptance.ts` -- locked acceptance/decline state machine, evidence append, audit emission, and replay/concurrency semantics.
- `src/features/consent/dal/consent-status.ts` -- verified current-consent and prior-evidence lookup suitable for trustworthy change comparison.
- `src/features/consent/dal/pre-consent.ts` -- authenticated allow-listed presentation and mutation facade.
- `src/lib/auth.ts` -- protected ambassador stale-version gate, server redirect adapter, and admin bypass.
- `src/app/auth/consent/{page.tsx,actions.ts}` -- server-derived presentation mode, independently sanitized continuation, and post-commit routing.
- `src/features/consent/{copy.ts,components/consent-card-stack.tsx}` -- centralized Swedish re-accept copy, changed-card marker, and accessible interaction variant.
- `src/features/consent/dal/consent-store.integration.test.ts` -- live-Postgres evidence, state, replay, publication-race, and accept/decline invariants.
- `e2e/onboarding-consent.spec.ts` -- stale-session interposition, changed-card presentation, continuation, decline, admin, and Axe journey coverage.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/consent/dal/{acceptance.ts,consent-status.ts,pre-consent.ts}` and co-located tests -- add verified re-accept context and admit active stale users to locked accept/decline transitions while rejecting already-current or superseded submissions.
- [x] `src/features/consent/dal/consent-store.integration.test.ts` -- prove v1-to-v2 acceptance, decline, exact evidence/audit counts, preserved `first_accepted_at`, multiple-tab replay, accept/decline serialization, rollback, and publication-race behavior in real Postgres.
- [x] `src/lib/auth.ts` and `src/lib/auth.test.ts` -- lock the active-stale/current/admin matrix and carry a sanitized continuation through the `CONSENT_REQUIRED` HTTP/redirect contract without weakening DAL authorization.
- [x] `src/app/auth/consent/{page.tsx,actions.ts}` and tests -- render server-derived first-login versus re-accept mode, submit only authoritative server state, sanitize continuation independently, and resume or pause only after commit.
- [x] `src/features/consent/{copy.ts,components/consent-card-stack.tsx}` and tests -- add centralized Swedish changed-terms banner, changed marker, re-accept CTA/pending copy, multi-card and legal-only highlighting, screen-reader announcements, visible focus, and unchanged first-login behavior.
- [x] `src/lib/query-client.test.ts`, `e2e/pages/auth-page.ts`, and `e2e/onboarding-consent.spec.ts` -- prove a stale API/RSC request interposes consent, safe deep-link resumption, unsafe-link fallback, decline blocking, admin bypass, mobile behavior, and no Axe violations.

**Acceptance Criteria:**
- Given an authenticated active ambassador accepted an older version, when they make any protected ambassador request, then the DAL returns `CONSENT_REQUIRED` as a 409 continuation contract and no task fulfilment or upload can proceed before current acceptance.
- Given the re-accept screen, when current terms differ from the latest verified accepted manifest, then Swedish changed-terms guidance is announced and every title, body, or legal-text change is highlighted without color as the sole signal.
- Given an active stale ambassador accepts current terms, when the transaction commits, then exactly one append-only acceptance and accepted audit exist for that version, `first_accepted_at` is unchanged, the profile remains active, the gate passes, and the sanitized original destination resumes.
- Given an active stale ambassador declines current terms, when the transaction commits, then the profile becomes `inactive_declined`, one decline audit exists, prior evidence/data remain intact, the reversible pause flow appears, and protected work stays blocked.
- Given an admin without ambassador consent, when they make an admin request, then `requireAdmin()` succeeds without invoking or depending on the consent-version provider.

## Spec Change Log

## Review Triage Log

### 2026-07-18 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 2, low 1)
- defer: 0
- reject: 10: (high 0, medium 0, low 10)
- addressed_findings:
  - `[medium]` `[patch]` Added the missing `erasure_tombstone` fail-closed check to `readVerifiedReacceptanceContext`, giving it parity with `hasCurrentConsent` so a crypto-shredded user can never be presented as current/re-accept and loop against the gate.
  - `[medium]` `[patch]` Made the changed-terms presentation (consent page intro and card-stack banner) show the generic "read all parts" notice when a new version has no identifiable per-card changes (empty `changedCardIds`), instead of falsely claiming changed parts are marked; added a component regression test for the empty-array case.
  - `[low]` `[patch]` Removed the unused `expectChangedTerms` e2e page-object helper introduced by this story.

### 2026-07-18 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 1, medium 2, low 1)
- defer: 2: (high 0, medium 2, low 0)
- reject: 6: (high 0, medium 0, low 6)
- addressed_findings:
  - `[medium]` `[patch]` Excluded admin identities from ambassador pre-consent presentation and mutations while retaining `requireAdmin()` consent bypass; added the authorization regression test.
  - `[high]` `[patch]` Bound same-version replay to the authoritative payload hash so mismatched evidence fails closed instead of redirecting into a permanent consent loop; added live-Postgres tamper coverage.
  - `[medium]` `[patch]` Added an explicit current-consent presentation outcome and safe continuation redirect so already-current ambassadors never receive a false changed-terms claim.
  - `[low]` `[patch]` Replaced the publication-race tautology with assertions for both serialized v2/v3 outcomes and the resulting gate/re-accept state.

## Design Notes

Changed-card context is evidence-derived, not client-derived: compare the current complete card manifest with the manifest referenced by the latest verified acceptance. A missing trustworthy comparison may reduce presentation precision, but must never manufacture an unchanged/changed claim or weaken the gate. Mutation transactions re-read current terms after locking so a page rendered for v2 cannot make v2 current if v3 was published before commit.

## Verification

**Commands:**
- `npm run typecheck` -- expected: strict consent presentation/state unions and error contracts pass.
- `npm run lint` -- expected: server-only DAL and feature boundary rules pass.
- `npm test` -- expected: unit/component suites and consent state matrices pass.
- `npm run test -- src/features/consent/dal/consent-store.integration.test.ts` -- expected: real-Postgres version, evidence, race, rollback, and decline cases pass.
- `npm run build` -- expected: production server/client boundaries compile.
- `npm run e2e -- e2e/onboarding-consent.spec.ts` -- expected: stale re-accept/decline/admin/continuation/mobile/Axe journeys pass against local Supabase.
- `git diff --check` -- expected: no whitespace errors.

## Auto Run Result

Status: done

Summary: Implemented stale-consent interposition and re-acceptance for ambassadors. The flow derives changed cards from verified evidence, supports atomic accept or decline of replacement terms, preserves first-acceptance history, resumes only sanitized local continuations, and keeps admin sessions outside the ambassador consent boundary.

Files changed:
- `src/features/consent/dal/{acceptance,consent-status,pre-consent,terms}.ts` and tests -- added hash-bound replay, verified prior/current presentation, active-stale state transitions, publication serialization, and live-Postgres race/tamper coverage.
- `src/lib/auth.ts`, `src/lib/auth.test.ts`, and `src/lib/query-client.test.ts` -- excluded admins from pre-consent operations and proved protected/admin/continuation routing.
- `src/app/auth/consent/{page.tsx,actions.test.ts}` and `src/app/(ambassador)/tasks/page.tsx` -- added server-derived re-accept/current routing and preserved safe query continuations.
- `src/features/consent/{copy.ts,components/consent-card-stack.tsx}` and tests -- added centralized Swedish changed-terms messaging, accessible changed-card markers, and re-accept controls.
- `e2e/{pages/auth-page.ts,onboarding-consent.spec.ts}` -- added stale interposition, accept/decline, exact continuation, current-user redirect, admin bypass, mobile, focus, and Axe journeys.

Review findings: 4 patches applied (high 1, medium 2, low 1); 2 pre-existing design concerns deferred; 6 findings rejected as future-story scope, intentional immutable-test isolation, already-covered behavior, or low-consequence noise.

Follow-up review recommendation: true -- the review closed a high-consequence evidence/gate mismatch and an authorization boundary defect, and materially strengthened concurrency behavior verification.

Verification:
- `npm run typecheck` -- passed.
- `npm run lint` -- passed.
- Non-integration Vitest -- 68 files, 429 tests passed before review patches; focused post-review unit tests -- 19/19 passed.
- Live-Postgres consent integration -- 15/15 passed after review patches.
- Production build -- passed before review patches; post-review typecheck and lint remained green.
- Playwright onboarding consent suite -- 6/6 passed before review patches; focused post-review Chromium re-accept/current journey -- 1/1 passed.
- `git diff --check` -- passed.

Residual risks: The verified consent presentation currently reuses the existing full acceptance-chain verification strategy, whose cost grows with the append-only ledger. The pre-existing accept-versus-decline semantics permit a later serialized acceptance to reactivate a just-declined account; both concerns are recorded for focused follow-up rather than changed inside this story.

### 2026-07-18 — Follow-up review pass

Summary: An independent follow-up review re-examined the full story diff. It applied three patches, deferred nothing new (the two real pre-existing concerns it surfaced — full-ledger verification cost and accept-vs-decline reactivation — are already recorded in the deferred-work ledger for this spec), and rejected ten low-consequence findings.

Patches applied:
- `[medium]` Added the missing `erasure_tombstone` fail-closed guard to `readVerifiedReacceptanceContext` (`src/features/consent/dal/consent-status.ts`), giving it parity with `hasCurrentConsent`. This closes a latent gate/presentation divergence in which a crypto-shredded user could be presented as current/re-accept and loop against the auth gate. Latent today (production erasure deactivates the account, routing it to `/auth/paused` before the consent page), but defensive parity in the new code path.
- `[medium]` Corrected the changed-terms presentation so both the consent-page intro and the card-stack banner show the generic "read all parts" notice when a re-accept has no identifiable per-card changes (empty `changedCardIds`), rather than falsely claiming changed parts are marked. Reachable by republishing terms with byte-identical cards under a new version string. Added a component regression test.
- `[low]` Removed the unused `expectChangedTerms` e2e page-object helper introduced by this story.

Verification (follow-up pass):
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Non-integration Vitest — 68 files, 431 tests passed (includes the new empty-`changedCardIds` component test).
- Live-Postgres consent integration — 15/15 passed.
- `git diff --check` — clean.

Follow-up review recommendation: false — the fixes are localized and fully verified; the tombstone hardening is latent-only and the copy fix is an edge-case presentation correction, neither warranting another independent review.
