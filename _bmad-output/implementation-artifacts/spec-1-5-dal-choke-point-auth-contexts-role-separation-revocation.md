---
title: '1.5 DAL choke point, auth contexts, role separation & revocation'
type: 'feature'
created: '2026-07-14T00:00:00+02:00'
status: done
baseline_revision: 21e547528eaf77dd5eacc88d8f8dfa8e12afb2c8
final_revision: ece5085fd50495a6fe49a68e61b4742d31677c14
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** Authenticated data access does not yet have the required server-only authorization choke point, role-scoped contexts, canonical domain-error translation, centralized client auth-error handling, or global session-revocation foundation. The current schema also cannot satisfy every requested RLS and consent-version guarantee without work explicitly assigned to later stories.

**Approach:** Establish the common auth, error, DAL-boundary, provisioning, and revocation contracts now without moving later feature-owned schemas or mutations forward. The ambassador consent gate is fail-closed behind a server-only provider contract until Story 3.1 supplies the real terms/acceptance implementation; Story 1.5 proves both current and stale outcomes with an injected provider, but production protected ambassador access remains `CONSENT_REQUIRED` until that provider is replaced. Apply policy-complete RLS to every table that exists in this story's baseline; each future table or bucket must add and test its own ownership policy in its creating story. Provide the idempotent all-device revocation primitive now, while Stories 2.4, 2.5, and 3.3 remain responsible for calling it from their mutations.

## Boundaries & Constraints

**Always:** Every session guard network-validates with `getUser()` and loads account state; admin authority comes only from server-controlled `app_metadata.admin`; normal ambassadors pass a consent-version gate while admins do not; pre-consent and system contexts remain import-restricted; app routes/components cannot import the DB client; browser Supabase remains Auth/TUS-only; domain errors use safe canonical envelopes and unexpected errors alone reach the structured logger; global revocation uses the service-role admin client and invalidates all devices; RLS and private storage are defense-in-depth.

**Block If:** A guard can reach data without network-validated `getUser()` identity, the unresolved consent provider can fail open, a current table cannot be given a least-privilege policy, or app code can bypass the role-scoped DAL. `getSession()` may be consulted only as non-authoritative evidence that a request previously carried a session: no session plus failed `getUser()` maps to `AUTH_REQUIRED`; a locally present session plus failed `getUser()` maps to `SESSION_REVOKED`. It never grants identity or authorization.

**Never:** Use `getClaims()` as the DAL security boundary; encode admin role in `profiles`; expose provider errors; log domain errors as incidents; allow client `.from()` table access; invent a partial consent-version test from `first_accepted_at`; create permissive RLS that cannot express ownership; hand-roll feature-local guards or auth redirects; add Sentry.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Ambassador request | Network-valid user, active profile, consent provider reports current | Ambassador context with safe actor/profile fields | Production provider fails closed with `CONSENT_REQUIRED` until Story 3.1 supplies the real store |
| Admin request | Network-valid user, admin metadata, allowed profile state | Admin context without consent gate | No error expected |
| Role violation | Ambassador calls admin DAL | No data access | `FORBIDDEN` / 403 safe envelope |
| Inactive account | Any authenticated DAL call for deactivated profile | No data access; paused surface | `ACCOUNT_INACTIVE` / 403 |
| Consent required | Ambassador lacks current terms acceptance | No protected data access; consent continuation | `CONSENT_REQUIRED` / 409 |
| Revoked session | Global sign-out followed by another device request | No data access; login continuation | `SESSION_REVOKED` / 401 once detection contract is resolved |
| System work | Approved webhook/cron entry | System actor with null id and `system` snapshot | Import boundary rejects all other callers |

</intent-contract>

## Code Map

