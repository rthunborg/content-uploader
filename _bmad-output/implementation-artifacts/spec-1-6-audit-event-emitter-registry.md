---
title: '1.6 Audit event emitter & registry'
type: 'feature'
created: '2026-07-14T00:00:00+02:00'
status: 'done'
baseline_revision: 0f0a44d5afeb02b8299f6ab59b77e8d44fb03e97
final_revision: 8639b75b5d41e72be1de52fa4a39863937f8cbbd
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** The project has no immutable audit store or transaction-bound emitter, so future mutating subsystems could ship without complete compliance evidence or could create audit records that survive a rolled-back mutation.

**Approach:** Add the expiring, insert-only `audit_events` schema and a runtime-neutral, closed event registry plus emitter whose type/API shape accepts an active Drizzle transaction but rejects the global database client. Prove atomic rollback, immutability, retention, and architectural enforcement before feature-owned mutation producers arrive.

## Boundaries & Constraints

**Always:** Audit types use the closed, past-tense dot-notation registry; each record includes `occurred_at`, event type, optional actor id plus actor-name snapshot, entity id plus JSON snapshot, with no FK to live entities. Audited mutations call the emitter within their own transaction. The table expires after six months and remains EU-hosted with RLS as defense in depth.

**Block If:** The transaction type cannot be distinguished structurally from the global client without coupling `src/shared` to app-only code, or local Postgres cannot prove the grant/trigger/rollback contract.

**Never:** Add producers for later feature stories; audit reversible star/theme assignment/theme unassignment/dismiss actions, delivery-status transitions, theme CRUD, or pending-upload orphan cleanup; add UPDATE/DELETE application paths, `updated_at`, live-row FKs, a viewer UI, durable usage/export storage, or let the retention job name any table other than `audit_events`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| User event | Registered event, user actor, entity snapshot, transaction | One row persists with supplied actor/entity snapshots and database timestamp | Invalid registry type fails TypeScript |
| System event | Registered event, null actor id, `system` snapshot | One row persists without an actor FK | No error expected |
| Mutation rollback | Mutation and emit occur, transaction later throws | Neither mutation nor audit row persists | Original transaction error propagates |
| Tampering | Authenticated/admin SQL attempts UPDATE or DELETE | Existing row remains unchanged | Database denies the operation |
| Expiry boundary | Rows older and newer than six months exist | Scheduled deletion removes only expired audit rows | Other tables remain untouched |

</intent-contract>

## Code Map

- `src/shared/audit-events.ts` -- new closed event taxonomy and event-name union.
- `src/shared/audit.ts` -- new runtime-neutral transaction-bound insertion contract.
- `src/db/schema/audit.ts` -- new expiring retention-class schema; deliberately separate from durable event tables.
- `src/db/schema/index.ts` -- schema barrel consumed by both app and worker.
- `src/db/client.ts` -- global app database type that must not satisfy the emitter transaction contract.
- `eslint.config.mjs`, `eslint-boundaries.test.ts` -- architectural guard preventing global-client audit calls and preserving shared/worker neutrality.
- `supabase/migrations/` -- SQL immutability, RLS/grants, and audit-only six-month pg_cron expiry.

## Tasks & Acceptance

**Execution:**
- `src/shared/audit-events.ts` and co-located tests -- define exactly `asset.uploaded`, `asset.deleted`, `asset.erased`, `export.created`, `asset.shared`, `asset.used_confirmed`, `auth.logged_in`, `account.invited`, `account.deactivated`, `account.reactivated`, `account.deleted`, `consent.accepted`, `consent.declined`, `consent.withdrawn`, `terms.version_created`, `task.created`, `task.completed`, and `message.sent`; prove the registry and union are closed.
- `src/shared/audit.ts` and co-located tests -- expose `audit.emit(tx, event)` with typed actor/entity snapshot input and a transaction-only capability; insert through the supplied handle without importing `src/db`, `server-only`, Next.js, or React.
- `src/db/schema/audit.ts`, `src/db/schema/index.ts`, and schema tests -- model UUID id, registered text event type, nullable UUID actor id, non-null actor-name snapshot, UUID entity id, non-null JSONB entity snapshot, and `occurredAt` only; add the registry CHECK and no live FKs.
- `supabase/migrations/` and `src/db/schema/audit.integration.test.ts` -- create table and CHECK, enable RLS, revoke ordinary UPDATE/DELETE, enforce immutability against privileged application roles, permit transaction-bound inserts only for intended server execution, and schedule an idempotent audit-table-only six-month expiry with local integration evidence.
- `eslint.config.mjs` and `eslint-boundaries.test.ts` -- reject importing/passing the global app DB client at the audit emitter call surface while allowing DAL/worker code to import the shared emitter and schema.
- `src/shared/audit.integration.test.ts` -- against local Supabase, prove commit, rollback atomicity, user/system snapshot persistence, invalid event rejection, and that the global-client anti-pattern is rejected at compile/lint time.

