---
title: 'Story 2.5: Delete ambassador account record'
type: 'feature'
created: '2026-07-16T00:00:00+02:00'
status: 'done'
baseline_revision: 5349897e4731d64c3b34516e7c85b0c63ae52d32
final_revision: f857f46
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-4-activate-deactivate-accounts-with-session-revocation.md'
warnings:
  - oversized
---

<intent-contract>

## Intent

**Problem:** Admins can maintain and pause ambassador accounts, but cannot permanently remove the live Auth identity and profile contact record when an ambassador leaves.

**Approach:** Add an admin-only, consequence-confirmed account deletion path that removes the Supabase Auth user and `profiles` row, emits durable `account.deleted` evidence, and deliberately leaves uploaded content and acceptance evidence untouched for the later Epic 7 erasure workflow.

## Boundaries & Constraints

**Always:** Require `requireAdmin()` before validation or side effects; target only a real non-admin ambassador identity; globally revoke sessions before deletion; emit `account.deleted` with actor and pre-deletion identity/state snapshot so evidence survives row removal; remove the Auth user and profile row with no soft-delete state; return an acknowledged deletion result; keep the UI server-acknowledged and consequence-first; retain acceptance records and uploaded assets.

**Block If:** The current schema or provider behavior makes it impossible to preserve uploaded assets or acceptance records while deleting the Auth user/profile, or a durable decision is required about deleting any additional personal-data surface beyond Auth and `profiles`.

**Never:** Call `deleteAssets`; erase acceptance records or consent keys; perform Epic 7 full offboarding/erasure; cascade-delete uploaded content; add a `deleted` account state; expose provider/database errors; allow ambassadors or admins to delete admin identities; report success unless both live account records are gone and the audit event is durable.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Delete ambassador | Admin targets an invited, active, inactive, or deactivated ambassador | Sessions are revoked, Auth user and profile disappear, `account.deleted` retains a pre-delete snapshot, detail/roster no longer expose the account | No error expected |
| Missing or excluded target | Malformed ID, absent/orphan profile, or admin identity | No account data, audit, or provider deletion occurs | `NOT_FOUND` / 404 |
| Duplicate request | Account was already deleted | No second audit or destructive call is produced | `NOT_FOUND` / 404 |
| Revocation failure | Global sign-out cannot complete | No account deletion or audit commits | `INTERNAL_ERROR` |
| Auth deletion failure | Provider rejects deletion after revocation | Profile remains, no audit commits, and the operation is safely retryable | `INTERNAL_ERROR` |
| Persistence failure after Auth deletion | Auth user is gone but profile/audit transaction fails | Never report success; compensate or emit a critical reconciliation signal with stable context | `INTERNAL_ERROR` |
| Unauthorized actor | Missing or non-admin session | Body is not parsed and no validation, lookup, revocation, deletion, or audit occurs | Canonical 401/403 envelope |

</intent-contract>

## Code Map

- `src/features/ambassadors/dal/admin.ts` -- Existing admin lifecycle seam; add `deleteAccount(profileId)` orchestration, target locking, provider calls, profile deletion, audit snapshot, and reconciliation logging.
- `src/lib/auth/revocation.ts` -- Existing all-device session revocation required before account removal.
- `src/lib/supabase/admin.ts` -- Existing service-role client exposing Supabase Auth admin user deletion.
- `src/shared/audit.ts` and `src/shared/audit-events.ts` -- Transaction-only audit emitter and already-registered `account.deleted` event.
- `src/app/api/ambassadors/[profileId]/route.ts` -- Existing detail mutation endpoint; add the destructive HTTP surface while preserving GET/PATCH behavior and auth-before-body handling.
- `src/features/ambassadors/components/detail.tsx`, `copy.ts` -- Existing admin detail and centralized Swedish copy where the quiet deletion entry point and consequence language belong.
- `src/features/ambassadors/components/account-lifecycle-form.tsx` -- Existing server-acknowledged destructive confirmation pattern to keep consistent without making deletion optimistic.
- `src/db/schema/profiles.ts` and acceptance/content schemas -- Verify row relationships do not cascade into acceptance evidence or uploaded content.
- `e2e/ambassador-lifecycle.spec.ts` -- Existing lifecycle journey fixture and admin detail/roster assertions suitable for deletion coverage.

## Tasks & Acceptance

