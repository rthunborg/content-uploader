---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-07-08'
workflowType: 'testarch-test-design'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad/tea/config.yaml'
---

# Test Design for QA: Stena Content Portal (MVP)

**Purpose:** Test execution recipe for the QA role (solo dev wearing the QA hat). Defines what to test, how to test it, and what is needed from the production-code side first.

**Date:** 2026-07-08
**Author:** Rasmus (via TEA Master Test Architect)
**Status:** Draft
**Project:** stena-content-portal

**Related:** See Architecture doc (test-design-architecture.md) for testability concerns, risk mitigation plans, and blockers B-1..B-3.

---

## Executive Summary

**Scope:** MVP (FR1–36) across three test levels — Vitest unit (shared kernel, pure logic), Vitest integration against local Supabase (the DAL choke point, upload protocol, worker jobs, webhooks — the primary level for this system), Playwright E2E (the five PRD journeys, interruption harness, axe checks).

**Risk Summary:**

- Total Risks: 18 (7 high-priority score ≥6, 10 medium, 1 low)
- Critical Categories: DATA (upload integrity, erasure, GC), SEC (consent gate, role separation), TECH (transcoding), OPS (deliverability)

**Coverage Summary:**

- P0 tests: ~40 (upload integrity, consent/revocation, role separation, erasure, audit/acceptance records)
- P1 tests: ~50 (tasks/messaging, library/curation, export, transcode corpus, journeys J2/J4)
- P2 tests: ~30 (perf checks, a11y extras, config/residency smoke, edge cases)
- P3 tests: ~5 (exploratory, benchmarks)
- **Total:** ~110–140 tests (~3–4 weeks equivalent effort, spread across build phases)

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **v1.1 features (FR37–48)** | Not built in MVP | Epic-level test design at v1.1 planning; MVP seams (origin enum, durable events) asserted only where MVP behavior depends on them |
| **NFR16 backup/restore** | Not automatable in CI | Manual tested-restore exercise is a named launch gate with runbook |
| **iOS Safari real-device upload behavior** | Simulators/CI can't reproduce backgrounding + HEIC capture faithfully | Manual device checklist against actual ambassador devices; launch gate |
| **Email deliverability (SPF/DKIM/DMARC, spam placement)** | External mail-environment dependency | Launch checklist item; bounce-path automation covers in-app visibility |
| **NFR15 availability / NFR17 storage cost** | No SLA; billing review | Documented; no tests |
| **Load/stress beyond seeded-library perf checks** | 20-user internal tool — load testing is over-engineering | Nightly perf checks on 5k-asset seed suffice |

---

## Dependencies & Test Blockers

**CRITICAL:** test development cannot proceed without these.

### Backend/Architecture Dependencies (Pre-Implementation)

**Source:** Architecture doc Quick Guide (B-1..B-3) for detail.

1. **B-1 Test-auth strategy** — Dev — auth spine phase
   - `auth.admin.generateLink()`/seeded-session fixture, Mailpit wiring, account-state seed script
   - Every E2E and most integration tests need a session without email scraping
2. **B-2 Worker-in-CI topology** — Dev — transcode phase
   - Worker container composed against local Supabase for transcode suite; rendition seeding elsewhere
   - Blocks all `processing → ready` and job-level specs
3. **B-3 Provider fault-injection seams** — Dev — messaging phase
   - Adapter fake transports, signed webhook simulators, budget-state setter
   - Blocks FR36/NFR14/NFR20 coverage
4. **Directly invokable job handlers** — Dev — maintenance phase
   - Cron/maintenance jobs callable as functions with backdated seed data (no schedule-waiting)

### QA Infrastructure Setup (Pre-Implementation)

1. **Test Data Factories** — Drizzle-based, faker-randomized, parallel-safe:
   - `profiles` in each of the 5 account states; terms versions + HMAC-chained acceptance records; assets in each `processing_status` with renditions; tags/stars/`triaged_at` states; tasks + per-recipient rows; send_records at each lattice state
   - Auto-cleanup fixtures tracking created ids
2. **Test Environments**
   - Local: `supabase start` + `npm run dev` + optional worker container; Mailpit for magic-link specs
   - CI: GitHub Actions with local Supabase service, Playwright shards, worker container on the nightly tier
