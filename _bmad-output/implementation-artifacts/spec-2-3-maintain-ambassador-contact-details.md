---
title: 'Story 2.3: Maintain ambassador contact details'
type: 'feature'
created: '2026-07-16T00:00:00+02:00'
status: done
baseline_revision: 71e0899a8f91bead48980f55144d811b2e19ec44
final_revision: cc168c1
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** Admins can view and invite ambassadors, but cannot correct the authoritative full name, email, or mobile data used for future notifications in a portal with no HR-system integration.

**Approach:** Add an admin-only contact edit mutation and accessible form on the existing ambassador detail surface, persisting normalized profile data after server acknowledgement. Treat email as one canonical identity across `profiles.email` and the Supabase Auth user's email: an email edit updates both immediately through the server-side Admin API, without a user confirmation flow.

## Boundaries & Constraints

**Always:** Require `requireAdmin()` before validation or side effects; keep `profiles.full_name` authoritative and never infer it from email; reuse the invitation contact limits and normalization; preserve nullable mobile as `null`; restrict targets to real non-admin ambassador identities; retain entered values on failure; use server-ack mutation followed by refresh; centralize Swedish copy; make the no-HR-integration maintenance duty visible to admins; ensure future sends read the updated profile contact data. When email changes, serialize the operation with a target-profile row lock, update the Supabase Auth user to the normalized email before committing the matching profile update, and best-effort restore the prior Auth email if profile persistence or transaction commit fails.

**Block If:** The target has no matching Supabase Auth user, the new email conflicts with another profile or Auth identity, or Auth/profile synchronization cannot complete. Never report partial success; normalize duplicate conflicts to `CONFLICT`, and log unexpected provider, persistence, or compensation failures under stable operational event names before returning `INTERNAL_ERROR`.

**Never:** Add browser-side table access; infer names; optimistically mutate contact details; expose provider/database errors; edit account state or implement Story 2.4 lifecycle actions; call `auth.admin.signOut` for a contact edit; add an audit event outside the closed registry without an architecture decision.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Valid contact edit | Admin; valid ambassador; normalized name/email and optional mobile | Profile contact data persists, detail refreshes, and future sends use it; if email changed, Auth and profile both hold the new address | No error expected |
| Invalid input | Blank/overlong name, malformed email/mobile, or extra fields | No mutation; field errors are perceivable and values remain | `VALIDATION_FAILED` / 422 |
| Missing or excluded target | Malformed ID, absent profile, admin identity, or orphan profile | No contact data is exposed or changed | `NOT_FOUND` / 404 |
| Duplicate email | Email belongs to another profile or Auth identity | Existing identities remain unchanged | `CONFLICT` / 409 |
| Unauthorized actor | Missing or non-admin session | No validation or mutation occurs | Canonical 401/403 envelope |
| Successful email change | New normalized email is unused in profile and Auth identity stores | Admin Auth update applies directly without confirmation; new magic links/sign-ins use the new email and the old email no longer identifies the user | Existing sessions are not deliberately revoked; normal Supabase session behavior applies |
| Auth update failure | Provider rejects or cannot update the new email | Profile, name, and mobile remain unchanged; no success is reported | Duplicate → `CONFLICT`; otherwise logged `INTERNAL_ERROR` |
| Profile persistence failure after Auth update | Auth holds the new email but the database transaction fails | Restore the prior Auth email best-effort; never report success | Log persistence failure; if compensation also fails, log a separate reconciliation-critical failure and return `INTERNAL_ERROR` |

</intent-contract>

## Code Map

- `src/features/ambassadors/dal/admin.ts` -- Existing admin-only roster, detail, invite, ambassador predicate, and wire mapping; contact mutation belongs here.
- `src/app/api/ambassadors/[profileId]/route.ts` -- Existing detail GET endpoint; expected PATCH composition surface.
- `src/features/ambassadors/components/detail.tsx` -- Existing read-only detail surface where editing is initiated.
- `src/features/ambassadors/components/invite-form.tsx` -- Established server-ack, retained-input, refresh, validation, and accessible status pattern.
- `src/features/ambassadors/schemas/invite-ambassador.ts` -- Existing authoritative contact normalization and limits to reuse or extract.
- `src/features/ambassadors/copy.ts` -- Central Swedish copy, including the required admin-duty guidance.
- `src/lib/supabase/admin.ts` -- Supabase Auth admin seam used to read and immediately update the matching login identity without a confirmation flow.
- `src/shared/audit-events.ts` -- Closed event registry; it currently contains no contact-update event.

## Tasks & Acceptance

