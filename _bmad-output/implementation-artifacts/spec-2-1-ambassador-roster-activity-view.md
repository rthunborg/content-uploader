---
title: 'Story 2.1: Ambassador roster & activity view'
type: 'feature'
created: '2026-07-15T00:00:00+02:00'
status: done
review_loop_iteration: 3
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: []
baseline_revision: 2d27033db2cb52878cd3f00a2612458570e7a2df
---

<intent-contract>

## Intent

**Problem:** Admins lack the roster cockpit required to see every ambassador's contact details, account state, and recent activity, or to enter an individual ambassador's management/offboarding detail surface.

**Approach:** Add nullable authoritative `profiles.full_name`, then build an admin-only roster and detail route backed by an authenticated ambassadors DAL projection. The UI uses `full_name` without email inference and maps “last-login/activity” only to `last_login_at`, within the shared admin shell, Swedish Fleet Deck presentation, deterministic cursor pagination, and responsive semantic navigation.

## Boundaries & Constraints

**Always:** Enforce access with `requireAdmin()` in every DAL read; use `profiles.full_name` as the authoritative name and preserve null on the wire; map activity only from `profiles.last_login_at`; return list data as `{ items, nextCursor }`; render dates in `sv-SE`/Europe-Stockholm; keep all user-visible copy centralized in Swedish; make the roster keyboard-accessible and browseable on phones; retain the detail route as the future Epic 7 offboarding entry point.

**Block If:** The detail surface requires management actions beyond navigation and read-only identity/last-login information, or implementation would require inferring a missing name rather than rendering the approved fallback.

**Never:** Derive activity from expiring audit events; infer a person's full name from their email address; expose admin data through browser-side Supabase reads; add invite, contact-edit, lifecycle, deletion, or offboarding mutations from Stories 2.2–2.5 or Epic 7; use offset pagination or a bare-array list contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Populated roster | Authorized admin; ambassador profiles exist | Compact roster shows `fullName`, email, mobile, state, and `lastLoginAt`; rows link to detail | No error expected |
| Empty roster | Authorized admin; no profiles | Swedish explanatory empty state with a non-misleading next step | No error expected |
| Missing optional values | `fullName`, mobile, or `lastLoginAt` is null | Centralized Swedish “Namn saknas”, “Saknas”, or “Aldrig” fallback; wire value remains `null` | No error expected |
| Unauthorized access | Missing or non-admin session | No roster/detail data is returned or rendered | Canonical auth/forbidden behavior from `requireAdmin()` |
| Unknown detail id | Valid admin; profile does not exist | No profile data is rendered | Canonical `NOT_FOUND` response/page behavior |

</intent-contract>

## Code Map

- `src/db/schema/profiles.ts` -- Add nullable `fullName`; it is the authoritative display/export name and must not be inferred from email.
- `src/features/ambassadors/dal/admin.ts` -- Existing admin-authenticated detail projection; natural home for roster pagination and wire mapping.
- `src/features/ambassadors/dal/admin.test.ts` -- Existing DAL authorization and serialization patterns; every added DAL function requires coverage.
- `src/components/layout/admin-shell.tsx` -- Shared max-width/grid shell; does not yet provide the required top bar and left navigation.
- `src/app/api/ambassadors/[profileId]/route.ts` -- Existing detail API composition seam.
- `src/shared/datetime.ts` -- Europe/Stockholm formatter; relative Swedish activity formatting is not yet present.
- `src/lib/auth.ts` -- Canonical `requireAdmin()` security boundary.

## Tasks & Acceptance