3. **Fixture media corpus:** tiled iPhone HEIC, short HEVC clip, faststart-checkable mp4, png, pdf, >50 MB image and >2 GB-declared video samples (oversize via declared-size stubs where possible)

**Example factory + API pattern** (playwright-utils is enabled in TEA config):

```typescript
import { test } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

test('upload commit flips pending asset to processing @P1 @API', async ({ apiRequest }) => {
  const filename = `test-${faker.string.uuid()}.jpg`;

  const { status: initStatus, body: init } = await apiRequest({
    method: 'POST',
    path: '/api/uploads/init',
    body: { filename, mime: 'image/jpeg', declaredSize: 1024 },
  });
  expect(initStatus).toBe(200);
  expect(init.assetId).toBeTruthy();

  // (test helper puts a matching object into the originals bucket here)

  const { status, body } = await apiRequest({
    method: 'POST',
    path: `/api/uploads/${init.assetId}/commit`,
  });
  expect(status).toBe(200);
  expect(body.processingStatus).toBe('processing');
});
```

---

## Risk Assessment

**Note:** Full details and mitigation plans in the Architecture doc. IDs are shared across both documents.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Score | QA Test Coverage |
| --- | --- | --- | --- | --- |
| **R-001** | TECH/DATA | Upload integrity under interruption/iOS constraints | **9** | P0-001…P0-008: interruption harness, commit atomicity, batch independence, token rollover |
| **R-002** | SEC | Consent/revocation gate bypass | **6** | P0-009…P0-016: auth-context × account-state matrix, revocation propagation, re-accept continuation |
| **R-003** | SEC | Triage-signal leak to ambassadors | **6** | P0-017…P0-022: negative authorization, wire-type assertions, media-URL scoping |
| **R-004** | DATA | Incomplete Art. 17 erasure | **6** | P0-023…P0-028: residual sweep, attribution purge, tombstone/crypto-shred, J4 journey |
| **R-005** | TECH | Transcoding fails on real media | **6** | P1-020…P1-026: fixture-corpus jobs, all-or-nothing, retry |
| **R-006** | OPS | Auth email undeliverable/invisible | **6** | P0-033/P1-032…P1-034: send-email hook record, bounce visibility, Mailpit magic-link E2E |
| **R-012** | DATA | Orphan-GC deletes live data | **6** | P0-029…P0-031: GC boundaries, committed-never-swept, diff-sweep |

### Medium/Low-Priority Risks

| Risk ID | Category | Description | Score | QA Test Coverage |
| --- | --- | --- | --- | --- |
| R-007 | DATA | HMAC chain false positives/negatives | 4 | P0-036…P0-038 (chain cases sit in the P0 compliance suite) |
| R-008 | TECH | Webhook lattice/duplicate bugs | 4 | P1-035…P1-038 |
| R-009 | BUS | Budget-cap error handling | 4 | P1-039…P1-041 |
| R-010 | PERF | Library degradation at scale | 4 | P2-001…P2-003 (nightly perf) |
| R-014 | SEC | Magic-link reuse/expiry | 4 | P0-034…P0-035 |
| R-015 | PERF | Transcode SLA miss | 4 | P2-004 (weekly 2 GB run) |
| R-016 | BUS | Export naming defects | 4 | P1-042…P1-045 (unit) |
| R-018 | BUS | Send-suppression failure | 4 | P0-032 |
| R-011 | DATA | Audit expiry deletes wrong rows | 3 | P0-039 |
| R-017 | SEC | Unverified webhook payloads | 3 | P1-036 |
| R-013 | OPS | Multi-admin LWW surprises | 2 | P2-010 |

---

## Entry Criteria

- [ ] Blockers B-1..B-3 + invokable job handlers resolved (see Dependencies)
- [ ] Factories and fixture corpus in place
- [ ] Local Supabase stack + CI service container working
- [ ] Feature under test merged to a deployable branch (tests land in the same phase as the subsystem they cover)

## Exit Criteria

