---
title: 'Story 2.2: Invite ambassadors by email'
type: 'feature'
created: '2026-07-15T00:00:00+02:00'
status: done
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: [oversized]
baseline_revision: d20c5aad193b7073215d350ed16112a05bb6b1fc
final_revision: 2758b18
---

<intent-contract>

## Intent

**Problem:** Admins cannot yet create an ambassador account or send the passwordless invitation that begins onboarding, and launch-critical invitation failures have no visible state.

**Approach:** Add an admin-only invite form and `POST /api/ambassadors` mutation backed by a validated ambassadors DAL operation. The operation creates the Supabase invited identity, persists its invited profile and KPI/audit evidence, reports immediate delivery acceptance without pretending it proves delivery, and leaves an explicit trackable status seam for Epic 5 bounce handling.

## Boundaries & Constraints

**Always:** Require a nonblank authoritative full name and valid normalized email; accept optional mobile; call `requireAdmin()` before validation or side effects; use `inviteUserByEmail` with `/auth/confirm` as the redirect; persist `accountState: invited` and one authoritative `invitedAt`; emit `account.invited`; normalize all provider/database failures to safe domain errors; retain form input on failure; invalidate the roster only after server acknowledgement; centralize Swedish visible copy; make immediate invite acceptance/failure visible and accessible.

**Block If:** Implementing durable bounce/delivery-event tracking requires pulling the Epic 5 Brevo messaging adapter or `send_records` model into this story; the current story must expose a truthful pending/accepted seam, not invent delivery certainty.

**Never:** Create passwords; infer full name from email; invite admin identities; use browser-side Supabase table access; optimistically add a roster row; expose raw Supabase errors; claim an accepted invite is delivered; silently leave an auth identity after local persistence fails; add resend/contact-edit/lifecycle behavior from later stories.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Valid invite | Admin; trimmed name/email; optional mobile | 201 response; auth invite requested; invited profile, `invitedAt`, audit evidence, and trackable accepted status exist; roster refreshes | No error expected |
| Invalid input | Blank name, malformed email, or invalid mobile | No provider or database call; field errors appear on blur/submit and values remain | `VALIDATION_FAILED` / 422 |
| Existing identity | Email already belongs to any auth user/profile | No duplicate profile or misleading success | `CONFLICT` / 409 |
| Provider rejection | Supabase rejects invite request | No local profile/audit row is created; safe retry guidance is shown | Safe 500-class response; raw detail hidden |
| Local persistence failure | Auth invite succeeds but profile transaction fails | Best-effort delete of the newly created auth identity is attempted and failure is logged; UI never reports success | Safe 500-class response; no silent orphan |
| Unauthorized actor | Missing or non-admin session | No validation, provider call, or data mutation occurs | Canonical 401/403 envelope |

</intent-contract>

## Code Map

- `src/features/ambassadors/dal/admin.ts` -- Existing `requireAdmin()`-guarded roster/detail DAL and profile wire mapping; add invitation orchestration here.
- `src/lib/supabase/admin.ts` -- Service-role Supabase Auth client used for invite creation and compensation.
- `src/shared/audit.ts` -- Transaction-only audit emitter for `account.invited` evidence.
- `src/app/api/ambassadors/route.ts` -- Existing roster GET composition seam; add the interactive POST mutation.
- `src/app/(admin)/admin/ambassadors/page.tsx` -- Existing roster/empty-state surface where the invite entry action belongs.
- `src/features/ambassadors/copy.ts` -- Central Swedish copy and validation/status ownership.
- `supabase/templates/invite.html` and `src/app/auth/confirm/route.ts` -- Existing single confirmation front door; preserve rather than duplicate.

## Tasks & Acceptance