**Acceptance Criteria:**
- Given any caller, when it selects an audit event type, then TypeScript accepts only the exact closed registry including the two day-one v1.1 types and excluding deliberately unaudited verbs.
- Given an audited mutation, when the transaction commits or rolls back, then the mutation and audit row persist together or neither persists, and the emitter cannot be called with the global client.
- Given an existing audit row, when application roles attempt mutation, then UPDATE and DELETE are denied by database enforcement and no live entity FK can cascade or block lifecycle work.
- Given the retention schedule runs, when rows straddle the six-month boundary, then only expired `audit_events` rows are removed and no durable/content/acceptance table is targeted.

## Spec Change Log

## Review Triage Log

### 2026-07-14 — Review pass (follow-up 2)
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 1
- reject: 21: (high 0, medium 3, low 18)
- addressed_findings:
  - none
- deferred_summary: Appended one NEW deferred-work entry — the audit-compliance guarantee set (RLS/FORCE-RLS, the immutability trigger's own reject branch, transaction-atomic rollback, per-registry-type CHECK admission, six-month retention scoped to `audit_events`) is proven only by DB-gated integration suites that `describe.skip` without a local Supabase, with no CI to run them. This is a pre-existing project-wide convention (five integration suites across stories 1.2–1.6 share the same gating; CI/quality-pipeline hardening is deliberately the final build phase), surfaced incidentally, not a Story 1.6 defect.
- rejected_summary: Nearly all substantive findings were already surfaced and rejected on intent authority in the two prior passes, or are documented accepted residual risks: TRUNCATE unblocked by the row trigger (owner-only; application roles lack TRUNCATE); `current_user='postgres'` retention/immutability coupling (valid for the Supabase target the intent names — already a recorded residual risk); the `audit.retention_fixture` DDL bypass (postgres-owner-only, within the already-trusted owner boundary); redundant/asymmetric second migration (idempotent, already applied — removal worsens migration-history drift); RLS enabled with no policies (intent-mandated deny-by-default defense-in-depth); non-UUID id / non-JSON-safe / null snapshot inputs aborting the business transaction (fail-closed is the intended rollback semantics; JSON-safety is type-enforced; no producers exist yet per intent); the structural `rollback` discriminator being a compile-time proxy defeatable at runtime (the intent frames the guard as "type/API shape," R4 runtime rejection is not mandated); `AUDIT_EVENT_TYPES` duplicated in frozen migration SQL / CHECK-drift risk (inherent to all migrations; already mitigated by the per-registry-type integration test added last pass); pg_cron hard dependency (intent names Supabase, which ships pg_cron); unbounded jsonb growth and unbatched retention DELETE (out-of-scope operational-scale concerns); `sql.raw` CHECK-builder idiom (compile-time constants with `''` escaping); type-only proofs inert under `vitest run` (enforced by the separate `npm run typecheck` gate); the relaxed `expectRestricted` exact-count assertion and the redundant `@/db/client` custom-message eslint rule (intentional accommodation for imports matching multiple boundary rules); the `queryChunks` white-box unit assertion, `describe.sequential` shared-fixture ordering, verbatim-duplicated `localDatabaseUrl`, and recent-fixture row accumulation (low-value test-style nits; row accumulation already recorded as a residual risk). The overarching silent-skip/no-CI theme these test-style nits belong to was deferred once as a project-level entry rather than rejected piecemeal.

### 2026-07-14 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 4: (high 0, medium 2, low 2)
- defer: 0
- reject: 15: (high 0, medium 3, low 12)
- addressed_findings:
  - `[medium]` `[patch]` Added integration coverage proving the immutability *trigger itself* (not just role grants) rejects UPDATE/DELETE on the privileged owner connection — the prior role-based assertions failed at the GRANT layer before the trigger fired, leaving its reject branch unverified.
  - `[medium]` `[patch]` Added integration coverage inserting one row per registered event type so the compiled database CHECK constraint is pinned to `AUDIT_EVENT_TYPES`; the prior enum-vs-registry unit test compared TypeScript to TypeScript and could not catch a registry addition shipped without a matching migration (runtime `23514`).
  - `[low]` `[patch]` Ordered the two-event commit assertion by `event_type` instead of the transaction-tied `occurred_at`; both rows share the transaction-start `now()`, so `order by occurred_at` was a nondeterministic tie and a latent flake.
  - `[low]` `[patch]` Documented the `AuditTransaction.rollback` structural discriminator so a future "remove unused member" cleanup cannot silently collapse the transaction-only (global-client-rejected) guarantee.
- rejected_summary: TRUNCATE not blocked by the row trigger (owner-only; application roles already lack TRUNCATE); `current_user='postgres'` retention coupling (valid for the Supabase target the intent names, where the SECURITY DEFINER/cron owner is `postgres`); missing `entity_id`/`actor_id`/`event_type` query indexes (no query consumers in this story — intent forbids adding producers/consumers); emitter raw-SQL column names decoupled from the schema (a deliberate consequence of the required `src/shared` runtime-neutral boundary; integration tests exercise the real insert); type-level tests inert under `vitest run` (enforced by the `npm run typecheck` verification gate, which passed); cron cadence string unasserted (low value); NUL-byte / non-JSON-safe snapshot and non-UUID id inputs aborting the business transaction (fail-closed is the intended rollback semantics and no producers exist yet); RLS enabled with no policies (intent-mandated defense-in-depth deny-by-default for non-bypass roles); unbatched retention DELETE (out-of-scope scale concern); redundant second migration (idempotent, already applied — removal would cause worse migration-history drift); cron duplicate-jobname `SELECT INTO` (cannot arise given unschedule-before-schedule); relaxed eslint-boundary assertion (intentional accommodation for imports matching multiple rules); `occurred_at` records recording-time not event-time (intent specifies the database timestamp by design); test-only `audit.retention_fixture` bypass in DDL (postgres-owner-only, does not widen the already-trusted owner boundary).

### 2026-07-14 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 10: (high 1, medium 7, low 2)
- defer: 0
- reject: 14: (high 0, medium 2, low 12)
- addressed_findings:
  - `[medium]` `[patch]` Schema-qualified emitter writes to `public.audit_events`, preventing caller-controlled `search_path` from redirecting compliance records.
  - `[medium]` `[patch]` Declared RLS in the Drizzle schema and regenerated metadata so the schema model cannot drift from migration enforcement.
  - `[medium]` `[patch]` Added an actual-project-client compile-time rejection proof at the consumer boundary while retaining positive real-transaction coverage.
  - `[medium]` `[patch]` Replaced arbitrary snapshot values with recursive JSON-safe types, preventing normal call sites from supplying values JSON cannot faithfully persist.
  - `[low]` `[patch]` Added the `occurred_at` retention index for bounded expiry lookup cost.
  - `[low]` `[patch]` Made retention assertions deterministic against a persistent local database instead of relying on the total deleted-row count.
  - `[medium]` `[patch]` Reset the trusted retention bypass on both success and failure so it cannot leak into later statements in the surrounding transaction.
  - `[high]` `[patch]` Made `occurred_at` database-controlled for ordinary inserts so service callers cannot forge chronology or evade retention.
  - `[medium]` `[patch]` Added persisted `event_type` assertions so a valid but wrong registry value cannot pass emitter verification.
  - `[medium]` `[patch]` Proved authenticated and service roles cannot invoke the privileged retention function and cannot delete the protected fixture.

## Design Notes

Use a capability/brand carried only by Drizzle transaction handles (or an equivalent transaction-specific structural contract) so `src/shared` stays runtime-neutral and the compiler makes `audit.emit(db, …)` invalid. Database immutability must not prevent the narrowly scoped trusted expiry function from deleting expired rows; that function is the sole deletion path and names `audit_events` explicitly.

## Verification

**Commands:**
- `npm run typecheck` -- expected: registry closure and transaction-only call sites compile; global-client fixture fails as intended.
- `npm run lint` -- expected: shared neutrality and audit boundary fixtures pass.
- `npm test` -- expected: fast schema/registry/emitter tests and local audit integration tests pass.
- `npx supabase migration up` -- expected: audit migration and idempotent cron setup apply locally.
- `git diff --check` -- expected: no whitespace errors.

## Auto Run Result

### 2026-07-14 — Follow-up review pass 2

Status: done

Summary: Second follow-up review pass over the completed story diff (baseline `0f0a44d` → HEAD `8639b75`). Ran four parallel review layers (adversarial, edge-case, verification-gap, intent-alignment). The intent-alignment audit confirmed the diff faithfully implements the intent's dominant reading — a compile-time structural client-rejection API (`AuditTransaction`'s `rollback` discriminator) plus the `src/shared` → `@/db/client` lint boundary — with the runtime/DB compliance behavior implemented correctly and proven by local integration tests. No intent_gap or bad_spec loopback was warranted. Applied zero patches: cross-referencing every surfaced finding against the two prior passes showed nearly all were already rejected on intent authority or recorded as accepted residual risks. Deferred one project-level finding.