**Execution:**
- `src/db/schema/profiles.ts`, `supabase/migrations/*`, and their schema/migration metadata tests: add nullable `profiles.full_name` through the repository's Drizzle migration workflow, preserving existing rows and leaving a subsequent migration generation empty.
- `src/features/ambassadors/dal/admin.ts` and `admin.test.ts`: extend the admin wire projection with nullable `fullName` and `lastLoginAt`; add deterministic UUID cursor pagination and read-only detail. Prove the authoritative ambassador-only population rule from the existing identity model and exclude admin identities from both reads. Enforce and independently test `requireAdmin()` before database access for each read. Strictly validate cursors and cover valid, malformed, under/exact/over-page, and subsequent-page behavior.
- Use one positive, non-throwing ambassador-membership predicate for list and detail: the profile must have a matching `auth.users` identity whose JSON `admin` value is not the boolean `true`. Orphan profiles must appear in neither surface, malformed/legacy metadata must not abort a query, and detail must apply the predicate atomically rather than through a second policy query. UUID-v4 validation accepts case-insensitive hexadecimal input while preserving the project-wide v4 invariant.
- `src/features/ambassadors/copy.ts` (plus shared-shell copy where appropriate): centralize every newly introduced visible/accessibility string and map every account state exhaustively to Swedish display copy. Treat null, empty, and whitespace-only optional display values as missing without mutating their wire values.
- `src/shared/datetime.ts` and tests: render `lastLoginAt` only, in `sv-SE`/Europe-Stockholm. If relative labels are used, derive day labels from Stockholm calendar boundaries (not fixed 24-hour intervals), define rounding thresholds, and cover local-midnight and DST boundaries; exact Stockholm date-time remains available to users.
- Exact Stockholm date-time must be perceivable without hover (including touch, keyboard, and screen-reader use). Relative-label copy must remain centralized rather than embedded as formatter literals.
- `src/components/layout/admin-shell.tsx`, `src/app/(admin)/admin/ambassadors/page.tsx`, and `[profileId]/page.tsx`: build the shared admin top bar/left navigation and an accessible mobile navigation replacement. Handle invalid/stale cursors as a safe canonical outer-page state. Map unknown detail ids to `notFound()` and allow auth failures to propagate without rendering data.
- `src/features/ambassadors/components/*`: provide a compact semantic desktop roster and a genuinely phone-browseable representation that does not require horizontal panning; preserve keyboard/touch targets, row links, Fleet Deck tokens, missing-value copy, and a read-only detail surface with no Epic 7 actions.
- Add route/page, DAL, component, and browser-level verification anchored at the outer surfaces named by the acceptance criteria: populated/empty/missing rosters, detail navigation and unknown id, unauthorized roster/detail behavior, next-cursor wiring, phone navigation/layout, keyboard/touch browsing, and axe. Every I/O matrix row must have a passing test.
- Database-backed pagination verification must cross a page boundary with more than the page size, proving ordered complete membership, no overlap, correct predicate direction, and admin/orphan exclusion. Route tests must assert canonical safe error envelopes/statuses for invalid roster cursors and malformed/unknown/admin detail ids. Browser coverage must exercise authenticated non-admin denial on both roster and detail pages/APIs, plus empty and all missing-value states. Keep the card layout through widths where the rail leaves insufficient room for five readable table columns, and verify an intermediate viewport.

**Acceptance Criteria:**
- Given existing ambassador profiles and an authenticated admin, when the admin opens `/admin/ambassadors`, then the outer UI surface shows every roster row's authoritative `fullName`, email, mobile, account state, and `lastLoginAt` value.
- Given an ambassador roster row, when the admin follows its link, then `/admin/ambassadors/[profileId]` shows the agreed read-only detail surface and remains the future offboarding entry point without exposing Epic 7 actions.
- Given desktop or phone check-in use, when the roster renders, then it uses the admin top-bar/left-rail conventions where applicable and remains keyboard- and touch-browseable with Fleet Deck accessibility constraints.
- Given a non-admin or unauthenticated request, when either roster or detail data is requested, then the outer page/API surface reveals no ambassador data and uses the canonical authorization behavior.

## Spec Change Log

### 2026-07-15 — Review repair 1

- Triggering findings: the first implementation admitted non-ambassador profile rows, exposed raw account-state tokens, used fixed-duration relative dates, substituted a horizontally scrolling table for phone browsing, removed admin navigation on phones, incompletely validated cursor/optional-value boundaries, bypassed centralized copy, and tested lower-level proxies instead of the page/browser authorization, navigation, responsive, and accessibility surfaces required by the intent.
- Amendment: made the ambassador population rule, exhaustive Swedish labels, migration workflow, calendar-safe formatting, strict cursor behavior, mobile roster/navigation, defensive missing-value rendering, and outer-surface verification actionable with concrete file targets.
- Known-bad state avoided: a compositionally plausible roster whose data set, mobile experience, localized output, pagination failure modes, and route-level security/accessibility behavior were not demonstrated against the amended contract.
- KEEP: preserve nullable authoritative `full_name`; never infer name from email; preserve `last_login_at` as the only activity source; keep `{ items, nextCursor }`, deterministic keyset pagination, `requireAdmin()` in every DAL read, read-only detail navigation, Swedish Fleet Deck presentation, and the working null fallbacks.

### 2026-07-15 — Review repair 2

- Triggering findings: roster and detail used inconsistent ambassador predicates for orphan identities; boolean metadata casts could throw; detail policy was non-atomic; exact activity time was hover-only; cursor SQL and canonical API errors were not behaviorally observed; and browser coverage still did not cross pagination or prove all authorization/empty/missing/intermediate-width surfaces.
- Amendment: defined one positive atomic membership predicate, safe JSON handling, case-insensitive UUID-v4 validation, non-hover exact time, centralized relative labels, database-backed page traversal, API error-contract tests, and complete browser-level matrix/viewport coverage.
- Known-bad state avoided: roster rows linking inevitably to 404, malformed auth metadata taking down the roster, cursor/order regressions passing mocked tests, and acceptance claims supported only by lower-layer proxies.
- KEEP: retain the generated Drizzle migration and clean metadata, localized account-state map, null-preserving wire projection, mobile cards/navigation, Stockholm calendar/DST handling, safe invalid-cursor page, read-only detail, and all passing authorization/accessibility tests from repair 1.

