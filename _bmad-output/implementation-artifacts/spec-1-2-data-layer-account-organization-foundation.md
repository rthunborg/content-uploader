---
title: 'Story 1.2: Data-layer, account & organization foundation'
type: 'feature'
created: '2026-07-14'
status: 'done'
baseline_revision: '0239fed45f61033c31a861b86d22592adb6b2a93'
final_revision: 'f3908b9d1ba82b46ce86fbff46e974f7250488aa'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '/mnt/c/stena-content-portal/_bmad-output/project-context.md'
warnings: [oversized]
---

<intent-contract>

## Intent

**Problem:** The scaffold has no governed database workflow, account state model, organization schema, or runtime-neutral contracts, so later auth, upload, curation, and campaign work lacks a reproducible foundation.

**Approach:** Add pinned Drizzle runtime/configuration and a generated Supabase migration for profiles, a minimal asset identity seam, themes, and dormant campaigns; establish the app connection and shared primitives; enforce architectural import boundaries and verify the schema against a local Supabase database.

## Boundaries & Constraints

**Always:** Use text plus database CHECK constraints for controlled values; use UUID primary keys and timestamptz lifecycle columns; keep `profiles` free of role/admin/deleted fields; keep both asset joins composite-unique, reverse-indexed, and explicit-insert-only; keep `campaigns.theme_id` nullable with `ON DELETE SET NULL`; use `DATABASE_URL` with `prepare: false` in the app and `DIRECT_URL` for migration generation; keep `src/shared` runtime-neutral.

**Block If:** A reproducible local Supabase migration test cannot run after exhausting safe setup/diagnostic alternatives, or the existing schema baseline conflicts with the required identifiers in a way that cannot be resolved without changing a previously shipped contract.

**Never:** Use `pgEnum`, `drizzle-kit push` against production, add admin/role state to profiles, add `deleted` account state, infer theme/campaign joins from task or upload context, add `campaign_id` outside `asset_campaigns`, or create campaign DAL readers, routes, UI, and lifecycle behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Account insert | Profile with any allowed account state | Row persists with contact/KPI timestamps nullable | An unknown or `deleted` state is rejected by the database CHECK |
| Theme/campaign assignment | Same asset-axis pair inserted twice | First join persists | Duplicate pair is rejected by composite uniqueness |
| Campaign draft | Campaign inserted without selected theme | Row persists with `theme_id = NULL` | No theme is required at insert |
| Theme removal | Campaign references a deleted theme | Campaign remains and `theme_id` becomes `NULL` | Foreign-key action prevents dangling references |
| Workflow-linked asset | Asset identity includes later workflow provenance | No theme or campaign join appears automatically | Joins exist only after explicit insertion |

</intent-contract>

## Code Map

- `package.json`, `package-lock.json`, `drizzle.config.ts` -- exact Drizzle runtime/tool versions and Supabase-prefix migration workflow.
- `src/db/client.ts` -- server-only Vercel transaction-pool client with prepared statements disabled.
- `src/db/schema/{profiles,assets,themes,campaigns}.ts` -- account and organization schema plus the minimal asset identity required by join-table foreign keys.
- `src/db/schema/index.ts` -- canonical schema exports.
- `supabase/migrations/*.sql` -- generated, reviewable source of truth applied by the Supabase CLI.
- `src/shared/{limits,error-codes,datetime}.ts` -- runtime-neutral limits, canonical error/status mapping, and Stockholm formatting.
- `eslint.config.mjs` -- enforce shared, DAL, feature, route, ambassador/admin, and worker import boundaries.

## Tasks & Acceptance