- [ ] All P0 tests passing (100%)
- [ ] P1 pass rate ≥ 95%, failures triaged same-day
- [ ] No open high-severity bugs in high-risk areas (R-001..R-012 scope)
- [ ] Score-9 risk (R-001) coverage complete — release **BLOCK** condition
- [ ] Coverage ≥ 80% on `src/shared`, `features/*/dal`, `worker/jobs`
- [ ] Manual launch gates tracked separately (restore exercise, iOS device run, deliverability)

---

## Test Coverage Plan

**IMPORTANT:** P0/P1/P2/P3 = **priority and risk level** (what to focus on if time-constrained), NOT execution timing. See "Execution Strategy" for when tests run.

Test levels: UNIT (Vitest, pure logic) · INT (Vitest vs local Supabase; includes worker jobs) · E2E (Playwright). Duplicate-coverage guard: behavior asserted at one level only; E2E journeys assert wiring, not logic.

### P0 (Critical)

**Criteria:** Blocks core functionality + High risk (≥6) + No workaround + Compliance-critical

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **P0-001** | Chunk abort mid-upload → resume completes without data loss (FR12, NFR4) | E2E | R-001 | Playwright route-abort on TUS PATCH |
| **P0-002** | Interrupted/uncommitted upload never library-visible (NFR13) | INT | R-001 | Pending rows invisible to library queries |
| **P0-003** | Commit verifies object existence/size/type; mismatch → staged object deleted + typed error | INT | R-001 | `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` |
| **P0-004** | Commit is one transaction: status flip + transcode enqueue atomic; idempotent re-commit → 200 no-op | INT | R-001 | Rollback → no ghost audit event |
| **P0-005** | Missing/incomplete object at commit → `UPLOAD_INCOMPLETE` 409, row stays `pending` | INT | R-001 | Retry-or-GC path |
| **P0-006** | Batch per-file independence: one failing file doesn't affect siblings (FR9) | E2E | R-001 | Mixed valid/oversize batch |
| **P0-007** | Session-token rollover during long upload: 401 on chunk → refresh-and-retry, upload completes | E2E | R-001 | ADR decision 7 |
| **P0-008** | Client-side cap validation blocks transfer before start with per-type friendly error (FR11) | E2E | R-001 | Copy asserts code/structure, not exact strings |
| **P0-009** | Every DAL auth context × every account state: correct allow/deny matrix (FR4) | INT | R-002 | 4 contexts × 5 states |
| **P0-010** | Deactivate/withdraw/delete → global signOut → next DAL call 401/403 | INT | R-002 | Revocation propagation |
| **P0-011** | Consent-stale session → 409 `CONSENT_REQUIRED` with `next` continuation; accept → original destination | INT + E2E | R-002 | Re-accept flow (FR8) |
| **P0-012** | Decline terms → inactive, nothing deleted, self-service re-entry works (FR7) | INT | R-002 | J2 fragment |
| **P0-013** | Accept-all activates account + acceptance record (user, version, timestamp) written (FR5, FR6) | INT | R-002 | HMAC fields populated |
| **P0-014** | `requireAdmin` skips consent gate; admin provisioning via script works | INT | R-002 | ADR amendment 6 |
| **P0-015** | Deactivated user login → paused screen; every DAL call → `ACCOUNT_INACTIVE` 403 | INT | R-002 | No pre-auth state oracle |
| **P0-016** | Revoked/withdrawn user cannot commit an upload (authoritative checkpoint) | INT | R-002 | TUS residual accepted per ADR |
| **P0-017** | Ambassador session × every admin endpoint → 403 (NFR8) | INT | R-003 | Exhaustive route walk |
| **P0-018** | Ambassador asset payloads never contain `starred`/`dismissed`/triage fields | INT | R-003 | Serializer snapshot |
| **P0-019** | Ambassador sees/deletes only own uploads (FR14) | INT | R-003 | Cross-user denial |
| **P0-020** | Media file route: ambassador denied others' assets; admin allowed; 302 + 60 s signed URL | INT | R-003 | Kind=thumb/preview/original |
| **P0-021** | RLS backstop: direct table access with ambassador JWT rejected on triage-bearing tables | INT | R-003 | Defense-in-depth spot checks |
| **P0-022** | Storage RLS: originals-bucket write requires matching pending asset + uploader (ADR decision 9) | INT | R-003 | Client write policy pinned |
| **P0-023** | `deleteAssets(mode:'delete')`: rows + originals + renditions gone; usage/export events preserved (FR29) | INT | R-004 | Snapshot refs retained |
| **P0-024** | `mode:'erasure'`: replica swept, zips force-expired, attributions purged, send-record PII nulled | INT | R-004 | Full residual sweep, zero leftovers |
| **P0-025** | Erasure: acceptance-record crypto-shred + signed tombstone; chain still verifies; `erasure_records` row written | INT | R-004 | Durable evidence |
| **P0-026** | Filter-by-ambassador + bulk delete (offboarding, FR33); ≤50 inline / >50 queued fan-out | INT | R-004 | ADR decision 15 |
| **P0-027** | Dismiss (markTriaged) shares no code path with delete; Z-undo clears `triaged_at` | INT | R-004 | No-soft-delete law |
| **P0-028** | Journey J4: offboarding erasure end-to-end (deactivate → filter → bulk erase → audit evidence) | E2E | R-004 | + axe check |
| **P0-029** | Orphan GC: `pending` <24 h untouched; >24 h prefix + row swept, no audit event | INT | R-012 | Backdated seed rows |
| **P0-030** | Orphan GC never touches committed (`processing`/`ready`) assets | INT | R-012 | Critical invariant |
| **P0-031** | Weekly diff-sweep removes storage prefixes with no live asset row | INT | R-012 | Deliberate orphan seeded |
| **P0-032** | Send-suppression: no task/message sends to any inactive state (FR4) | INT | R-018 | All 3 inactive states + deleted |
| **P0-033** | Auth mail via send-email hook creates send_record; bounce webhook → admin-visible failure (NFR14) | INT | R-006 | Fallback keyed ingest if hook unavailable |
| **P0-034** | Magic link is single-use: second consumption fails (NFR7) | INT | R-014 | |
| **P0-035** | Expired link → 410 `LINK_EXPIRED` → `/auth/error` one-tap re-request works (FR3) | E2E | R-014 | Shortened TTL config |
| **P0-036** | `acceptance_records` INSERT-only: UPDATE/DELETE rejected at DB level (NFR10) | INT | R-007 | Grants + trigger |
| **P0-037** | Chain-verify job: intact chain passes; tampered record detected → alert path | INT | R-007 | Sentry capture asserted via hook/spy |
| **P0-038** | Chain-verify treats tombstoned users' records as valid | INT | R-007 | No false positives |
| **P0-039** | Audit expiry deletes only `audit_events` >6 months; acceptance records + durable events untouched (FR35) | INT | R-011 | Backdated rows across all 4 retention classes |
| **P0-040** | Journeys J1 + J3 happy paths (invite→consent→task→upload→done; triage→tag/star→filter→export) | E2E | R-001/R-003 | Thin wiring specs + axe checks |

