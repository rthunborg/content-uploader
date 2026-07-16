---
title: 'Story 2.4: Activate / deactivate accounts with session revocation'
type: 'feature'
created: '2026-07-16T00:00:00+02:00'
status: done
baseline_revision: ab80f483011d545c43dd18bfedb8c32a61824d58
final_revision: 54adf21
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-3-maintain-ambassador-contact-details.md'
warnings:
  - oversized
---

<intent-contract>

## Intent

**Problem:** Admins can view and maintain ambassadors, but cannot pause an ambassador account or restore access from the admin detail surface. Deactivated ambassadors must lose protected access immediately across devices.

**Approach:** Add admin-only lifecycle mutations and controls for deactivation and reactivation. Deactivation persists `deactivated`, emits the lifecycle audit event, globally revokes Supabase sessions, and relies on existing auth guards/paused routing to block later requests; reactivation restores `active` access without revoking sessions.

## Boundaries & Constraints

**Always:** Require `requireAdmin()` before validation or side effects; target only real non-admin ambassador identities; use the existing canonical states (`invited`, `active`, `inactive_declined`, `inactive_withdrawn`, `deactivated`); call `revokeAllUserSessions(profileId)` for every successful deactivation transition; emit `account.deactivated` and `account.reactivated` through the existing audit registry with actor snapshot and before/after state evidence; return the acknowledged `AdminProfile`; keep UI server-acknowledged with retained state, clear status feedback, and `router.refresh()`; centralize Swedish copy; ensure deactivated users are denied by existing `ACCOUNT_INACTIVE`/paused behavior.

**Block If:** A durable product decision is needed for reactivating `inactive_declined` or `inactive_withdrawn` accounts, or if Supabase global session revocation cannot be attempted for a deactivation that changed state.

**Never:** Soft-delete accounts; delete Auth users or profile rows; alter contact fields; call revocation for reactivation or contact edits; create new account states or audit event types; expose provider/database errors; let ambassadors or admins lifecycle-toggle admin identities.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Deactivate active account | Admin targets active ambassador | Profile state becomes `deactivated`, audit records `account.deactivated`, global sign-out is called, detail/roster show deactivated | No error expected |
| Deactivate invited account | Admin targets invited ambassador | Profile state becomes `deactivated`, audit records prior `invited`, global sign-out is still attempted | No error expected |
| Reactivate deactivated account | Admin targets deactivated ambassador | Profile state becomes `active`, audit records `account.reactivated`, no global sign-out is called | No error expected |
| No-op duplicate action | Admin deactivates an already deactivated account or reactivates an already active account | No duplicate audit event; state remains stable; response returns current profile | No error expected |
| Non-reactivatable inactive account | Admin tries to reactivate `inactive_declined` or `inactive_withdrawn` | No mutation and no revocation | `CONFLICT` / 409 |
| Missing or excluded target | Malformed ID, absent profile, orphan profile, or admin identity | No account data is exposed or changed | `NOT_FOUND` / 404 |
| Revocation failure | State transition to deactivated is otherwise ready but Supabase global sign-out fails | No success is reported; state/audit must not commit unless revocation has succeeded or been completed before commit | Log stable operational event and return `INTERNAL_ERROR` |
| Unauthorized actor | Missing or non-admin session | No validation, mutation, audit, or revocation occurs | Canonical 401/403 envelope |

</intent-contract>

## Code Map

- `src/features/ambassadors/dal/admin.ts` -- Existing admin-only roster/detail/contact/invite DAL; add lifecycle transition functions, row locking, audit emission, and revocation composition here.
- `src/lib/auth/revocation.ts` -- Existing Supabase Admin API global sign-out helper required by deactivation.
- `src/shared/audit-events.ts` and `src/shared/audit.ts` -- Closed audit registry already contains `account.deactivated` and `account.reactivated`; emit through the transaction helper.
- `src/app/api/ambassadors/[profileId]/route.ts` -- Existing detail GET/contact PATCH route; add lifecycle mutation surface while preserving contact PATCH behavior.
- `src/features/ambassadors/components/detail.tsx` -- Existing admin detail page where lifecycle controls should appear next to the state/contact surfaces.
- `src/features/ambassadors/components/contact-form.tsx` -- Existing server-ack mutation, retained-input, status, and refresh pattern to mirror for lifecycle UI.
- `src/features/ambassadors/copy.ts` -- Central Swedish copy for lifecycle buttons, confirmation/status text, and state labels.
- `src/lib/auth.ts`, `src/app/auth/confirm/route.ts`, and `src/app/auth/paused/page.tsx` -- Existing inactive-account enforcement and paused destination that Story 2.4 must preserve and exercise.
- `e2e/ambassador-roster.spec.ts` and `e2e/auth-magic-link.spec.ts` -- Existing admin roster/detail and paused-login coverage to extend or keep compatible.