- `src/proxy.ts` -- already performs cheap `getClaims()` route gating and cookie refresh; it must remain non-authoritative.
- `src/lib/supabase/server.ts` -- cookie-bound user client used for network validation.
- `src/db/client.ts` -- server-only Drizzle client that app surfaces must reach only through authorized core/DAL modules.
- `src/db/schema/profiles.ts` -- five-state account model; has no role column and no consent-version relation.
- `src/shared/error-codes.ts` -- canonical code-to-status registry.
- `src/shared/logger.ts` -- redacting structured platform logger for unexpected failures.
- `eslint.config.mjs`, `eslint-boundaries.test.ts` -- existing feature, worker, shared, ambassador/admin, and route DB boundaries.
- `supabase/migrations/20260714130824_petite_tenebrous.sql` -- enables RLS and revokes public table grants, but has no ownership policies or private buckets.
- `supabase/config.toml` -- currently uses a 3600-second JWT expiry rather than the approved 600 seconds.

## Tasks & Acceptance

**Execution (approved seam-first sequencing):**
- `src/lib/auth.ts` and co-located tests -- implement the four context functions, account-state/role checks, RSC redirects, actor shapes, and network-validation matrix.
- `src/lib/errors.ts` and tests -- implement typed domain errors, safe envelopes, canonical status mapping, and unexpected-only logging adapter.
- `src/lib/supabase/admin.ts`, `src/lib/auth/revocation.ts`, and tests -- add the service-role client and idempotent global all-device revocation primitive.
- `src/features/ambassadors/dal/{ambassador,admin}.ts` and tests -- add representative role-scoped profile access and role-specific wire types, proving own-data scoping and server-side denial.
- `src/features/consent/dal/` and tests -- own the pre-consent allowlist and a server-only consent-status provider contract; ship a fail-closed production placeholder and inject current/stale providers in guard tests. Story 3.1 replaces the placeholder with the real terms/acceptance query.
- `src/lib/query-client.ts`, application provider wiring, and tests -- centralize `SESSION_REVOKED` and `CONSENT_REQUIRED` browser routing with safe `next` and loop prevention.
- `src/app/auth/paused/page.tsx`, `src/app/auth/confirm/route.ts`, and tests -- expose the deactivated-account surface and state-aware post-verification routing.
- `scripts/create-admin.ts`, `src/lib/supabase/admin.ts`, `package.json`, and tests -- provide idempotent service-role provisioning that preserves unrelated app metadata and never writes a profile role.
- `eslint.config.mjs`, `eslint-boundaries.test.ts` -- close DB bypasses from app actions/helpers and restrict pre-consent/system contexts and browser table access.
- `supabase/migrations/`, schema files, and local integration tests -- add policy-complete least-privilege RLS for every table present at the Story 1.5 baseline. Do not create assets, future ownership columns, or storage buckets early; the story that creates each future table/bucket must add its policy and integration matrix in the same migration.
- `supabase/config.toml` and tests -- set access JWT expiry to 600 seconds.
- `e2e/` -- prove current-schema role denial, paused routing, fail-closed consent routing, and the all-device revocation primitive against local Supabase. Later mutation-owner stories add producer-level revocation journeys.

**Acceptance Criteria:**
- Given any app-tier authenticated data operation, when it reaches data access, then a role-scoped server-only DAL calls `getUser()`, checks profile state and the applicable role/consent rules, while proxy routing remains claims-only and app surfaces cannot import the DB client.
- Given each approved auth context, when it is called from an allowed surface, then its actor, state, role, consent, and redirect behavior matches the context contract and forbidden imports fail lint tests.
- Given an ambassador attempts admin access, when the DAL and wire output are exercised, then the request receives `FORBIDDEN`, own-data scope is preserved, and admin-only fields are absent at both compile-time and runtime.
- Given every table present at the Story 1.5 baseline, when anon, authenticated ambassador, admin, and service clients exercise access, then local-Supabase integration tests prove least-privilege RLS without relying on UI checks; future table/bucket policies remain atomic acceptance criteria of their creating stories.
- Given the reusable revocation primitive is invoked, when another device next performs an authenticated data request, then global sign-out plus the account-state choke point prevents data access and the outer surface reaches login or the paused page with canonical error behavior; deactivate/delete/withdraw producers remain owned by Stories 2.4, 2.5, and 3.3.
- Given a domain or unexpected error crosses an app boundary, when the route/action/query layer handles it, then domain errors become the canonical safe envelope without incident logging, while unexpected errors are redacted and recorded once.