**Total P0:** ~40 tests

### P1 (High)

**Criteria:** Important features + Medium risk (3–4) + Common workflows + Workaround exists but difficult

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **P1-001** | Capture mode upload (`<input capture>`) works in same flow (FR10) | E2E | R-001 | |
| **P1-002** | Descriptions on uploads; edit via PATCH (FR13) | INT | — | |
| **P1-003** | Task-context upload sets validated `assets.task_id` (FR15) | INT | — | Open task addressed to session user |
| **P1-004** | Per-type caps config: single source in `limits.ts` consumed by client + server | UNIT | R-001 | |
| **P1-005** | Server-side re-validation of caps at commit (defense-in-depth) | INT | R-001 | |
| **P1-006…P1-010** | Task CRUD; per-recipient mark-done; `tasks.fulfilled_at` = first completion; task list states incl. due badge (FR16–18) | INT | — | KPI columns asserted |
| **P1-011…P1-014** | Messaging: channel selection per send (FR19); free-form to one/all active (FR20); per-recipient send records; channel isolation (SMS adapter failure → email unaffected, NFR20) | INT | R-009 | Adapter fakes |
| **P1-015…P1-019** | Library filters (ambassador/type/date/tag) + description/tag search correctness; cursor pagination shape; auto-derived type category (FR21, FR22, FR24) | INT | R-010 | Correctness here; perf in P2 |
| **P1-020…P1-026** | Worker transcode jobs on fixture corpus: tiled HEIC→WebP, HEVC→faststart mp4 720p + poster, png thumbs, audio/doc no-renditions; all-or-nothing failure cleanup; max-3-receives → failed; retry endpoint re-enqueues (FR23, NFR12) | INT | R-005 | Real ffmpeg container |
| **P1-027** | Originals bit-exact after transcode (NFR12) | INT | R-005 | Checksum compare in test |
| **P1-028…P1-031** | Triage queue predicate (untriaged + processing/ready, `created_at ASC`); star/tag set `triaged_at`, bulk-tags does NOT; stars shared across admins; deleted-while-viewed → quiet advance (FR25–27) | INT + E2E (J3 covers happy path) | R-013 | |
| **P1-032…P1-034** | Magic-link E2E via Mailpit: invite → first login → consent cards; plain login; re-request flow (FR1–3) | E2E | R-006 | The only email-scraping specs |
| **P1-035…P1-038** | Webhooks: unsigned → 401 no-detail; monotonic lattice (no `delivered` downgrade); duplicate event idempotent; unknown id → 200 + log (NFR14) | INT + UNIT (lattice reducer) | R-008, R-017 | |
| **P1-039…P1-041** | Budget: 46elks 403 → persisted state + `BUDGET_REACHED` envelope + SMS disabled pre-send + email unaffected; Brevo quota → same envelope; state clears on balance restore (FR36, NFR19) | INT | R-009 | |
| **P1-042…P1-045** | Export naming pure fn: å/ä→a ö→o slugs, NFC, `nn` sequence per (ambassador, date), Stockholm date boundary, extension preserved (FR30) | UNIT | R-016 | Property-style cases |
| **P1-046…P1-048** | Export flow: zip contents match selection; status poll → ready → 302 download; export_record + items durable (FR30) | INT + E2E (J3 covers happy path) | R-016 | Worker zip job |
| **P1-049…P1-050** | Ambassador management: invite, contact CRUD, activate/deactivate, last-login/activity (FR31–32) | INT | — | |
| **P1-051** | Journey J2: oversize reject → trim → interrupt-resume → decline → re-entry → delete-own | E2E | R-001, R-002 | + axe check |
| **P1-052** | Admin brand-asset upload lands with `origin: admin` in shared library (FR28) | INT | — | |
| **P1-053** | Audit emission: every registry mutation emits in-tx; unknown event type rejected at compile/runtime (FR34) | INT + UNIT | R-011 | Closed registry |
| **P1-054** | Keyboard operability of triage queue + consent card focus states (NFR18) | E2E | — | A11y beyond axe scans |