## Tasks & Acceptance

**Execution:**
- `src/features/ambassadors/schemas/account-lifecycle.ts` and tests -- add strict shared validation for the lifecycle action payload (`deactivate` or `reactivate`) so contact PATCH cannot accept lifecycle fields accidentally.
- `src/features/ambassadors/dal/admin.ts` and focused tests -- add admin-only lifecycle mutation(s) with UUID validation, ambassador-only filtering, target row lock, allowed transitions, idempotent no-op handling, exact `updatedAt` persistence, transaction-scoped audit emission, safe provider/persistence logging, and mandatory global revocation for successful deactivation.
- `src/app/api/ambassadors/[profileId]/route.ts` and tests -- add the lifecycle mutation route while preserving GET and contact PATCH; prove authorization happens before body parsing and all domain errors map to canonical envelopes.
- `src/features/ambassadors/components/account-lifecycle-form.tsx`, `detail.tsx`, `copy.ts`, and tests -- add accessible deactivate/reactivate controls with consequence-first confirmation for deactivation, deduplicated submission, server-owned status feedback, disabled pending state, and refresh after acknowledgement.
- `src/features/ambassadors/dal/admin.integration.test.ts` -- verify persisted state, audit rows, non-admin target exclusion, revocation behavior, and that deactivated sessions are rejected by the existing auth guard after the transition.
- `e2e/ambassador-lifecycle.spec.ts` or `e2e/ambassador-roster.spec.ts` -- cover admin deactivate/reactivate from the detail surface, roster/detail state refresh, keyboard/touch operation, Axe, and paused routing for a deactivated ambassador login/session.

**Acceptance Criteria:**
- Given an authenticated admin and an active or invited ambassador, when the admin deactivates the account, then the admin surfaces show `deactivated`, `account.deactivated` is audited with actor and prior-state evidence, and every Supabase session for that user is globally revoked.
- Given a deactivated ambassador has an existing or newly attempted authenticated flow, when they make a protected request or consume a magic link, then the outer app surface denies access through the existing `ACCOUNT_INACTIVE` or paused-account route.
- Given an authenticated admin and a deactivated ambassador, when the admin reactivates the account, then the admin surfaces show `active`, `account.reactivated` is audited, and no global sign-out is called.
- Given an admin repeats the same lifecycle action, when the target is already in the requested state, then no duplicate audit event is created, no unnecessary revocation is called, and the current profile is returned.
- Given the target is missing, malformed, orphaned, an admin identity, or a declined/withdrawn account that lacks a reactivation decision, when the lifecycle route is called, then no mutation, audit event, or revocation occurs and the response uses the canonical error envelope.
- Given the lifecycle controls are used on desktop or phone, when operated by keyboard or touch, then controls meet focus, target-size, confirmation, status, and accessibility requirements.

## Spec Change Log

## Review Triage Log

### 2026-07-16 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 1, medium 3, low 2)
- defer: 0
- reject: 5
- addressed_findings:
  - `[high]` `[patch]` Default session revocation could regress while account-state denial still made E2E pass; added real local Supabase coverage for the default `revokeAllUserSessions(profileId)` path and tightened lifecycle E2E to require `SESSION_REVOKED`.
  - `[medium]` `[patch]` Invited ambassadors were deactivatable in DAL but not verified at the UI boundary; added component coverage proving invited profiles can submit `{ action: "deactivate" }`.
  - `[medium]` `[patch]` Unsupported `inactive_declined` / `inactive_withdrawn` states showed deactivation/session-ending guidance with no explanation; added centralized unsupported copy and updated component behavior/tests.
  - `[medium]` `[patch]` Lifecycle PATCH failures were logged with the contact-update operation name; split route error handling so lifecycle failures use `admin.lifecycle_update_failed`.
  - `[low]` `[patch]` The Playwright paused-login context could leak on assertion failure; wrapped it in `finally` cleanup.
  - `[low]` `[patch]` New ordinary source, test, and spec files were staged with executable mode; normalized them to `100644`.

## Design Notes

Deactivation has an external side effect that the database cannot roll back. Implement it so the product never reports a deactivation that skipped revocation: lock and inspect the profile, attempt global revocation for a real transition to `deactivated`, then persist the state and audit event in one transaction. If persistence fails after revocation, return `INTERNAL_ERROR` and log the failure; the user is signed out but not falsely shown as deactivated, which is safer than committing a paused account whose active sessions were never revoked. Idempotent deactivation of an already deactivated row should return the current profile without another revocation attempt.