**Execution:**
- `package.json`, lockfile, `src/features/ambassadors/schemas/invite-ambassador.ts`, and co-located tests -- add pinned Zod 4 and one shared schema for trimmed full name/email and optional mobile, including blank, malformed, casing/whitespace, and null/empty mobile boundaries.
- `src/features/ambassadors/dal/admin.ts` and tests -- implement `inviteAmbassador`; authorize first, reject matching identities from both `auth.users` and `profiles`, call Supabase invite with an HTTP(S) allow-listed confirmation redirect, transactionally create the invited profile and audit event, return an explicit server-owned `deliveryStatus: accepted`, and compensate a post-invite persistence failure by deleting the newly created auth identity. Enforce bounded email/name inputs and test call ordering, persisted normalized contact fields, exact timestamp/actor/entity audit snapshot, concurrent/duplicate/provider/transaction/compensation failures, and that no success is returned for an orphan.
- `src/app/api/ambassadors/route.ts` and tests -- add strict JSON parsing/validation and canonical 201, 401, 403, 409, 422, and safe 500 responses for POST while preserving GET behavior.
- `src/features/ambassadors/components/invite-form.tsx` and tests -- build the single-column client form with blur-and-submit validation, optional mobile, one deduplicated submit, retained values, safe handling of non-JSON failures, accessible pending/success/failed-final feedback, and `router.refresh()` only after an explicit server-owned accepted status so the server-rendered roster visibly refreshes without navigation or manual reload.
- `src/features/ambassadors/copy.ts`, `src/app/(admin)/admin/ambassadors/page.tsx`, and page/component tests -- centralize all Swedish strings; expose a clear invite action from populated and empty roster states without breaking cursor recovery, responsive navigation, or Fleet Deck constraints.
- `e2e/ambassador-invite.spec.ts` -- prove the outer journey: unauthorized/non-admin denial, validation and retained input after duplicate/provider failures, successful invitation appearing without manual reload with normalized full name/email/mobile, stored `invited_at`, the actual captured invite email link continuing through `/auth/confirm`, safe provider failure, keyboard/touch-target behavior, and Axe.

**Acceptance Criteria:**
- Given an authenticated admin supplies a nonblank full name and email, when they submit the invite form, then the outer UI reports accepted-for-delivery, the roster shows the invited ambassador, and the invitation link is the ambassador's passwordless first-login route through `/auth/confirm`.
- Given the invite form on desktop or phone, when a field blurs or the form is submitted, then validation is perceivable, the single-column form remains keyboard/touch accessible, and entered values survive every error.
- Given an invitation is rejected immediately or later delivery has not yet been confirmed, when the admin observes the result, then the surface never claims delivery and preserves a trackable status seam for Epic 5 rather than silently losing failure state.

## Spec Change Log

### 2026-07-15 — Review repair 1

- Triggering findings: the initial plan prescribed TanStack cache invalidation for an RSC-only roster, allowed profile-only duplicate detection, left accepted delivery status implicit, and did not make normalized persistence, complete audit evidence, provider failure, or the actual emailed invitation link directly observable in tests.
- Amendment: replaced the no-op cache task with `router.refresh()`, required duplicate checks across auth/profile identity surfaces, bounded validation and redirect protocols, explicit accepted status, safe non-JSON handling, exact persistence/audit assertions, and browser verification against the captured invitation link without a manual reload.
- Known-bad state avoided: a successful invite whose roster stayed visibly stale, orphan identities reached provider-dependent behavior, or tests passed while omitting contact/audit data and substituting a separately generated magic link.
- KEEP: preserve authorization-first execution, shared Zod validation, Supabase `inviteUserByEmail`, transactional profile plus `account.invited` audit evidence, best-effort auth compensation, centralized Swedish form copy, retained input, safe provider errors, responsive accessibility, and the truthful boundary that durable bounce handling completes in Epic 5.

## Review Triage Log