**Total P1:** ~50 tests

### P2 (Medium)

**Criteria:** Secondary features + Low risk (1–2) + Edge cases + Regression prevention

| Test ID | Requirement | Test Level | Risk Link | Notes |
| --- | --- | --- | --- | --- |
| **P2-001** | Library filter/search <500 ms on 5k-asset seed (NFR5) | E2E perf | R-010 | Nightly |
| **P2-002** | Thumbnail route within 200 ms budget; Cache-Control private max-age=300 present (NFR2) | E2E perf | R-010 | Nightly |
| **P2-003** | Throttled-4G: notification link → interactive task list <3 s (NFR1) | E2E perf | — | Nightly; ADR decision 16 reading |
| **P2-004** | 2 GB video transcode within 5-min per-asset SLA (NFR3) | INT (worker) | R-015 | Weekly |
| **P2-005** | Processing-state UI: poll flips tile pending→processing→ready; failed state renders retry (FR23) | E2E | R-005 | Seeded state transitions |
| **P2-006** | Error envelope shape + code→status map conformance across endpoints | INT | — | Contract-style sweep |
| **P2-007** | Global client handling: `SESSION_REVOKED` → login redirect with `next`; `CONSENT_REQUIRED` → consent | E2E | R-002 | QueryCache onError |
| **P2-008** | Config/residency smoke: Supabase region, vercel.json arn1, Sentry EU DSN, buckets private, noindex header (NFR9) | INT | — | Assertion script |
| **P2-009** | Zip 7-day expiry job; expired export download → clean error | INT | — | Backdated export |
| **P2-010** | Multi-admin LWW: concurrent triage verbs converge; Z-undo clears regardless of setter | INT | R-013 | |
| **P2-011** | Tag CRUD + tags-as-folders browse; bulk tag add/remove (FR27) | INT | — | |
| **P2-012** | KPI columns updated by DAL (invited_at, first_accepted_at, first_upload_at, last_login_at) | INT | — | Week-one instrumentation |
| **P2-013** | Queue payload Zod schemas reject malformed/mis-versioned messages | UNIT | — | |
| **P2-014** | Slug/datetime helpers (Stockholm rendering, UTC wire) | UNIT | — | |
| **P2-015** | axe scans on remaining admin pages (ambassadors, messages, exports) | E2E | — | J-specs cover the rest |