## Spec Change Log

- 2026-07-14: Autonomous sequencing resolution approved. Keep later schemas and mutations with their owning stories; implement fail-closed/provider-based consent, current-schema RLS, and the reusable global-revocation primitive in Story 1.5. Classify `SESSION_REVOKED` using local session presence only as evidence after authoritative `getUser()` failure.

## Review Triage Log

### 2026-07-14 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 12: (high 7, medium 4, low 1)
- defer: 0
- reject: 1: (high 0, medium 0, low 1)
- addressed_findings:
  - `[high]` `[patch]` Closed pre-consent, system-context, browser-client, and transitive database import bypasses with exact ESLint boundaries and fixtures.
  - `[high]` `[patch]` Hardened all baseline RLS policies and added a required local anon/inactive/ambassador/admin/service matrix across all six tables.
  - `[high]` `[patch]` Made admin provisioning paginated and idempotent, preserved metadata, and upserted the active profile required by the auth choke point.
  - `[high]` `[patch]` Added representative ambassador/admin DAL tests and safe outer error-envelope routes.
  - `[high]` `[patch]` Added real multi-session revocation integration coverage and canonical post-revocation routing evidence.
  - `[high]` `[patch]` Expanded local-Supabase E2E coverage for role denial, fail-closed consent, invited/deactivated routing, and the paused surface.
  - `[high]` `[patch]` Restricted browser Supabase access to Auth plus token-only TUS support.
  - `[medium]` `[patch]` Made centralized query auth routing resilient to sign-out failures, concurrent errors, nested codes, and trailing-slash loops; tested real query and mutation caches.
  - `[medium]` `[patch]` Separated OTP failures from post-verification account-state failures and stopped logging expected domain states as incidents.
  - `[medium]` `[patch]` Added a canonical safe `INTERNAL_ERROR` path and prevented arbitrary DomainError messages from reaching clients.
  - `[medium]` `[patch]` Added missing provisioning, confirmation, DAL, query-provider, and revocation verification surfaces.
  - `[low]` `[patch]` Safely denied malformed admin claims and covered pagination/route lookalike boundary cases.

### 2026-07-14 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 0, medium 4, low 3)
- defer: 2
- reject: 11: (high 0, medium 0, low 11)
- addressed_findings:
  - `[medium]` `[patch]` Fixed the centralized auth-routing latch in `query-client.ts`: `redirectInFlight` now releases when `handleGlobalAuthError` does not navigate (e.g. an auth error fired while already on the target page), so a single no-op error no longer permanently swallows later `SESSION_REVOKED`/`CONSENT_REQUIRED` events. Added a regression test.
  - `[medium]` `[patch]` Pinned the `requireUser` admin-exclusion invariant (admins cannot act through the ambassador context → `FORBIDDEN`) with a new `auth.test.ts` case; the behavior was correct but previously untested.
  - `[medium]` `[patch]` Pinned the fail-closed production consent provider (`hasCurrentConsent` → `false`) with a new fast-suite unit test so the ambassador consent gate cannot silently open without a red test.
  - `[medium]` `[patch]` Extended the RLS integration matrix with anon/ambassador/admin write-denial assertions (INSERT → `42501`) across all six baseline tables, pinning the "writes denied at baseline" least-privilege invariant that was previously read-only verified.
  - `[low]` `[patch]` Made `errorCode` in `query-client.ts` prefer a recognized auth code from either the top-level or nested envelope, so a non-auth outer string can no longer shadow a nested `SESSION_REVOKED`/`CONSENT_REQUIRED` and skip routing. Added a test.
  - `[low]` `[patch]` Hardened admin-provisioning pagination in `create-admin.ts` to terminate on an empty page rather than a short page, so a GoTrue `perPage` cap below 100 can no longer end the scan prematurely and miss an existing admin.
  - `[low]` `[patch]` Guarded `getProfileForAdmin` against malformed `profileId`: a non-UUID now returns a safe `NOT_FOUND` (404) instead of reaching Postgres as a `22P02` and surfacing as a spurious `INTERNAL_ERROR` 500 with an incident log. Added a test.