### 2026-07-15 — Review pass
- intent_gap: 0
- bad_spec: 7: (high 3, medium 4, low 0)
- patch: 0
- defer: 1: (high 0, medium 1, low 0)
- reject: 14: (high 0, medium 8, low 6)
- addressed_findings:
  - `[high]` `[bad_spec]` Roster invalidation targeted an unused TanStack key; amended the task and outer test to require an observable RSC refresh without reload.
  - `[high]` `[bad_spec]` Duplicate handling did not cover orphan auth identities or concurrency; required both identity surfaces and explicit boundary verification.
  - `[high]` `[bad_spec]` The browser test substituted a generated magic link for the invitation email link; required the captured invite link itself.
  - `[medium]` `[bad_spec]` Accepted delivery state was implicit in a generic 201; required an explicit server-owned status while retaining Epic 5 as the durable bounce surface.
  - `[medium]` `[bad_spec]` Persisted normalized contact fields and the complete audit snapshot were not asserted; made both exact verification targets.
  - `[medium]` `[bad_spec]` Provider rejection and retained outer-form input were not directly exercised; added them to the browser matrix.
  - `[medium]` `[bad_spec]` Validation and redirect bounds were underspecified; required bounded inputs, centralized safe copy, non-JSON failure handling, and HTTP(S) redirect validation.

### 2026-07-15 — Review pass 2
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 1, medium 3, low 2)
- defer: 0
- reject: 21: (high 0, medium 13, low 8)
- addressed_findings:
  - `[high]` `[patch]` A missing row from `returning()` could emit ghost invitation audit evidence; moved the row assertion before audit emission inside the transaction.
  - `[medium]` `[patch]` Duplicate lookup scanned the entire Supabase Auth directory; replaced it with one database-side existence query across profiles and auth identities and added safe failure logging.
  - `[medium]` `[patch]` Mobile validation admitted unusable digit counts; added centralized 7–15 digit bounds after formatting removal and boundary tests.
  - `[medium]` `[patch]` Route verification had lost GET error coverage and did not assert field-error envelopes; restored exact regression tests.
  - `[low]` `[patch]` Retained-value verification covered only the name; added email and mobile assertions.
  - `[low]` `[patch]` Generated artifacts and misleading test naming obscured review; cleaned generated output and aligned the test description with provider-race behavior.

### 2026-07-15 — Review pass 3 (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 2, low 0)
- defer: 2: (high 0, medium 2, low 0)
- reject: 19: (high 0, medium 6, low 13)
- addressed_findings:
  - `[medium]` `[patch]` Submit-time client validation errors were silent to assistive tech (focus stayed on the submit button and the per-field errors sit outside the polite live region), leaving keyboard/screen-reader admins with no feedback on an invalid submit; now `submit()` moves focus to the first invalid field so its `aria-describedby` error is announced, satisfying the "validation is perceivable when the form is submitted" acceptance criterion.
  - `[medium]` `[patch]` The `confirmationRedirect()` allow-list guard (open-redirect protection on the emailed invite link) had zero test coverage — deleting it kept every test green; added unit cases asserting `inviteAmbassador` rejects a non-allow-listed origin and a missing `NEXT_PUBLIC_APP_URL` before the provider is called.

### 2026-07-16 — Review pass 4 (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 0, medium 3, low 3)
- defer: 1: (high 0, medium 1, low 0)
- reject: 23: (high 0, medium 16, low 7)
- addressed_findings:
  - `[medium]` `[patch]` The provider duplicate branch matched on bare HTTP status (`invitation.error?.status === 422`), but Supabase shares 422 across `email_exists`, `signup_disabled`, and `email_address_invalid` (verified in `@supabase/auth-js` `error-codes.d.ts`). With signups disabled, every brand-new address would be reported to the admin as "Det finns redan ett konto med den e-postadressen" with no telemetry; now the branch matches `error.code === "email_exists"`, all other provider rejections fall through to the safe 500-class path, and the provider-failure log records the discriminating `code`.
  - `[medium]` `[patch]` `inviteAmbassador` called `schema.parse()` and let a raw `ZodError` escape the DAL, violating the project's DAL-throws-`DomainError` contract; it only produced a canonical envelope because the route happens to catch `ZodError` first. Any non-route caller would have turned a validation mistake into a logged 500. Now the DAL `safeParse`s and throws `DomainError("VALIDATION_FAILED")`, with a test pinning the contract.
  - `[medium]` `[patch]` The `role="status"` live region never reset: after a successful invite `mutation.isSuccess` stayed true indefinitely, so the region kept asserting "Inbjudan har accepterats för leverans" while the admin typed a *different* ambassador's details — a screen-reader admin could not distinguish a fresh result from a stale one. The mutation now resets on field edit (never mid-flight), with a test scoped to the status region.
  - `[low]` `[patch]` `confirmationRedirect()` was evaluated inside the `try` that catches provider errors, so a missing or non-allow-listed `NEXT_PUBLIC_APP_URL` was logged as `ambassador.invite_provider_failed` / `operation: inviteUserByEmail` — pointing on-call at Supabase's email service for a config fault. It is now resolved before the provider try-block and logged as `ambassador.invite_redirect_misconfigured`.
  - `[low]` `[patch]` A `z.strictObject` unrecognized-key rejection carries an empty issue path, producing a 422 with an empty `fields: {}` object, while the malformed-JSON branch omits `fields` entirely — two envelope shapes for one error code. `fields` is now omitted when empty.
  - `[low]` `[patch]` The "persists normalized fields" assertion lived inside the `tx.insert().values()` mock factory, so a refactor that stopped calling `values()` would skip the assertion and still report green. Insert values are now recorded on a spy and asserted after the call.