**Total P2:** ~30 tests (rows above group some multi-case suites)

### P3 (Low)

**Criteria:** Nice-to-have + Exploratory + Benchmarks

| Test ID | Requirement | Test Level | Notes |
| --- | --- | --- | --- |
| **P3-001** | Exploratory triage session (charter: keyboard-only, 40-item queue) | Manual | Pre-release |
| **P3-002** | Exploratory mobile upload session on 2–3 real devices | Manual | Overlaps iOS launch gate |
| **P3-003** | Upload throughput benchmark (dozen-file batch) | E2E perf | Baseline only |
| **P3-004** | Sentry event hygiene: domain errors NOT captured, unexpected errors captured | INT | Spot check |

**Total P3:** ~5 tests

---

## Execution Strategy

**Philosophy:** Run everything in PRs unless there's significant infrastructure overhead. Playwright with parallelization is fast (100s of tests in ~10–15 min).

### Every PR: Vitest + Playwright (~10–15 min)

- All unit + integration tests (local Supabase service container)
- All E2E journey/functional specs using seeded renditions and small files (no ffmpeg dependency)
- Parallelized Playwright shards; axe checks embedded
- Includes P0, P1, P2 functional tests

**Why run in PRs:** fast feedback; the only excluded specs are those needing the worker container, large files, or throttled networks.

### Nightly: Worker-in-the-Loop + Perf (~30–60 min)

- Transcode suite against the real ffmpeg worker container (P1-020…P1-027)
- Interruption harness with larger files; throttled-4G checks (P2-001…P2-003, P2-005)

**Why defer:** container build + large media + network throttling are slow and environment-heavy.

### Weekly: Long-Running (~hours)

- 2 GB max-size upload + transcode SLA run (P2-004)
- Burn-in loop on flaky-suspect specs
- Full regression incl. P3 benchmarks

**Manual (excluded from automation):** restore exercise, iOS real-device checklist, deliverability checks, exploratory charters (P3-001/002).

---

## QA Effort Estimate

**QA test development effort only** (solo dev wearing the QA hat; excludes production-code work):

| Priority | Count | Effort Range | Notes |
| --- | --- | --- | --- |
| Infrastructure | — | ~20–30 h | Factories, auth minting, Mailpit, worker CI compose, fixture corpus, perf seed |
| P0 | ~40 | ~30–45 h | Interruption harness and erasure sweep are the complex ones |
| P1 | ~50 | ~25–40 h | Standard integration coverage |
| P2 | ~30 | ~10–20 h | Perf checks, smoke suites |
| P3 | ~5 | ~2–5 h | Mostly manual charters |
| **Total** | ~125 | **~90–140 h (~2.5–4 weeks full-time equivalent)** | Spread across build phases — each subsystem's tests land with it |

**Assumptions:**

- Includes test design, implementation, debugging, CI integration; excludes ongoing maintenance (~10%)
- Test infrastructure lands with the auth spine; the upload harness lands with the upload pipeline (build-first subsystems get tests first)

**Dependencies from other teams:** see "Dependencies & Test Blockers".

---

## Implementation Planning Handoff