## Review Triage Log

### 2026-07-15 — Review pass
- intent_gap: 0
- bad_spec: 10: (high 6, medium 3, low 1)
- patch: 4: (high 0, medium 4, low 0)
- defer: 0
- reject: 1: (high 0, medium 1, low 0)
- addressed_findings:
  - `[high]` `[bad_spec]` Ambassador population was not constrained; amended DAL tasks to prove and enforce exclusion of admin identities.
  - `[medium]` `[bad_spec]` Raw account-state values and inline strings violated centralized Swedish copy; added exhaustive localized mapping and copy ownership.
  - `[high]` `[bad_spec]` Phone roster and admin navigation were not genuinely browseable; required non-panning mobile presentation and mobile navigation.
  - `[high]` `[bad_spec]` Verification exercised internal proxies rather than authorization, populated/detail, navigation, responsive, and accessibility outer surfaces; required page/browser coverage and matrix-row evidence.
  - `[medium]` `[bad_spec]` Cursor and migration workflows lacked actionable end-to-end constraints; specified strict pagination cases, safe outer handling, and Drizzle metadata consistency.
  - `[medium]` `[bad_spec]` Relative activity formatting ignored Stockholm calendar boundaries; specified calendar/DST/rounding behavior when relative labels are retained.

### 2026-07-15 — Review pass 2
- intent_gap: 0
- bad_spec: 8: (high 5, medium 2, low 1)
- patch: 4: (high 0, medium 4, low 0)
- defer: 0
- reject: 2: (high 0, medium 2, low 0)
- addressed_findings:
  - `[high]` `[bad_spec]` List/detail ambassador membership diverged for orphan identities and metadata casts could fail the whole surface; specified a shared positive, safe, atomic predicate.
  - `[high]` `[bad_spec]` Cursor direction/order and page-boundary membership were not observed; required database-backed traversal beyond the page size.
  - `[high]` `[bad_spec]` Canonical roster/detail API failures and authenticated non-admin outer-page denial lacked direct verification; made each route/page surface explicit.
  - `[high]` `[bad_spec]` Empty/missing-value matrix rows and intermediate responsive layout remained internal-proxy checks; required browser evidence.
  - `[medium]` `[bad_spec]` Exact activity time was hover-only and relative strings bypassed centralized copy; required perceivable exact text and centralized labels.

### 2026-07-15 — Review pass 3 closure
- intent_gap: 0
- The bounded patch set centralized account-state values, preserved `AdminShell` with/without-rail semantics without nested navigation landmarks, styled the invalid-cursor recovery target for keyboard/touch use, and defined truthful future activity-time copy.
- Direct verification now covers unauthenticated and non-admin page/API denial, malformed/unknown/admin/orphan detail identities, successful detail routing, invalid-cursor recovery, rendered relative/exact activity labels, real Postgres page-boundary traversal, responsive roster states, and roster/detail Axe scans.
- All accepted pass-three findings were applied and reverified; no further follow-up review is recommended.

## Design Notes

Resolved autonomously on 2026-07-15 under the run's recommended/default rule:

1. `profiles.full_name` is the authoritative display/export name. The migration keeps it nullable for pre-existing rows; new ambassador invitations must collect a nonblank value and Story 2.3 maintains it with email/mobile. Missing legacy values render as “Namn saknas”; email inference is forbidden.
2. FR32 and Story 2.1's “last-login/activity” shorthand maps only to the existing durable `profiles.last_login_at` KPI. No aggregate or `last_activity_at` is introduced; null renders as “Aldrig.”

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test` -- passed after implementation and review repairs.
- `npm run build` -- passed; admin App Router boundaries and server/client imports compile successfully.
- `npx playwright test ambassador-roster.spec.ts --reporter=line` -- passed against the local Supabase-backed app.

## Auto Run Result

Status: done

- Implemented the admin ambassador roster/detail surfaces, authoritative nullable full-name and last-login projection, ambassador-only keyset pagination, localized account-state/date copy, mobile navigation/cards, and generated Drizzle migration metadata.
- Completed three independent review passes with all accepted findings applied.
- Verified typecheck, lint, Vitest (including database-backed traversal), production build, migration consistency, and dedicated Playwright authorization/responsive/accessibility coverage.