Files changed this pass (documentation only — no code changed):
- `_bmad-output/implementation-artifacts/spec-1-6-audit-event-emitter-registry.md` — triage log + this result; frontmatter `status`/`followup_review_recommended`/`final_revision`.
- `_bmad-output/implementation-artifacts/deferred-work.md` — one NEW deferred entry (audit-compliance guarantees proven only by DB-gated integration suites that skip without local Supabase, no CI).

Review findings: 0 patches applied; 1 deferred; 21 rejected (high 0, medium 3, low 18). Follow-up review recommendation: false — 0 patched findings this pass, weighted score `3×0 + 1×0 = 0 < 5`, no high-severity patch. The prior pass's convergent themes were re-examined and either re-confirmed as by-design/out-of-scope-per-intent or consolidated into the single deferred CI-gap entry.

Verification performed:
- No code changes were made this pass (0 patches, no bad_spec re-derivation), so the reviewed code is byte-identical to the already-verified `final_revision` `8639b75`; the prior pass's full green verification (`npm run typecheck`, `npm run lint`, `npm test` — 208 passed, `npx supabase migration up`, `git diff --check`) remains valid and was not re-run per the workflow's patch-gated verification rule.
- Confirmed via `git status`/`git diff` that the working tree carries no code (`src/`, `worker/`, `supabase/`, `eslint*`) changes from this pass — only the two documentation files above.