**Execution:**
- `package.json`, `package-lock.json`, `drizzle.config.ts` -- add exact `drizzle-orm@0.45.2` and existing exact `drizzle-kit@0.31.10`, generate to `supabase/migrations` with `prefix: 'supabase'`, use `DIRECT_URL`, and keep `db:push` as Supabase CLI migration application rather than Drizzle push.
- `src/db/client.ts`, `src/db/client.test.ts` -- construct the server-only app Drizzle client from `DATABASE_URL` using postgres.js with `prepare: false` and `casing: 'snake_case'`; test configuration without opening a network connection.
- `src/db/schema/profiles.ts`, `src/db/schema/profiles.test.ts` -- define auth-linked profiles, constrained account state, email/mobile, lifecycle timestamps, and durable KPI timestamps; prove no role/admin/deleted schema surface.
- `src/db/schema/assets.ts`, `src/db/schema/themes.ts`, `src/db/schema/campaigns.ts`, `src/db/schema/organization.integration.test.ts` -- add the minimal assets identity table required for FK integrity, live theme and dormant campaign tables, composite join uniqueness, reverse indexes, nullable theme behavior, and explicit-join-only integration coverage.
- `src/db/schema/index.ts`, `supabase/migrations/*.sql` -- export the schema, generate the initial migration, and include required CHECK/FK/index/RLS backstop SQL with authenticated users denied direct table access unless a later policy explicitly grants it.
- `src/shared/limits.ts`, `src/shared/error-codes.ts`, `src/shared/datetime.ts` and co-located tests -- implement the canonical upload limits/error status mapping and Europe/Stockholm `sv-SE` date/time helpers with no framework imports.
- `eslint.config.mjs`, `eslint-boundaries.test.ts` -- enforce the project-context import laws for shared modules, feature DALs, app routes, ambassador code, and worker code using path-aware ESLint rules; prove representative forbidden imports fail lint while permitted runtime-neutral imports pass.

**Acceptance Criteria:**
- Given a clean checkout with database environment variables, when dependencies install, migration generation runs, and Supabase migrations apply locally, then one reproducible migration source creates the account and organization foundation with exact pinned Drizzle versions and no production Drizzle-push path.
- Given the migrated database, when allowed and forbidden profile states are inserted, then the five named states persist, unknown/`deleted` values fail, KPI/contact fields exist, and no profile role/admin column exists.
- Given assets, themes, and campaigns in the migrated database, when joins and nullable campaigns are exercised, then duplicate pairs fail, reverse indexes and foreign keys exist, a campaign accepts no theme, deleting its theme nulls the reference, and workflow provenance never creates organization joins.
- Given lint and unit tests run, when architectural boundary fixtures and `src/shared` modules are evaluated, then forbidden imports fail, allowed imports pass, shared primitives remain runtime-neutral, and Stockholm formatting/error mappings are deterministic.

## Spec Change Log

## Review Triage Log

### 2026-07-14 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 14: (high 4, medium 6, low 4)
- defer: 0
- reject: 15: (high 0, medium 7, low 8)
- addressed_findings:
  - `[high]` `[patch]` Closed alias, relative-path, and nested-admin import bypasses across worker, route, ambassador, and shared boundaries while preserving legitimate same-feature DAL composition.
  - `[medium]` `[patch]` Made boundary tests identify the intended prohibited import and cover same-feature allowance plus representative relative and nested bypasses.
  - `[high]` `[patch]` Replaced the database-client smoke assertion with mocks proving the URL, `prepare: false`, schema, and snake-case configuration reach postgres.js and Drizzle.
  - `[low]` `[patch]` Rejected blank and whitespace-only database URLs at client construction.
  - `[high]` `[patch]` Added live-database rejection coverage for an arbitrary unknown account state as well as the forbidden `deleted` value.
  - `[medium]` `[patch]` Derived the account-state CHECK expression from the canonical `ACCOUNT_STATES` list to prevent type/database drift.
  - `[low]` `[patch]` Made live profile tests clean up their auth/profile fixtures so repeated runs remain isolated.
  - `[medium]` `[patch]` Replaced the brittle public-schema foreign-key count with exact required constraint names and delete-action assertions.
  - `[medium]` `[patch]` Added behavioral coverage for the campaign date-order constraint introduced by this migration.
  - `[low]` `[patch]` Added a tracked empty local seed so clean Supabase resets no longer depend on missing-file tolerance.
  - `[low]` `[patch]` Normalized repository metadata for new source/configuration artifacts; Git records them as non-executable despite `/mnt/c` mount-mode reporting.
  - `[high]` `[patch]` Added explicit shared-layer restrictions against app, database, feature, library, and worker dependencies to preserve runtime neutrality.