**Execution:**
- `src/features/ambassadors/dal/admin.ts` and focused unit/integration tests -- implement and verify admin-only `deleteAccount(profileId)` for all ambassador account states, row locking and admin exclusion, revocation, Auth deletion, profile deletion, transaction-scoped `account.deleted` snapshot evidence, no-op prevention, safe error normalization, and explicit post-provider reconciliation handling.
- `src/app/api/ambassadors/[profileId]/route.ts` and tests -- add a `DELETE` handler returning an acknowledged result; prove authorization precedes params/side effects, domain errors use canonical envelopes, and existing GET/PATCH surfaces remain unchanged.
- `src/features/ambassadors/components/delete-account-form.tsx`, `detail.tsx`, `copy.ts`, and tests -- add a quiet destructive section with explicit scope (“account/contact details only; uploads remain”), deliberate confirmation, deduplicated submission, pending/error status, accessible focus/touch targets, and roster navigation only after server acknowledgement.
- `src/db/schema/*` and `src/features/ambassadors/dal/admin.integration.test.ts` -- verify deleting Auth/profile cannot cascade into acceptance records or uploaded assets, and assert those records remain addressable after account deletion.
- `e2e/ambassador-lifecycle.spec.ts` or `e2e/ambassador-account-deletion.spec.ts` -- cover deletion from the admin detail surface, removal from detail/roster, inaccessible former login/session, retained uploaded content/acceptance evidence where fixtures permit, keyboard operation, and Axe.

**Acceptance Criteria:**
- Given an authenticated admin views any non-admin ambassador account, when they confirm account deletion, then the outer admin surface acknowledges completion, leaves the deleted detail page, and the ambassador no longer appears in roster/detail reads.
- Given deletion succeeds, when durable audit evidence is inspected, then one `account.deleted` event contains the admin actor and pre-deletion ambassador identity/account-state snapshot even though the Auth user and profile no longer exist.
- Given the ambassador has acceptance evidence or uploaded content, when the account record is deleted, then those records and assets remain intact and no asset-deletion or erasure path runs.
- Given the former ambassador has an active or attempted authenticated flow, when deletion completes, then all sessions are revoked and protected access/login cannot resolve to a live profile.
- Given deletion is used by keyboard or touch, when confirmation, pending, success, and failure states are exercised, then the destructive scope is explicit, submission is not duplicated, focus remains visible, touch targets meet the project minimum, and Axe reports no violations.

## Spec Change Log

## Review Triage Log

### 2026-07-16 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 0
- reject: 5
- addressed_findings:
  - `[low]` `[patch]` The reconciliation branch where `admin.deleteUser` *resolves with an error* while the identity is already gone (`authUserNoLongerExists` true → `authDeleted = true` → critical reconciliation) had no test; only the *thrown*-error variant and the post-Auth persistence failure were covered, so a silent regression could suppress the operator's only orphaned-Auth alert. Added a focused unit test in `admin.delete.test.ts` proving the resolved-error-but-gone path raises `ambassador.deletion_reconciliation_required` with `authDeleted: true` and commits no profile deletion or audit.
- notes: Independent follow-up review over the committed diff (baseline `5349897`..`159f1ac`) under all four lenses. Rejected candidates after inspection: (1) the DB transaction is held across the external revocation and Auth-deletion calls — deliberate and sanctioned by `## Design Notes` and already rejected in the prior pass's transaction-safety posture; (2) `snapshotTimestamp` could throw on an invalid date string — unreachable because `invitedAt`/`lastLoginAt` are DB timestamps (valid or null); (3) the audit snapshot omits `firstAcceptedAt`/`firstUploadAt` though they are selected — the intent requires only an identity/account-state snapshot, and adding them would introduce unrelated content the intent forbids; (4) dropping the cascading FK means an out-of-band Auth-user deletion now orphans a profile instead of cascading — the intent explicitly replaced the deletion-blocking FK with an insert/identity trigger, so this is by design (Epic 7 owns full erasure); (5) `authUserNoLongerExists` swallows `getUserById` exceptions and returns `false` — safe-by-design, defaulting to the retryable "Auth still exists" outcome.

**Automated review disposition:** 6 patch, 0 defer, 12 reject, 0 intent gap, 0 bad spec.

**Addressed findings:**
- **Medium:** Reconcile a lost/exceptional Auth-provider deletion response by checking whether the identity still exists and raising critical reconciliation context when it does not.
- **Medium:** Preserve database enforcement that every profile maps to an Auth identity by replacing the deletion-blocking foreign key with an insert/identity-update constraint trigger.
- **Medium:** Prove a previously authenticated ambassador session receives canonical `SESSION_REVOKED` denial after deletion.
- **Low:** Verify malformed successful responses do not navigate away or imply deletion succeeded.
- **Low:** Verify duplicate/concurrent deletion renders the dedicated `NOT_FOUND` administrator message.
- **Low:** Normalize new source, test, SQL, and Markdown file modes.

**Rejected after inspection:** unsupported concurrent admin-promotion semantics; deliberate route/DAL defense-in-depth authorization; roster navigation as an insufficient acknowledgement; unrelated-asset-fixture limitations; acceptance evidence not yet represented by a schema; provider calls inside the existing transaction safety posture; direct detail-read duplication; mocked test-title breadth; transaction commit acknowledgement uncertainty; and broad-erasure interpretations that conflict with Epic 2 boundaries.