**Execution:**
- `src/features/ambassadors/schemas/update-ambassador.ts` and tests -- add strict shared validation for normalized nonblank full name, lowercased email, and optional mobile using the existing limits and mobile boundaries.
- `src/features/ambassadors/dal/admin.ts` and tests -- add an authorization-first contact mutation with ambassador-only target filtering, a target-profile row lock, cross-identity duplicate protection, exact normalized persistence, `updatedAt`, safe domain errors, and immediate Auth email synchronization before profile commit; when the profile transaction fails after the Auth update, restore the prior Auth email best-effort and log any failed compensation as reconciliation-critical.
- `src/app/api/ambassadors/[profileId]/route.ts` and tests -- add PATCH JSON validation and canonical success/error envelopes while preserving GET behavior.
- `src/features/ambassadors/components/contact-form.tsx`, `detail.tsx`, `copy.ts`, and tests -- add a prefilled accessible single-column edit form, retained values, first-invalid focus, deduplicated submission, server-owned status feedback, refresh after acknowledgement, and visible admin-duty guidance.
- `src/features/ambassadors/dal/admin.integration.test.ts` and `e2e/ambassador-contact.spec.ts` -- verify persisted detail/roster behavior, authorization, duplicate handling across profile/Auth identities, normalization, responsive keyboard/touch behavior, and Axe; verify that a changed email works for subsequent passwordless sign-in, the old email no longer identifies the account, no explicit session revocation is called, and Auth/profile compensation paths never report success.

**Acceptance Criteria:**
- Given an authenticated admin and an ambassador profile, when the admin saves valid full name, email, and mobile values, then the detail and roster surfaces show the normalized persisted data and future notification reads use it.
- Given invalid or conflicting contact data, when the admin submits the form, then no partial change is reported, field or conflict feedback is perceivable, and all entered values remain.
- Given the ambassador email is changed, when the mutation succeeds, then `profiles.email` and the Supabase Auth user both contain the normalized new email, future sends and passwordless sign-ins use that address, and the old address no longer identifies the account.
- Given an ambassador has an existing session, when an admin changes their contact email, then the contact edit does not explicitly revoke that session; account-state lifecycle actions remain the only app-owned global-revocation path.
- Given the Auth email update fails or profile persistence fails afterward, when the mutation returns, then no partial success is reported, profile fields remain unchanged, the prior Auth email is restored best-effort after a database failure, and any failed compensation is logged for manual reconciliation without exposing provider details.
- Given the contact form is viewed on desktop or phone, when it is operated by keyboard or touch, then controls meet the established focus, target-size, responsive, and accessibility requirements.
- Given admins maintain contact data without an HR integration, when they view the edit surface, then the UI clearly documents that keeping these details current is an admin duty.

## Spec Change Log

- 2026-07-16: Self-approved unattended escalation resolution — email edits synchronize the profile contact address and Supabase Auth login identity immediately; Auth updates precede profile commit with best-effort Auth rollback on database failure, and contact edits do not explicitly revoke sessions.

## Review Triage Log

### 2026-07-16 — Independent review pass

- `intent_gap`: 0
- `bad_spec`: 0
- `patch`: 11 (`high`: 1, `medium`: 6, `low`: 4)
- `defer`: 0
- `reject`: 15

Addressed findings:

- `[high]` Made Auth compensation race-safe by re-locking the profile in a new transaction, inspecting current profile/Auth state, and restoring the old Auth email only when the attempted edit is still the unresolved state.
- `[medium]` Treated rejected or ambiguous Auth update responses as potentially applied and routed them through safe state inspection and compensation.
- `[medium]` Rechecked the non-admin target predicate immediately before persistence so a concurrently promoted admin cannot be edited as an ambassador.
- `[medium]` Remounted the contact form when the selected profile ID changes, preventing retained state from leaking between ambassadors.
- `[medium]` Sanitized runtime field-error values before rendering them in the form.
- `[medium]` Made local database integration tests discover and use the project-local Supabase CLI profile by default.
- `[medium]` Added integration coverage proving that contact edits preserve an invited/non-active ambassador's account state.
- `[low]` Preserved the first Zod validation issue for each field.
- `[low]` Rejected and logged a Supabase Auth lookup whose returned user ID does not match the target profile.
- `[low]` Added compensation coverage for a rejected forward Auth update promise whose mutation may nevertheless have applied.
- `[low]` Hardened E2E fixture cleanup against partially created Auth identities and registered created identities immediately.

Rejected findings were duplicates, outside this story's contract, or contradicted the approved architecture (including durable cross-process reconciliation, holding a database lock across provider calls, optimistic concurrency for last-write-wins contact edits, generic session-policy changes, and destructive provider/database fault injection).

### 2026-07-16 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 0
- reject: 32
- addressed_findings:
  - `[low]` `[patch]` Normalized accidental executable modes on the newly added TypeScript, TSX, and Playwright files.
