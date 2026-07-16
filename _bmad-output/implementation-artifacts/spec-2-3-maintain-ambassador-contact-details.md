---
title: 'Story 2.3: Maintain ambassador contact details'
type: 'feature'
created: '2026-07-16T00:00:00+02:00'
status: in-review
baseline_revision: '35ec6c623cb39798272cd6e247335e86e70aa200'
review_loop_iteration: 0
followup_review_recommended: true
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

Status: implemented and independently reviewed

Summary:

- Added the admin-only ambassador contact mutation, schema validation, canonical error mapping, Supabase Auth synchronization, race-safe best-effort compensation, and profile persistence.
- Added the accessible contact form to the ambassador detail surface with centralized Swedish copy, retained input, first-error focus, responsive target sizing, and server-acknowledged refresh behavior.
- Added unit, integration, and Playwright coverage for authorization, normalization, conflicts, account-state preservation, Auth/profile synchronization, compensation, passwordless identity behavior, responsive interaction, and Axe accessibility.
- Added a project-local Supabase CLI profile containing endpoint configuration only, avoiding mutation of the broken global CLI profile.

Review outcome:

- Findings patched: 11 (`high`: 1, `medium`: 6, `low`: 4).
- Intent gaps: 0. Bad-spec findings: 0. Deferred findings: 0.
- Follow-up review recommended: `true`; weighted score `22` (`3 × 6 medium + 4 low`).

Verification:

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed — 59 files passed, 1 skipped; 346 tests passed, 5 skipped.
- `npm run build`: passed.
- `npx playwright test ambassador-contact.spec.ts --reporter=line`: passed — 2 tests.
- `git diff --check`: passed; only line-ending warnings were reported.

Residual risks:

- Process termination between the Auth update and profile commit can still leave divergence because the approved contract provides best-effort in-process compensation rather than a durable reconciliation workflow.
- A direct out-of-band Auth mutation can theoretically race with compensation because Supabase does not provide a conditional email-update primitive.
- Provider/database commit-fault compensation is tested through controlled DAL boundaries rather than destructive black-box fault injection against the live provider.
