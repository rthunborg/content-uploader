---
title: 'Story 2.1: Ambassador roster & activity view'
type: 'feature'
created: '2026-07-15T00:00:00+02:00'
status: ready-for-dev
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
warnings: []
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
- Add nullable `profiles.full_name` through the Drizzle schema and a forward migration; update schema/migration tests without making existing rows invalid.
- Extend the admin ambassador wire projection with `fullName` and `lastLoginAt`, and add a deterministic cursor-paginated roster query plus read-only detail query. Preserve nullable values at the DAL boundary and enforce `requireAdmin()` on every read.
- Build `/admin/ambassadors` and `/admin/ambassadors/[profileId]` with the shared admin top bar/left rail, compact semantic table/list presentation, responsive phone browsing, row links, centralized Swedish copy, and `sv-SE`/Europe-Stockholm date formatting.
- Render null `fullName` as “Namn saknas,” null mobile as “Saknas,” and null `lastLoginAt` as “Aldrig.” Never infer a name or aggregate activity from other timestamps.
- Add DAL, authorization, pagination, serialization, component/page, empty/missing-value, responsive-semantic, and accessibility coverage proportionate to the implemented surfaces.

**Acceptance Criteria:**
- Given existing ambassador profiles and an authenticated admin, when the admin opens `/admin/ambassadors`, then the outer UI surface shows every roster row's authoritative `fullName`, email, mobile, account state, and `lastLoginAt` value.
- Given an ambassador roster row, when the admin follows its link, then `/admin/ambassadors/[profileId]` shows the agreed read-only detail surface and remains the future offboarding entry point without exposing Epic 7 actions.
- Given desktop or phone check-in use, when the roster renders, then it uses the admin top-bar/left-rail conventions where applicable and remains keyboard- and touch-browseable with Fleet Deck accessibility constraints.
- Given a non-admin or unauthenticated request, when either roster or detail data is requested, then the outer page/API surface reveals no ambassador data and uses the canonical authorization behavior.

## Spec Change Log

## Review Triage Log

## Design Notes

Resolved autonomously on 2026-07-15 under the run's recommended/default rule:

1. `profiles.full_name` is the authoritative display/export name. The migration keeps it nullable for pre-existing rows; new ambassador invitations must collect a nonblank value and Story 2.3 maintains it with email/mobile. Missing legacy values render as “Namn saknas”; email inference is forbidden.
2. FR32 and Story 2.1's “last-login/activity” shorthand maps only to the existing durable `profiles.last_login_at` KPI. No aggregate or `last_activity_at` is introduced; null renders as “Aldrig.”

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test` -- expected after implementation: all mandatory local gates pass.
- `npm run build` -- expected after implementation: admin App Router boundaries and server/client imports compile successfully.