## Design Notes

Auth deletion is an external side effect that the database cannot roll back. Follow the established lifecycle safety posture: lock and verify the ambassador, revoke sessions, delete the provider identity, then delete the profile and emit `account.deleted` in one database transaction. If database persistence fails after provider deletion, return `INTERNAL_ERROR` and raise a critical reconciliation event carrying only stable identifiers and operation state; never claim the account was fully deleted. Keep the audit snapshot free of unrelated content and ensure it is sufficient to evidence exactly which live account record was removed.

## Verification

**Commands:**
- `npm run typecheck` -- expected: TypeScript and route/component boundaries compile.
- `npm run lint` -- expected: ESLint import boundaries and style rules pass.
- `npm test` -- expected: DAL, route, UI, audit, retention, and regression tests pass.
- `npm run build` -- expected: Next.js App Router production build succeeds.
- `npx playwright test ambassador-account-deletion.spec.ts --reporter=line` -- expected: deletion journey, retained-scope assertions, accessibility, and former-account denial pass; run the updated lifecycle spec instead if coverage is added there.
- `git diff --check` -- expected: no whitespace or conflict-marker defects.

## Auto Run Result

**Summary:** Implemented permanent ambassador account-record deletion from the admin detail surface. The operation revokes sessions, removes the Supabase Auth identity and profile, emits a durable pre-deletion `account.deleted` audit snapshot, retains uploaded assets, and returns the administrator to the roster only after an exact server acknowledgement.

**Files changed:** Admin DAL orchestration and tests; ambassador DELETE route and tests; consequence-confirmed deletion form, detail integration, copy, and component tests; profile/Auth relationship migration and schema verification; dedicated Playwright deletion journey; this story artifact.

**Review:** Four clean-context review layers completed (adversarial, edge-case, verification-gap, intent-alignment). Six findings were patched. Follow-up review is recommended because the weighted addressed-findings score is 12.

**Verification:**
- `npm run typecheck` -- passed.
- `npm run lint` -- passed.
- `npm test` -- passed: 64 files passed, 1 skipped; 393 tests passed, 5 skipped.
- `npm run build` -- passed.
- `npx playwright test ambassador-account-deletion.spec.ts --reporter=line` -- passed: 1 test.
- `git diff --check` -- passed.

**Residual risks and environment notes:**
- Auth deletion and database persistence cannot be atomic; response-loss and post-provider failures emit reconciliation context but can still require operator intervention.
- The relationship migration must be deployed before enabling this endpoint because the old cascading foreign key conflicts with retaining the profile until the audited database transaction.
- Normal local migration application is blocked by a pre-existing Supabase migration-history mismatch at `20260715110614`; the relevant schema change was applied directly to the local test database for verification. No migration history was reset or repaired.
- Direct acceptance-record retention cannot yet be integration-tested because that persistence schema is not implemented; the deletion path does not call an erasure or acceptance-deletion surface.

## Auto Run Result — Follow-up Review (2026-07-16)

**Summary:** Independent follow-up review of the committed implementation against this spec and its baseline. The prior verified deletion behavior stands; one low-severity verification gap was patched by adding a unit test, and five candidates were rejected after inspection.

**Files changed this pass:**
- `src/features/ambassadors/dal/admin.delete.test.ts` -- added a unit test proving the resolved-provider-error-but-identity-already-gone path raises the critical reconciliation signal (`authDeleted: true`) without committing profile deletion or audit.
- `_bmad-output/implementation-artifacts/spec-2-5-delete-ambassador-account-record.md` -- follow-up triage entry, this result, and updated review metadata.

**Review findings breakdown:** 1 patch (low) applied; 0 deferred; 5 rejected; 0 intent_gap; 0 bad_spec.

**Follow-up review recommendation:** false. This pass patched 1 low finding and 0 high/medium; score = `3 × 0 + 1 × 1 = 1` (below the threshold of 5).

**Verification:**
- `npm run typecheck` -- passed.
- `npm run lint` -- passed.
- `npm test` -- passed: 64 files passed, 1 skipped; 394 tests passed (was 393; +1 new test), 5 skipped.
- `npm run build` -- passed.
- `git diff --check` -- passed (only pre-existing CRLF advisories from the Windows-mounted checkout).
- `npx playwright test ambassador-account-deletion.spec.ts` -- not re-run: only a mocked unit test changed this pass, so the deletion journey, retained-scope, accessibility, and former-account-denial coverage are unaffected; the prior passing run remains valid.

**Residual risks:** Unchanged from the original result above.

**Residual artifacts (not part of this change, left in place):** `next-env.d.ts` was regenerated by `npm run build` (Next.js switched the generated route-types import from `./.next/dev/types/routes.d.ts` to `./.next/types/routes.d.ts`). It is unrelated to this review and was deliberately not committed.