## Design Notes

The organization joins require real foreign keys before the full upload schema arrives. `assets.ts` therefore owns only the stable asset identity and timestamps needed by this story; later upload/media stories extend it. Integration tests should run against local Supabase when available, while schema-shape tests remain fast and deterministic. RLS is deny-by-default here: enable it on exposed tables but do not invent ambassador/admin policies before the DAL/auth stories define them.

## Verification

**Commands:**
- `npm ci && npm run db:generate && npm run typecheck && npm run lint && npm test && npm run build` -- expected: dependency lock, generated migration, static gates, all tests, and production build pass.
- `npx supabase start && npx supabase db reset && npm test -- organization.integration.test.ts` -- expected: migration applies and every database edge case passes against local Postgres; stop the local stack afterward.
- `git diff --check && rg -n "pgEnum|campaignId" src/db/schema` -- expected: clean diff, no PostgreSQL enums, and no campaign FK outside the campaign join/schema-owned selected-theme relationship.

## Auto Run Result

Status: done

Summary: Implemented the reproducible Drizzle/Supabase data foundation for account state, minimal asset identity, live themes, dormant campaigns, runtime-neutral shared primitives, and enforced import boundaries. Hardened the result through four adversarial review layers and a live local-database matrix audit.

Files changed:
- `package.json`, `package-lock.json`, `drizzle.config.ts` — pin the Drizzle/postgres runtime and define timestamp-prefixed Supabase migration generation/application.
- `src/db/client.ts` and tests — provide the server-only transaction-pool client with observed `prepare: false` and snake-case configuration.
- `src/db/schema/**` and tests — define profiles, minimal assets, themes/joins, dormant campaigns/joins, and executable schema/constraint coverage.
- `supabase/**` — provide reproducible local configuration, tracked seed, generated migration/snapshot, RLS, grants, comments, and auth-user FK backstop.
- `src/shared/{limits,error-codes,datetime}*` — provide tested runtime-neutral limits, canonical status mapping, and Stockholm/Swedish formatting.
- `eslint.config.mjs`, `eslint-boundaries.test.ts` — enforce and test shared, worker, cross-feature DAL, route/database, and ambassador/admin boundaries.

Review findings breakdown: patch 14 (high 4, medium 6, low 4); defer 0; reject 15 (high 0, medium 7, low 8). Follow-up review recommendation: true because patched high findings exist; medium/low score is `3 × 6 + 4 = 22`.

Verification performed:
- Clean dependency installation and `npm run db:generate` passed; generation reported no drift after the committed migration.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` passed after review fixes; final unit run: 94 passed, 5 live-database tests skipped without `TEST_DATABASE_URL`.
- Local `supabase start`/`db reset` applied the migration, seeded cleanly, and the live organization integration suite passed 5/5 twice; the stack was stopped afterward.
- Matrix audit passed: five allowed account states plus unknown/deleted rejection, duplicate join rejection, nullable campaign theme, theme-delete set-null, and explicit-only organization joins all ran against migrated Postgres.
- `git diff --check` passed apart from WSL LF-to-CRLF notices; no `pgEnum` exists and `campaignId` appears only in the campaign-owned join schema.

Residual risks: The `auth.users` profile FK, RLS enablement, comments, and privilege revocations are deliberate SQL additions after Drizzle generation because Drizzle owns only the public schema snapshot; migration application verifies this backstop. Live database tests require the explicit local Supabase verification command and are intentionally skipped by the pure default unit command. The `/mnt/c` mount reports broad filesystem modes, while Git records the reviewed files as non-executable.