| Work Item | Owner | Target Milestone | Dependencies/Notes |
| --- | --- | --- | --- |
| Factories + auth-minting fixture + Mailpit wiring | Dev | Auth spine phase | B-1 |
| Auth/consent/role-separation P0 suites | Dev | Auth spine phase | Factories |
| Upload interruption harness + commit suite | Dev | Upload phase | R-001 (release block) |
| Worker CI compose + fixture corpus + transcode suite | Dev | Transcode phase | B-2 |
| Deletion/erasure residual-sweep suite | Dev | Deletion phase | Factories |
| Adapter fakes + webhook simulators + messaging suites | Dev | Messaging phase | B-3 |
| Cron/GC/chain-verify job suites | Dev | Maintenance phase | Invokable handlers |
| Perf seed (5k assets) + nightly tier | Dev | CI hardening phase | |

---

## Tooling & Access

| Tool or Service | Purpose | Access Required | Status |
| --- | --- | --- | --- |
| Supabase CLI (local stack) | Integration/E2E environment | None (local) | Ready |
| Mailpit (bundled with Supabase local) | Magic-link E2E | None | Ready |
| Worker Docker image (ffmpeg 8.1) | Transcode suite | GHCR/Docker build in CI | Pending (B-2) |
| @seontechnologies/playwright-utils | API-request fixtures, polling (recurse) for async pipelines | npm | Ready |
| Hosted Supabase EU staging project | Pre-release smoke (local-vs-hosted divergence) | Supabase org access | Pending |

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope | Validation Steps |
| --- | --- | --- | --- |
| **Supabase Auth (session controls)** | All auth suites depend on hosted-vs-local parity | Auth P0 suite | Staging smoke of login/revocation before release candidates |
| **Supabase Storage TUS** | Upload harness assumptions (6 MB chunks, 24 h URLs) | Upload P0 suite | Re-run harness on Supabase platform updates |
| **Brevo / 46elks APIs** | Adapter fixtures can drift from live APIs | Messaging P1 suite | Re-record fixtures on provider API version changes |
| **ffmpeg 8.1 static build** | Corpus results tied to build version | Transcode P1 suite | Re-run corpus on ffmpeg upgrades |

**Regression test strategy:** the PR tier is the standing regression net; provider/platform upgrades additionally trigger the affected nightly suite manually.

---

## Appendix A: Code Examples & Tagging

**Playwright tags for selective execution:**

```typescript
import { test } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { expect } from '@playwright/test';

// P0 security test — ambassador cannot reach admin surface
test('@P0 @API @Security ambassador session gets 403 on admin library', async ({ apiRequest }) => {
  const { status, body } = await apiRequest({
    method: 'GET',
    path: '/api/triage',
    // fixture authenticates as seeded ambassador
  });

  expect(status).toBe(403);
  expect(body.error.code).toBe('FORBIDDEN');
});

// P1 async pipeline test — poll until transcode completes (recurse utility)
import { recurse } from '@seontechnologies/playwright-utils';

test('@P1 @API transcode flips asset to ready', async ({ apiRequest }) => {
  // (seed pending asset + enqueue transcode job via factory here)
  const assetId = 'seeded-asset-id';

  const ready = await recurse(
    () => apiRequest({ method: 'GET', path: `/api/assets/${assetId}` }),
    ({ body }) => body.processingStatus === 'ready',
    { timeout: 60_000, interval: 3_000 },
  );

  expect(ready.body.processingStatus).toBe('ready');
});
```

**Run specific tags:**

```bash
npx playwright test --grep @P0            # P0 only
npx playwright test --grep "@P0|@P1"      # P0 + P1
npx playwright test --grep @Security      # security suite
npx playwright test                        # full PR tier
```

---

## Appendix B: Knowledge Base References

- **Risk Governance:** `risk-governance.md` — risk scoring methodology, gate decision rules
- **Probability & Impact:** `probability-impact.md` — 1–3 scale definitions, threshold actions
- **Test Priorities Matrix:** `test-priorities-matrix.md` — P0–P3 criteria
- **Test Levels Framework:** `test-levels-framework.md` — E2E vs API vs Unit selection, duplicate-coverage guard
- **Test Quality:** `test-quality.md` — Definition of Done (no hard waits, no conditionals, <300 lines, <1.5 min, self-cleaning, explicit assertions)

---

**Generated by:** BMad TEA Agent
**Workflow:** `bmad-testarch-test-design`
**Version:** 4.0 (BMad v6)