The unresolved business meaning of declined/withdrawn accounts is outside this story. Reactivation is therefore limited to `deactivated -> active`; `inactive_declined` and `inactive_withdrawn` return `CONFLICT` until a later consent/offboarding story defines that transition.

## Verification

**Commands:**
- `npm run typecheck` -- TypeScript and route/component boundaries compile.
- `npm run lint` -- ESLint boundary rules and style checks pass.
- `npm test` -- Unit and integration coverage for DAL, route, schema, UI, auth guard, and audit behavior passes.
- `npm run build` -- Next.js App Router build succeeds.
- `npx playwright test ambassador-lifecycle.spec.ts --reporter=line` -- lifecycle UI, accessibility, refresh, and paused/revoked account behavior pass if implemented as a new spec; otherwise run the updated roster/auth specs that cover the same flow.
- `git diff --check` -- no whitespace or conflict-marker defects.

## Auto Run Result

Summary: Implemented admin ambassador lifecycle controls for Story 2.4. Admins can deactivate active or invited ambassadors, reactivate deactivated ambassadors, see refreshed state on detail/roster surfaces, and get clear unsupported-state messaging for declined/withdrawn accounts. Deactivation persists the `deactivated` state only after default session revocation succeeds, emits `account.deactivated`, and existing ambassador sessions are verified as `SESSION_REVOKED`; reactivation restores `active`, emits `account.reactivated`, and does not revoke sessions.

Files changed:
- `src/features/ambassadors/schemas/account-lifecycle.ts` and test -- strict shared lifecycle action validation.
- `src/features/ambassadors/dal/admin.ts`, lifecycle unit tests, and integration tests -- admin-only state transitions, audit evidence, idempotency, target filtering, revocation failure handling, and real default revocation coverage.
- `src/lib/auth.ts`, `src/lib/auth/revocation.ts`, and revocation tests -- user-id default session revocation seam backed by local Supabase session-row verification, while preserving the injectable Supabase admin adapter test path.
- `src/app/api/ambassadors/[profileId]/route.ts` and test -- lifecycle PATCH dispatch, separate lifecycle/contact operation logging, and canonical error envelopes.
- `src/features/ambassadors/components/account-lifecycle-form.tsx`, `detail.tsx`, `copy.ts`, and tests -- accessible lifecycle controls, confirmation, pending/status feedback, unsupported-state copy, invited-state UI coverage, and detail integration.
- `e2e/ambassador-lifecycle.spec.ts` -- browser coverage for deactivate/reactivate, audit, roster/detail refresh, keyboard flow, Axe, strict revoked-session behavior, and paused magic-link routing.
- `_bmad-output/implementation-artifacts/spec-2-4-activate-deactivate-accounts-with-session-revocation.md` -- this story spec, review triage, verification evidence, and completion result.

Review findings:
- Patches applied: 6 (high 1, medium 3, low 2; follow-up score triggers because a high-severity patch was applied).
- Items deferred: 0.
- Items rejected: 5. Rejected findings covered acceptable zero-row revocation semantics when no sessions exist, already-logged post-revocation persistence failures, the lack of a Supabase user-id Admin API sign-out path after checking installed package types and official docs, a cosmetic/brittle style assertion that does not affect behavior, and broader generic-account interpretations excluded by Epic 2's ambassador lifecycle context.
- Follow-up review recommended: true.

Verification:
- `cmd.exe /d /s /c "npx vitest run src/features/ambassadors/components/account-lifecycle-form.test.tsx --reporter=dot"` -- passed: 1 file, 5 tests.
- `cmd.exe /d /s /c "npm run typecheck"` -- passed.
- `cmd.exe /d /s /c "npm run lint"` -- passed.
- `cmd.exe /d /s /c "npm test"` -- passed: 62 files passed, 1 skipped; 377 tests passed, 5 skipped.
- `cmd.exe /d /s /c "npm run build"` -- passed.
- `cmd.exe /d /s /c "npx playwright test ambassador-lifecycle.spec.ts --reporter=line"` -- passed: 1 test.
- `git diff --check` -- passed; only CRLF advisory warnings from the Windows-mounted checkout.

Residual risks:
- Default revocation is verified against local Supabase `auth.sessions` behavior and the app's direct database access; it remains coupled to Supabase Auth's session table shape because the installed Supabase Admin API signs out by JWT rather than by user id.
- Issued access JWTs can remain cryptographically valid until expiry; the app still relies on network-validated guards plus account-state checks to deny deactivated users after revocation.