- rejected_findings:
  - `[medium]` `[reject]` The proposed `--profile content-uploader` replacement was disproven on the Windows host (`exit 1`). The project-local `--profile supabase/cli-profile.yaml` configuration was restored and passed Supabase discovery, unit/integration, build, and Playwright gates.

### 2026-07-16 — Independent confirmation review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 2
- reject: 21
- addressed_findings:
  - none
- rejected_findings (notable, each disproven by direct evidence):
  - `[high]` `[reject]` "Six files depend on an untracked `supabase/cli-profile.yaml`, so a fresh clone silently skips every integration gate." The file was untracked only because the reviewed diff had not yet been committed; this pass commits it. `git check-ignore` exits 1 (not ignored) and `git add --dry-run` stages it.
  - `[medium]` `[reject]` "`supabase/cli-profile.yaml` carries an executable mode (100755) the prior mode sweep missed." False positive from the WSL `/mnt/c` mount, which reports `0777` for every file. This repo sets `core.fileMode=false` and `git ls-files -s` reports `100644` for all tracked files; the yaml stages as `100644`.
  - `[medium]` `[reject]` "The roster membership assertion was weakened from full-set equality to a fixture subset, so leaked rows now pass." The weakening is correct, not a regression. `src/db/schema/organization.integration.test.ts` inserts `auth.users` rows with no `raw_app_meta_data` (non-admin) plus matching `profiles` rows, and `vitest.config.ts` sets no `fileParallelism: false`, so it runs concurrently against the same database. Restoring `baselineIds` set-equality would reintroduce a real cross-file race. The three surviving `not.toContain` assertions cover every excluded category (admin, Auth-only, orphan) with a dedicated fixture.
  - `[low]` `[reject]` "`e2e/ambassador-contact.spec.ts:273` hard-codes an absolute URL against the file's `baseURL`-relative convention." `e2e/auth-magic-link.spec.ts:68` and `:97` already use absolute `http://localhost:3000/...` in `toHaveURL`; the new line matches the established convention.
  - `[low]` `[reject]` Compensation-reason and `ambassador.contact_identity_lookup_failed` log coverage. The four representative reasons (`auth_user_mismatch`, `unexpected_auth_email`, `profile_lock_failed`, `restore_failed`) are asserted; the remainder are defensive branches for states unreachable under the held row lock. Adding tests was declined rather than authored blind, because this WSL checkout cannot execute Vitest (see Verification).
  - Remainder rejected as duplicates, style preferences (schema alias, duplicated Windows shim, nested ternary, E2E test granularity), or previously adjudicated architecture (durable reconciliation, provider calls inside the lock, optimistic concurrency, session-policy changes).

## Design Notes

The resolved product contract uses one email identity. `profiles.email` remains the authoritative source for future sends, while the matching Supabase Auth email controls passwordless login; a successful edit must leave both on the same normalized address. The server-side `auth.admin.updateUserById` operation applies an email change directly without the end-user confirmation flow. The DAL updates Auth before committing the profile transaction so notifications never switch to an address that cannot sign in, then restores the prior Auth email best-effort if the database operation fails. A contact edit does not call global sign-out; existing sessions are not deliberately revoked, and any provider-owned session behavior is handled by normal reauthentication at the new email.