Residual risks (unchanged from prior passes, now with the CI-gap tracked in the ledger):
- The `expire_audit_events` SECURITY DEFINER retention path and the immutability trigger's DELETE carve-out are gated on `current_user = 'postgres'`; correct for the Supabase target the intent names, but would silently disable retention on an environment whose owner/cron role is named differently.
- Audit-compliance guarantees (RLS, immutability trigger, rollback atomicity, retention scoping) are exercised only when a local Supabase is present; with no CI they can regress green under a bare `npm test`. Now captured as a NEW deferred-work entry for the CI/quality-pipeline hardening phase.
- Integration tests leave recent immutable audit fixtures to age out through the same six-month retention lifecycle as production records.

### 2026-07-14 — Follow-up review pass

Status: done

Summary: Fresh review pass over the completed story diff (baseline `0f0a44d`). Ran four parallel review layers (adversarial, edge-case, verification-gap, intent-alignment). The intent-alignment audit confirmed the observable contract is faithfully implemented, so no intent_gap or bad_spec loopback was needed. Applied four in-scope patches — two verification-gap closures, one latent test-flake fix, and one maintainability comment — and rejected fifteen findings as out-of-scope-per-intent, already-enforced, operational-scale, or by-design.

Files changed:
- `src/db/schema/audit.integration.test.ts` — added trigger-level immutability coverage on the privileged owner connection and per-registry-type CHECK-constraint coverage; imported `AUDIT_EVENT_TYPES`.
- `src/shared/audit.integration.test.ts` — made the two-event commit assertion deterministic (`order by event_type`).
- `src/shared/audit.ts` — documented the load-bearing `rollback` structural discriminator.