## Design Notes

Supabase Auth and Postgres cannot share a transaction. Invite the identity first because Supabase owns email dispatch, then create the profile and audit evidence in one database transaction. If that transaction fails, delete only the newly created auth identity as compensation and log compensation failure; never report success. This bounds orphan risk while truthfully acknowledging that an already accepted email cannot be retracted.

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test` -- all unit/integration checks pass.
- `npm run build` -- App Router/client-server boundaries compile.
- `npx playwright test ambassador-invite.spec.ts --reporter=line` -- the local-Supabase invite journey, authorization, responsive form, and Axe checks pass.

## Auto Run Result

Status: done

- Implemented the admin invitation form, validated POST mutation, Supabase passwordless invite, invited profile/KPI creation, exact audit evidence, duplicate protection across profile/auth identities, compensation, and truthful accepted-for-delivery feedback.
- Changed configuration/dependencies for the canonical application origin and pinned Zod; added shared invitation limits/schema, DAL/API/UI implementation, centralized Swedish copy, and unit, route, component, and Mailpit-backed Playwright coverage. Also repaired adjacent React lint structure and the slow boundary-test timeout required by the full repository gate.
- Review findings: pass 1 repaired 7 specification issues; pass 2 applied 6 patches (high 1, medium 3, low 2), deferred 0, and rejected 21 review items as duplicates, architecture-expanding proposals, or claims contradicted by the captured Mailpit link test.
- Follow-up review recommendation: true; patched score is high-severity-triggered, with weighted non-high score `3 × 3 + 1 × 2 = 11`.
- Verification passed: typecheck, lint, 281 Vitest tests (7 skipped), production build, and 2 dedicated Playwright invitation tests including authorization, validation, responsive/Axe coverage, visible RSC refresh, normalized persistence, and the actual captured invitation link through `/auth/confirm`.
- Residual risk: immediate provider acceptance is intentionally not delivery confirmation; durable bounce and delivery-event tracking remains Epic 5 scope. Cross-system same-email races rely on Supabase Auth rejecting the second provider call, normalized to `CONFLICT`.

### Follow-up review pass (2026-07-15, pass 3)

- Re-reviewed the committed change (diff since baseline `d20c5aa`) with four parallel adversarial layers (blind hunter, edge-case hunter, verification-gap, intent-alignment).
- Applied 2 patches: (1) focus the first invalid field on submit so screen-reader admins perceive submit-time validation errors; (2) added negative unit tests pinning the `confirmationRedirect()` allow-list guard against open-redirect regressions.
- Deferred 2 findings (both recorded in `deferred-work.md`): a freshly invited ambassador may not appear on the roster's first page because pagination orders by the random-UUID `profiles.id` (root cause is Story 2.1's pagination contract); and the invite DAL's compensation/orphan path plus the `auth.users` duplicate branch have no CI-executing integration coverage.
- Rejected 19 findings as noise, by-design residual risk already documented in the intent (best-effort orphan compensation, accepted≠delivered), provider-backed invariants (email uniqueness), admin-gated/low-probability edges, or defensible interpretation gaps.
- Follow-up review recommendation: true; patched score is `3 × 2 (medium) + 1 × 0 (low) = 6`, at or above the threshold of 5.
- Verification re-run and passed: typecheck, lint, 283 Vitest tests (7 skipped; +2 new), production build, and the 2 Mailpit-backed Playwright invitation tests against local Supabase.

### Follow-up review pass (2026-07-16, pass 4)

- Re-reviewed the committed change (diff since baseline `d20c5aa`, 20 files) with four parallel adversarial layers (blind hunter, edge-case hunter, verification-gap, intent-alignment).
- Applied 6 patches (medium 3, low 3), all confined to the invite surface:
  - `src/features/ambassadors/dal/admin.ts` — narrowed the duplicate branch from bare HTTP 422 to `error.code === "email_exists"` (Supabase shares 422 with `signup_disabled` and `email_address_invalid`, verified against the installed `@supabase/auth-js` error-code union); replaced the escaping `ZodError` with `DomainError("VALIDATION_FAILED")` to honor the DAL error contract; hoisted `confirmationRedirect()` out of the provider try-block so config faults log as `ambassador.invite_redirect_misconfigured` rather than as a provider failure; added the provider `code` to failure telemetry.
  - `src/features/ambassadors/components/invite-form.tsx` — the settled mutation now resets on field edit (never mid-flight), so the `role="status"` live region stops announcing a previous invite's outcome while the admin types a new one.
  - `src/app/api/ambassadors/route.ts` — omit `fields` from the 422 envelope when empty, matching the malformed-JSON branch.
  - Tests — moved the persistence assertion out of the `tx.insert().values()` mock factory onto a recorded spy (it could previously skip silently), and added coverage for the DAL validation contract, the non-duplicate 422 codes, the misconfigured-redirect log, and the live-region reset.
- Deferred 1 finding (appended to `deferred-work.md`): `scripts/create-admin.ts` still reads the pre-canon `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` names with `?? ""` fallbacks — pre-existing, but this story left it the sole holdout after renaming the sibling factory.
- Rejected 23 findings: by-design residual risk already stated in the intent (an accepted invitation email cannot be retracted by compensation; accepted ≠ delivered), the `deliveryStatus` seam reading already ratified in review pass 1 (Epic 5 owns the durable bounce surface; a `profiles` delivery column would invent schema the architecture assigns to `send_records`), authorize-before-validate requiring `requireAdmin()` at both the route and the DAL choke point, provider-backed invariants (`auth.users` email uniqueness), established project conventions (server-side `NEXT_PUBLIC_*` reads, per `src/lib/supabase/env.ts`), speculative future divergence (blur overwriting server-only field errors that no rule currently produces), and duplicates of open ledger entries (the repo-wide `TEST_DATABASE_URL`-absent CI integration-skip gap, already tracked for stories 1.2–1.6 and 2.2).
- Follow-up review recommendation: true; patched score is `3 × 3 (medium) + 1 × 3 (low) = 12`, at or above the threshold of 5, with no high-severity patch.
- Verification re-run and passed: typecheck, lint, 288 Vitest tests (7 skipped; +5 new), production build, and the 2 Mailpit-backed Playwright invitation tests against local Supabase. Note: two earlier full-suite runs reported 4 `vitest-pool` "Timeout waiting for worker to respond" errors that prevented 4 files from starting (266 of the expected 288 tests ran); a clean re-run completed all 56 files with 0 errors, confirming WSL worker-startup flake rather than a test failure.
- Residual artifacts left in place (not part of this change, not committed): `_bmad-output/implementation-artifacts/sprint-status.yaml` (orchestrator-owned, already modified when this run started), `next-env.d.ts` (regenerated by `npm run build`), and untracked `test-results/` (Playwright output).
- Residual risk: unchanged from pass 3. Additionally, the narrowed 422 branch now depends on Supabase populating `error.code`; a provider that returns 422 for a genuine duplicate without the `email_exists` code would surface a safe 500-class failure instead of `CONFLICT` — a truthful degradation rather than the previous misleading "account already exists", and the pre-invite database duplicate check remains the primary guard.