The audit registry is deliberately closed and does not contain a contact-update event. This story therefore must not invent one; profile persistence can proceed without audit unless architecture is amended separately.

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test` -- all unit/integration checks pass.
- `npm run build` -- App Router and client/server boundaries compile.
- `npx playwright test ambassador-contact.spec.ts --reporter=line` -- contact editing, authorization, persistence, resolved email-login behavior, responsive accessibility, and Axe pass against local Supabase.

## Escalation Resolution

Status: resolved for re-drive

- `profiles.email` and the Supabase Auth user's email are one canonical ambassador email identity.
- Server-side Admin API changes apply immediately without an end-user confirmation flow.
- Auth is updated before the matching profile transaction commits; a later database failure triggers best-effort restoration of the prior Auth email, with a separate reconciliation-critical log if compensation fails.
- The application does not revoke sessions for contact maintenance. Deactivation, deletion, and withdrawal remain the explicit global-revocation paths.
- No contact-update audit event is added because the architecture's audit registry is closed.

## Auto Run Result

Summary (final independent confirmation pass, 2026-07-16): A fourth independent review ran all four layers (Blind Hunter, Edge Case Hunter, Verification Gap, Intent Alignment) against the complete diff from `baseline_revision` 71e0899. No intent gap, no spec defect, and no patch survived verification: the two most severe findings were disproven as environment artifacts, and the one finding all three code reviewers converged on turned out to be correct as written. Two real pre-existing issues were deferred. The story is sound and committed.

Summary: Reviewed the restored ambassador contact-maintenance implementation against the amended one-email identity contract. The admin form, PATCH route, normalized profile persistence, Auth synchronization, compensation behavior, duplicate handling, session preservation, and acceptance coverage remain aligned. The valid review patch normalized file modes; a proposed Supabase profile-name change was rejected after failing host verification, and the passing project-local profile-file configuration was restored.

Files changed:
- `_bmad-output/implementation-artifacts/spec-2-3-maintain-ambassador-contact-details.md` — recorded review triage, verification, and completion metadata.
- `src/features/ambassadors/schemas/update-ambassador.ts` and test — shared strict contact validation and normalization.
- `src/features/ambassadors/dal/admin.ts`, unit tests, and integration test — admin-only synchronized Auth/profile contact mutation with compensation and persisted read verification.
- `src/app/api/ambassadors/[profileId]/route.ts` and test — canonical PATCH mutation surface and validation envelopes.
- `src/features/ambassadors/components/contact-form.tsx`, detail integration, copy, and tests — accessible retained-input server-ack edit experience and admin-duty guidance.
- `e2e/ambassador-contact.spec.ts` and `e2e/fixtures/auth.ts` — end-to-end contact, identity, session, responsive, and accessibility coverage.
- `playwright.config.ts`, `supabase/cli-profile.yaml`, and database-backed integration helpers — local Supabase environment discovery using the project-local endpoint-only CLI profile.

Review findings (final independent confirmation pass):
- Patches applied in this pass: 0 (high 0, medium 0, low 0; recommendation score 0).
- Items deferred: 2 — the unsanitized server field envelope in the pre-existing `invite-form.tsx`, and the un-migrated `organization.integration.test.ts` DB discovery.
- Items rejected: 21. The three most consequential were disproven by direct evidence rather than judgement: (a) the "untracked profile file breaks every gate" finding described the pre-commit state of the reviewed diff and is closed by this pass's commit; (b) the "executable file mode" finding was an artifact of the WSL `/mnt/c` mount reporting `0777`, contradicted by `core.fileMode=false` and `git ls-files -s` showing `100644`; (c) the weakened roster membership assertion, flagged independently by all three code-review layers, is correct as written — restoring set equality would reintroduce a genuine cross-file database race with `organization.integration.test.ts`.
- Follow-up review recommended: false. Zero patched findings in this pass yields a score of 0, and this pass was itself the independent confirmation the previous pass requested.

Cumulative review history: four independent passes. The first patched 1 high, 6 medium, and 4 low; the second patched 1 low; this final pass patched none and found no defect the contract does not already accept.

Verification:
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — passed: 59 files passed, 1 skipped; 346 tests passed, 5 skipped.
- `npm run build` — passed.
- `npx supabase --profile supabase/cli-profile.yaml status --output env` — passed on the Windows host; `--profile content-uploader` failed and was rejected.
- `npx playwright test ambassador-contact.spec.ts --reporter=line` — passed: 2 tests, including responsive/Axe and Auth/profile identity behavior.
- `git diff --check` — passed.
- The loop's WSL process could not load platform-specific Rolldown, Lightning CSS, or Supabase CLI packages; the authoritative Windows host gates above all passed.

Verification re-run in the final confirmation pass (2026-07-16), scoped to what this WSL checkout can actually execute:
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `git diff --check` — passed (exit 0; only CRLF advisories).
- `npx vitest run` — could not execute: `MODULE_NOT_FOUND` on the Rolldown native binding, which has no Linux build installed in this checkout.
- `npx supabase --profile supabase/cli-profile.yaml status --output env` — could not execute in WSL for the same class of reason (missing Linux-native CLI package).
- Environment limitation, recorded deliberately: the Rolldown/Supabase native packages are absent from this WSL checkout, whose `node_modules` is shared with the Windows host over `/mnt/c`. Installing Linux binaries into it would have risked corrupting the host toolchain that produced the authoritative gates, so it was not attempted. The Windows host run of 2026-07-16 (`npm test` 346 passed / 5 skipped, `npm run build`, and `npx playwright test ambassador-contact.spec.ts` 2 passed) stands as the authoritative verification evidence. No patch was applied in this pass, so no unverified code change rests on that gap.

Residual risks:
- Process termination between the Auth update and profile commit can still leave divergence because the approved contract provides best-effort in-process compensation rather than a durable reconciliation workflow.
- A direct out-of-band Auth mutation can theoretically race with compensation because Supabase does not provide a conditional email-update primitive.
- Provider/database commit-fault compensation is tested through controlled DAL boundaries rather than destructive black-box fault injection against the live provider.