### 2026-07-14 — Review pass (follow-up 2)
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 1, low 3)
- defer: 0
- reject: 12: (high 0, medium 0, low 12)
- addressed_findings:
  - `[medium]` `[patch]` `src/lib/query-client.ts`: the QueryClient set only `staleTime`, so React Query's default retry (3) applied to auth-routing codes — a query returning `SESSION_REVOKED`/`CONSENT_REQUIRED` retried three times (delaying the sign-out/consent redirect and re-issuing doomed authenticated requests) before the global `onError` router ran. Added a `retry` predicate that never retries auth-routing codes while preserving the default three retries for other errors. Added a regression test.
  - `[low]` `[patch]` `src/lib/auth.test.ts`: the intent requires proving both the current and stale consent outcomes with the injected provider, but only the stale branch (`consent:false` → `CONSENT_REQUIRED`) was asserted at `requireUser`. Added the missing current-consent assertion (`consent:true` → resolved ambassador context with exact safe actor/profile fields).
  - `[low]` `[patch]` `src/features/ambassadors/dal/admin.test.ts`: `getProfileForAdmin` denial and malformed-id paths were tested but its success serialization (field projection, `toISOString` date conversion, no internal-column leak) never reached the DB read — asymmetric with the covered `getOwnProfile` mapping. Added a success-path test mocking the DB client.
  - `[low]` `[patch]` `src/db/schema/rls.integration.test.ts`: the RLS matrix seeded only `active` and `deactivated`, leaving the `invited` state (which the app guard `authenticated()` admits for onboarding but RLS's active-only policy must still deny) unverified. Added an `invited` seed and a defense-in-depth assertion that RLS leaks nothing to it.

## Design Notes

Story 3.1 continues to own `terms_versions` and the compliance-grade `acceptance_records`; Story 4.1 introduces asset ownership and private upload buckets; Stories 2.4, 2.5, and 3.3 own deactivate/delete/withdraw producers. Story 1.5 owns the structural enforcement points they plug into. The fail-closed consent provider makes the incomplete integration safe rather than pretending consent is current, and the current-schema RLS matrix avoids inventing ownership for tables that do not exist yet.

## Verification

**Commands:**
- `npm run typecheck` -- expected: all role/context and wire-type contracts compile.
- `npm run lint` -- expected: all DAL/import boundaries pass, with fixture violations rejected by boundary tests.
- `npm test` -- expected: auth matrices, errors, provisioning, revocation, query routing, and configuration tests pass.
- `npm run e2e` -- expected: local-Supabase role, consent, paused, and multi-device revocation journeys pass with axe checks where UI is involved.

## Auto Run Result

Status: done

Summary: Implemented the server-only authorization choke point, four auth contexts, role-scoped ambassador DALs, safe error translation, centralized client auth routing, idempotent all-device revocation foundation, admin provisioning, policy-complete baseline RLS, and state-aware authentication surfaces. Adversarial review findings were repaired and reverified.

Files changed:
- `src/lib/auth.ts`, `src/lib/auth/revocation.ts`, and tests — authoritative auth contexts, session classification, actor contracts, and global revocation with multi-session evidence.
- `src/lib/errors.ts`, `src/shared/error-codes.ts`, and tests — safe domain envelopes, canonical status mapping, and unexpected-only logging.
- `src/features/ambassadors/dal/` and tests — own-profile ambassador access, admin-only access, and role-specific wire types.
- `src/features/consent/dal/` — fail-closed consent provider and exact pre-consent operations.
- `src/lib/query-client.ts`, `src/app/query-provider.tsx`, `src/app/layout.tsx`, and tests — global query/mutation auth routing and provider wiring.
- `src/lib/supabase/{admin,browser}.ts` and tests — service-role client plus Auth/token-only browser facade.
- `src/app/auth/confirm/`, `src/app/auth/paused/`, `src/proxy.ts`, and tests — state-aware confirmation, public paused surface, and safe continuation routing.
- `src/app/api/ambassadors/` — representative role-scoped API envelopes.
- `scripts/create-admin.ts` and tests — paginated, metadata-preserving, profile-aware idempotent admin provisioning.
- `eslint.config.mjs` and `eslint-boundaries.test.ts` — enforced DB, privileged-context, browser, worker, and role boundaries.
- `supabase/migrations/20260714170000_story_1_5_rls.sql`, `supabase/migrations/20260714171000_story_1_5_rls_hardening.sql`, and `src/db/schema/rls.integration.test.ts` — least-privilege baseline RLS and required role/state matrix.
- `supabase/config.toml` and `supabase/auth-config.test.ts` — 600-second local JWT expiry contract.
- `e2e/auth-magic-link.spec.ts` and `playwright.config.ts` — local-Supabase auth, consent, role denial, paused, and account-state journeys with database environment wiring.
- `package.json` and `package-lock.json` — exact TanStack Query dependency and admin provisioning command.

Review findings: 12 patches applied (high 7, medium 4, low 1); 0 deferred; 1 low/noise finding rejected. Follow-up review recommendation: true; patch score is dominated by high-severity findings (weighted medium/low score 13, with seven high findings).

Verification performed:
- `npm run typecheck` — passed.
- `npm run lint` — passed without warnings after boundary remediation.
- `npm test` — passed: 34 files passed, 1 environment-gated legacy suite skipped; 175 tests passed and 5 legacy tests skipped. Required Story 1.5 RLS and revocation integration suites ran.
- `npm run e2e` — passed: 5 Chromium journeys, including axe-covered UI surfaces.
- `npx supabase migration up` — both Story 1.5 migrations applied locally.
- `git diff --check` — passed.

Residual risks:
- The installed Supabase JS admin sign-out endpoint accepts a user JWT rather than a UUID. Story 1.5 preserves the user-id revocation seam and proves global invalidation through an adapter; later mutation-owner stories must provide the production token-acquisition adapter.
- The repository verifies the 600-second local Supabase configuration; deployed-project configuration remains an operational deployment check.

### Follow-up review pass — 2026-07-14

Trigger: `status: done` spec re-reviewed for a fresh adversarial pass (blind adversarial, edge-case, verification-gap, and intent-alignment layers).

Outcome: 7 patches applied (0 high, 4 medium, 3 low), 2 findings deferred to the deferred-work ledger, 11 findings rejected as noise or by-design. No `intent_gap` and no `bad_spec` — no spec amendment or code re-derivation was required.

Patches applied this pass:
- `src/lib/query-client.ts` — released the `redirectInFlight` latch when no navigation occurs so a no-op auth error can no longer permanently swallow later `SESSION_REVOKED`/`CONSENT_REQUIRED` events; and made `errorCode` prefer a recognized auth code from either envelope level so a non-auth outer code cannot shadow a nested auth code.
- `src/lib/query-client.test.ts` — added latch-release and nested-auth-code regression tests.
- `scripts/create-admin.ts` — pagination now terminates on an empty page instead of a short page, robust to a GoTrue `perPage` cap below 100.
- `src/features/ambassadors/dal/admin.ts` + `admin.test.ts` — malformed `profileId` returns a safe `NOT_FOUND` (404) instead of a `22P02`-driven `INTERNAL_ERROR` 500 with an incident log.
- `src/lib/auth.test.ts` — pinned the `requireUser` admin-exclusion invariant (admin → `FORBIDDEN`).
- `src/features/consent/dal/consent-status.test.ts` (new) — pinned the fail-closed production consent provider in the fast suite.
- `src/db/schema/rls.integration.test.ts` — added anon/ambassador/admin write-denial assertions (INSERT → `42501`) across all six baseline tables.

Deferred (see deferred-work ledger): production `defaultGetAuth` `SESSION_REVOKED` detection surface unproven end-to-end (intent-deferred until the detection contract resolves); real service-role `admin.signOut(userId)` global-invalidation path unproven (adapter discards the userId — already a recorded residual risk).

Verification performed:
- `npm run typecheck` — passed.
- `npm run lint` — passed without warnings.
- `npm test` — passed: 35 files passed, 1 skipped; 182 tests passed, 5 skipped (up from 175). RLS and revocation integration suites ran against the running local Supabase stack.
- `npm run e2e` — passed: 5 Chromium journeys.

Follow-up review recommendation: true (formula-driven: 0 high, 4 medium, 3 low patched findings → 3×4 + 1×3 = 15 ≥ 5). Note this pass found no high-severity live defects — one medium live bug (the auth-routing latch) plus low-severity hardening and verification-gap test coverage.

Residual artifacts (not part of this change, left in place, not committed): `_bmad-output/implementation-artifacts/sprint-status.yaml` (orchestrator-owned, already modified at review start); `next-env.d.ts` (Next.js-generated, touched by running typecheck/build); `test-results/` (Playwright run output).

### Follow-up review pass 2 — 2026-07-14

Trigger: `status: done` spec re-reviewed for a fresh adversarial pass (blind adversarial, edge-case, verification-gap, and intent-alignment layers).

Outcome: 4 patches applied (0 high, 1 medium, 3 low), 0 new deferrals, 12 findings rejected as by-design/out-of-scope/noise. No `intent_gap` and no `bad_spec` — no spec amendment or code re-derivation was required. The two items already recorded in the deferred-work ledger from the prior pass (production `defaultGetAuth` `SESSION_REVOKED` detection unproven end-to-end; real `admin.signOut(userId)` global-invalidation path unproven) were re-confirmed still-open by this review but left untouched per the orchestrator's ownership of ledger status — no new ledger entries were created.

Patches applied this pass:
- `src/lib/query-client.ts` + `query-client.test.ts` — added a `retry` predicate so auth-routing codes (`SESSION_REVOKED`/`CONSENT_REQUIRED`) skip React Query's default three retries and reach the global auth router immediately; regression test added.
- `src/lib/auth.test.ts` — pinned the previously-unproven current-consent happy path (`requireUser` with the injected provider reporting current consent resolves the ambassador context), completing the intent's both-outcomes proof obligation.
- `src/features/ambassadors/dal/admin.test.ts` — pinned the `getProfileForAdmin` success serialization (projection, ISO date conversion, no internal-column leak).
- `src/db/schema/rls.integration.test.ts` — extended the RLS matrix with an `invited`-state actor and a defense-in-depth read-denial assertion.

Notable rejected/by-design findings (for the record): `DomainError` deliberately discards caller-supplied messages in favour of canonical safe messages; `requireUserPreConsent` intentionally admits admins (the confirm route resolves admin account state through it); client centralization is scoped to `SESSION_REVOKED`/`CONSENT_REQUIRED` only, so unhandled client `AUTH_REQUIRED` is out of scope; `revokeAllUserSessions` is intentionally an unwired primitive owned by Stories 2.4/2.5/3.3; the two sequential RLS migrations are intended (baseline then hardening).

Verification performed:
- `npm run typecheck` — passed.
- `npm run lint` — passed without warnings.
- `npm test` — passed: 35 files passed, 1 skipped; 186 tests passed, 5 skipped (up from 182). RLS and revocation integration suites ran against the running local Supabase stack.
- `npm run e2e` — passed: 5 Chromium journeys (a transient dev-server `ChunkLoadError` self-recovered on retry; all journeys green).

Follow-up review recommendation: true (formula-driven: 0 high, 1 medium, 3 low patched findings → 3×1 + 1×3 = 6 ≥ 5). This pass found one medium live behavioural defect (the auth-code retry storm) plus three low-severity verification-gap test additions; no high-severity live defects.

Residual artifacts (not part of this change, left in place, not committed): `_bmad-output/implementation-artifacts/sprint-status.yaml` (orchestrator-owned, already modified at review start); `next-env.d.ts` (Next.js-generated); `test-results/` (Playwright run output).