Review findings: 4 patches applied (high 0, medium 2, low 2); 0 deferred; 15 rejected. Follow-up review recommendation: true — weighted patch score `3×2 + 1×2 = 8 ≥ 5` (no high-severity patch, but the two medium verification-gap closures add new database-gated tests worth a confirming pass).

Verification performed:
- `npm run typecheck` — passed.
- `npm run lint` — passed without diagnostics.
- `npm test` — passed: 41 files passed, 1 environment-gated legacy suite skipped; 208 tests passed (up from 206 — the two new integration tests executed against local Supabase and passed), 5 skipped.
- `npx supabase migration up` — passed; no pending migrations (this pass added no migrations).
- `git diff --check` — passed; only DrvFS CRLF line-ending warnings, no whitespace errors.

Residual risks:
- Retention immutability bypass and the `expire_audit_events` SECURITY DEFINER path are gated on `current_user = 'postgres'`; this holds for the Supabase deployment target (where the owner/cron role is `postgres`) but would silently disable retention on an environment whose owner role is named differently.
- Integration tests leave recent immutable audit fixtures (including the new per-registry-type rows) to age out through the same six-month retention lifecycle as production records.
- The `audit.retention_fixture` DDL bypass and TRUNCATE remain available to the postgres owner role; both are within the already-trusted owner boundary and unreachable by application roles.

### 2026-07-14 — Initial run

Status: done

Summary: Added the closed 18-type audit registry, runtime-neutral transaction-bound emitter, immutable snapshot-based audit schema, six-month trusted retention job, database chronology enforcement, RLS/grants, architectural guards, and local compliance integration coverage.

Files changed:
- `src/shared/audit-events.ts` and tests — exact closed event taxonomy and compile-time union.
- `src/shared/audit.ts` and tests — JSON-safe, schema-qualified transaction emitter plus atomic rollback and consumer-type proofs.
- `src/db/schema/audit.ts`, `src/db/audit-types.test.ts`, and schema tests — RLS-aware audit model, retention index, actual global-client rejection, and enforcement coverage.
- `src/db/schema/index.ts` — audit schema export.
- `eslint.config.mjs` and `eslint-boundaries.test.ts` — shared/global-client restrictions and approved DAL/worker imports.
- `supabase/migrations/20260714182557_tiresome_cobalt_man.sql` — initial immutable table, grants, RLS, expiry function, and cron schedule.
- `supabase/migrations/20260714185041_shallow_magdalene.sql` — forward-only chronology, retention-bypass, RLS metadata, and index hardening.
- `supabase/migrations/meta/` — generated Drizzle migration snapshots and journal.

Review findings: 10 patches applied (high 1, medium 7, low 2); 0 deferred; 14 rejected as noise, already-enforced behavior, operational assumptions, or out-of-scope scale concerns. Follow-up review recommendation: true because a high-severity chronology finding was patched; weighted medium/low score was 23.

Verification performed:
- `npm run typecheck` — passed.
- `npm run lint` — passed without diagnostics.
- `npm test` — passed: 41 files passed, 1 environment-gated legacy suite skipped; 206 tests passed, 5 skipped.
- `npx supabase migration up` — passed with no pending local migrations.
- `git diff --check` — passed; repository-wide DrvFS line-ending warnings contained no whitespace errors.

Residual risks:
- Integration tests intentionally leave recent immutable audit fixtures to expire through the same six-month lifecycle as production records.
- Production scheduling assumes the Supabase project retains its supported `pg_cron` configuration; local Supabase applied and exercised the function successfully.
