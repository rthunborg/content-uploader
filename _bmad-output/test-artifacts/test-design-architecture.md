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

# Test Design for Architecture: Stena Content Portal (MVP)

**Purpose:** Architectural concerns, testability gaps, and NFR requirements for review by the dev team. Serves as a contract between QA and Engineering on what must be addressed before test development begins.

**Date:** 2026-07-08
**Author:** Rasmus (via TEA Master Test Architect)
**Status:** Architecture Review Pending
**Project:** stena-content-portal
**PRD Reference:** `_bmad-output/planning-artifacts/prd.md`
**ADR Reference:** `_bmad-output/planning-artifacts/architecture.md` (Architecture Decision Document, complete, decisions 1–24 binding)

---

## Executive Summary

**Scope:** MVP (FR1–36) of an internal, GDPR-sensitive employee-content platform: magic-link auth + versioned consent, chunked resumable uploads, async ffmpeg transcoding, admin library/triage/export, tasks & multi-channel messaging, audit/erasure governance. v1.1 features (FR37–48) are out of scope; their MVP seams (origin enum, durable event stores, provenance hooks) are covered only where MVP behavior depends on them.

**Business Context** (from PRD):

- **Problem:** authentic employee content is scattered, unprovable, and unusable; the portal closes a request → upload → triage → export loop.
- **Impact metrics:** <2 min task-to-upload (mobile), <10 min request-to-export (admin), zero consent/GDPR incidents.
- **Launch:** MVP in weeks (solo dev, AI-assisted); v1.1 fast-follow ~4–6 weeks later.

**Architecture** (from ADR):

- Next.js 16 (Vercel arn1) + Supabase EU (Postgres/Auth/Storage-TUS/pgmq/cron) + Railway ffmpeg worker (Amsterdam).
- Server-only DAL as the single choke point (auth context, consent gate, role scoping, audit emission).
- Staged-atomic upload protocol (Uppy → TUS → commit), INSERT-only HMAC-chained acceptance records, four retention classes, one authoritative delete path with `delete`/`erasure` modes.

**Expected Scale:** 10–20 ambassadors + small admin team; thousands of assets; hundreds of GB → low TB.

**Risk Summary:**

- **Total risks:** 18
- **High-priority (≥6):** 7 (one score-9: upload pipeline integrity)
- **Test effort:** ~110–140 automated scenarios, ~90–140 h total including infrastructure (see QA doc)

---

## Quick Guide

### 🚨 BLOCKERS - Team Must Decide (Can't Proceed Without)

**Pre-Implementation Critical Path** — these MUST be decided/provided before integration and E2E test development:

1. **B-1: Test authentication strategy** — Provide a deterministic session-minting path: `supabase.auth.admin.generateLink()` (or seeded sessions) for test setup + local Mailpit for the specs that test the magic-link flow itself, plus a script/fixture creating users in each of the 5 account states (recommended owner: Dev)
2. **B-2: Worker-in-CI topology** — Decide how `processing → ready` is exercised in CI: worker Docker container composed against local Supabase for the transcode suite, with renditions seeded directly for all library/triage specs (recommended owner: Dev)
3. **B-3: Provider fault-injection seams** — Brevo/46elks adapters must be constructible with fake transports; provide signed-webhook payload simulators and a way to set the persisted SMS budget state; without these FR36/NFR14/NFR20 are untestable (recommended owner: Dev)

**What we need from team:** Complete these 3 items pre-implementation (alongside the auth spine and upload pipeline) or test development is blocked.

### ⚠️ HIGH PRIORITY - Team Should Validate (We Provide Recommendation, You Approve)

1. **R-001 harness approach:** Playwright route-abort on TUS chunk PATCH requests to simulate interruption/resume deterministically, plus a token-rollover-during-long-upload spec; iOS Safari real-device run stays a manual launch gate (upload pipeline phase)
2. **R-002 revocation verification:** integration tests assert deactivate/withdraw → `auth.admin.signOut` → next DAL call rejects; the ≤10-min TUS chunk residual is accepted per ADR decision 23 and asserted only at the commit checkpoint (auth spine phase)
3. **Time control for scheduled jobs:** test cron/maintenance handlers by seeding backdated rows and invoking job functions directly — never wait on real schedules; link expiry via shortened TTL in local Supabase config (maintenance phase)
4. **NFR1 contract:** tests measure notification link → interactive task list < 3 s on throttled 4G (the ADR's adopted UX reading — flagged for PRD wording sync)

**What we need from team:** Review recommendations and approve (or suggest changes).

### 📋 INFO ONLY - Solutions Provided (Review, No Decisions Needed)

1. **Test strategy:** integration-heavy split at the DAL choke point; Vitest for unit/integration, Playwright for the five PRD journeys + interruption harness; E2E never re-validates lower-level logic
2. **Tooling:** Vitest 4, Playwright 1.61 + @axe-core/playwright, playwright-utils, faker factories over Drizzle, local Supabase stack in CI
3. **Tiered CI/CD:** PR (<15 min, all functional) / nightly (worker-in-loop, perf, throttled-network) / weekly (2 GB SLA run, burn-in)
4. **Coverage:** ~110–140 scenarios prioritized P0–P3 with risk-based classification (QA doc)
5. **Quality gates:** P0 = 100%, P1 ≥ 95%, score-9 risk coverage is a release block condition

**What we need from team:** Just review and acknowledge.

---

## For Architects and Devs - Open Topics 👷

### Risk Assessment

**Total risks identified:** 18 (7 high-priority score ≥6, 10 medium, 1 low)

#### High-Priority Risks (Score ≥6) - IMMEDIATE ATTENTION

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **R-001** | **TECH/DATA** | Upload pipeline fails under real conditions: mid-batch interruption, iOS Safari backgrounding, partial upload becomes library-visible, resume loses data | 3 | 3 | **9** | Staged-atomic commit protocol (built); dedicated interruption harness; manual iOS device gate | Dev | Upload phase |
| **R-002** | **SEC** | Consent/revocation gate bypass: revoked or consent-stale session reads data or commits an upload | 2 | 3 | **6** | DAL-only table access + `getUser()` per request (built); full auth-context × account-state test matrix | Dev | Auth spine phase |
| **R-003** | **SEC** | Triage-signal leak: stars/dismissals reachable from ambassador sessions via any endpoint, serializer, or media URL | 2 | 3 | **6** | DAL file split + role-scoped wire types (built); negative-authorization suite | Dev | Auth spine + library phase |
| **R-004** | **DATA** | Erasure incomplete: renditions, backup replica, export zips, attributions, or send-record PII survive Art. 17 erasure | 2 | 3 | **6** | Single `deleteAssets` path + ordered erasure protocol (ADR decision 4); full-residual-sweep integration test; runbook dry-run launch gate | Dev + HR | Deletion phase |
| **R-005** | **TECH** | Transcoding fails on real-world media (tiled HEIC, HEVC, 4K) → broken previews or stuck `processing` | 3 | 2 | **6** | ffmpeg 8.1+ (built); fixture-corpus job tests; all-or-nothing rendition rule; retry endpoint | Dev | Transcode phase |
| **R-006** | **OPS** | Magic-link email undeliverable = users cannot log in; failure invisible without delivery tracking | 2 | 3 | **6** | Send-email hook → send_records (ADR decision 3); bounce-visibility tests; SPF/DKIM/DMARC launch checklist | Dev | Messaging phase + launch gate |
| **R-012** | **DATA** | Orphan-GC race deletes a still-in-progress or committed upload's storage prefix or pending row | 2 | 3 | **6** | 24 h TTL aligned to TUS URL expiry (built); GC boundary tests incl. committed-never-swept invariant | Dev | Maintenance phase |

#### Medium-Priority Risks (Score 3-5)

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-007 | DATA | HMAC chain false positives/negatives (tombstones flagged as tampering; real tampering undetected) | 2 | 2 | 4 | Chain-verify job tests: intact/tampered/tombstoned cases | Dev |
| R-008 | TECH | Webhook bugs: `delivered` downgraded, duplicates double-processed, unknown ids crash | 2 | 2 | 4 | Monotonic-lattice unit tests + idempotency integration tests | Dev |
| R-009 | BUS | Budget-cap handling leaks raw provider errors or blocks email when only SMS is capped | 2 | 2 | 4 | Adapter-boundary normalization tests (`BUDGET_REACHED`), channel-isolation tests | Dev |
| R-010 | PERF | Library/triage degrades at thousands of assets | 2 | 2 | 4 | Named indexes + GIN search (built); nightly perf checks on 5k-asset seed | Dev |
| R-014 | SEC | Magic-link token misuse: reused/expired links authenticate; expiry UX dead-ends | 2 | 2 | 4 | Single-use/expiry tests; `/auth/error` → re-request path test | Dev |
| R-015 | PERF | NFR3 transcode SLA miss for max-size video under batch load | 2 | 2 | 4 | Weekly 2 GB SLA run; FIFO best-effort documented | Dev |
| R-016 | BUS | Export naming wrong: å/ä/ö slugs, sequence collisions, timezone-boundary dates | 2 | 2 | 4 | Pure-function unit suite on `export-naming.ts` | Dev |
| R-018 | BUS | Send-suppression failure: inactive/declined ambassadors still receive tasks/messages | 2 | 2 | 4 | Suppression tests across every inactive account state | Dev |
| R-011 | DATA | Audit-expiry cron touches wrong table or deletes exempt acceptance records | 1 | 3 | 3 | Cron SQL scoped by table name (built); targeted expiry-boundary test | Dev |
| R-017 | SEC | Webhook endpoints accept unverified payloads | 1 | 3 | 3 | Verify-before-parse (built); 401-on-unsigned tests | Dev |

#### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | Probability | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-013 | OPS | Multi-admin last-write-wins surprises (delete-while-viewing, concurrent triage) | 2 | 1 | 2 | Monitor; one NOT_FOUND-advance test |

#### Risk Category Legend

- **TECH**: Technical/Architecture · **SEC**: Security · **PERF**: Performance · **DATA**: Data Integrity · **BUS**: Business Impact · **OPS**: Operations

---

### Testability Concerns and Architectural Gaps

**🚨 ACTIONABLE CONCERNS - Team Must Address**

#### 1. Blockers to Fast Feedback (WHAT WE NEED FROM ARCHITECTURE)

| Concern | Impact | What Architecture Must Provide | Owner | Timeline |
| --- | --- | --- | --- | --- |
| **No test-auth path** (magic-link-only login) | Every E2E spec blocked on email scraping | Admin `generateLink`/seeded-session fixture + Mailpit wiring + account-state seed script (B-1) | Dev | Auth spine phase |
| **No factory/seeding layer** | Slow, unrepeatable setup; edge states (HMAC chains, mid-lattice send records, processing states) unconstructible | Drizzle-based factory module usable by Vitest and Playwright global setup | Dev | Auth spine phase |
| **Worker dependency undefined in CI** | Transcode/`ready`-state specs can't run or become flaky | Worker container in CI compose for the transcode suite; direct rendition seeding everywhere else (B-2) | Dev | Transcode phase |
| **No provider fault injection** | FR36/NFR14/NFR20 untestable | Adapter fake transports, signed webhook simulators, budget-state setter (B-3) | Dev | Messaging phase |

#### 2. Architectural Improvements Needed (WHAT SHOULD BE CHANGED)

1. **Job handlers must be directly invokable with injected inputs**
   - **Current problem:** audit expiry, orphan GC, chain verification, and zip expiry are reachable only via pg_cron/pgmq schedules.
   - **Required change:** export each worker job and cron action as a plain function callable from tests with seeded (backdated) data.
   - **Impact if not fixed:** time-dependent behavior (R-011, R-012, R-007) only verifiable by waiting — effectively untested.
   - **Owner:** Dev — **Timeline:** worker/maintenance phase

No further structural changes required — the architecture is otherwise strongly test-friendly (below).

---

### Testability Assessment Summary

**📊 CURRENT STATE - FYI**

#### What Works Well

- Server-only DAL choke point: auth context, consent gate, role scoping, and audit emission are all assertable at one integration seam; the ambassador/admin DAL file split plus role-scoped wire types make triage-signal leaks type errors.
- Closed AUDIT_EVENTS registry with tx-threaded `audit.emit`: deterministic, atomic compliance assertions.
- Canonical error envelope + code→status map: every negative path has an exact wire shape.
- Runtime-neutral `src/shared` kernel (limits, slug, export naming, queue schemas): pure-function unit territory.
- Honest-state doctrine + polling: no optimistic-mutation races in upload/processing/export paths.
- Worker ↔ app communicate only via Postgres + storage: worker jobs testable by seeding pgmq messages, no HTTP mocking.
- Local Supabase stack + migrations-as-code + seed.sql: full-stack CI environment already specified, with Vitest/Playwright/axe named in the CI plan.

#### Accepted Trade-offs (No Action Required)

- **TUS chunk-window exposure** (revoked user can push chunks ≤ ~10 min but never commit) — per ADR decision 23; tested at the commit checkpoint only.
- **NFR16 restore exercise, iOS Safari device run, deliverability (SPF/DKIM/DMARC)** — manual launch gates, not CI automation.
- **NFR9 EU residency** — verified by configuration inspection/processor inventory plus a small config-assertion smoke, not functional tests.

---

### Risk Mitigation Plans (High-Priority Risks ≥6)

Production-side mitigations only; QA test coverage per risk is specified in the QA doc.

#### R-001: Upload pipeline integrity (Score: 9) - CRITICAL

**Mitigation Strategy:**

1. Implement the ADR's staged-atomic protocol exactly: pending row → TUS 6 MB chunks → commit verifies existence/size/type → status flip + enqueue in one transaction.
2. Supply dynamic TUS auth headers (function-form) so token refresh survives long uploads.
3. Keep per-file independence in batches (no batch-level transaction).

**Owner:** Dev · **Timeline:** upload phase (build-first) · **Status:** Planned
**Verification:** interruption harness + commit-atomicity suite green (QA doc P0-001…P0-008); manual iOS device gate signed off before launch.

#### R-002: Consent/revocation gate (Score: 6)

1. All table access through DAL auth contexts (`requireUser`/`requireAdmin`/`requireUserPreConsent`/`systemContext`); no direct db-client imports in routes (eslint-enforced).
2. Deactivate/withdraw/delete call `auth.admin.signOut(userId)` in the same operation.

**Owner:** Dev · **Timeline:** auth spine phase · **Status:** Planned
**Verification:** auth-matrix integration suite green; revocation propagation test proves next request rejects.

#### R-003: Praise/triage separation (Score: 6)

1. Split ambassador/admin DAL files; ambassador wire types omit triage fields at the type level.
2. Media reads only via app 302 route with DAL access check.

**Owner:** Dev · **Timeline:** auth spine + library phase · **Status:** Planned
**Verification:** negative-authorization suite green; serializer snapshot proves no triage fields on ambassador payloads.

#### R-004: Complete erasure (Score: 6)

1. One `deleteAssets(assetIds, {mode})` path for all three delete surfaces; erasure mode executes the ADR's ordered protocol (replica sweep, zip force-expiry, attribution purge, PII nulling, crypto-shred + tombstone, `erasure_records`).

**Owner:** Dev (+ HR runbook adoption) · **Timeline:** deletion phase · **Status:** Planned
**Verification:** full-residual-sweep integration test green; offboarding runbook dry-run before launch.

#### R-005: Transcoding robustness (Score: 6)

1. ffmpeg 8.1+ static build (tiled HEIC); sharp for non-HEIC stills; all-or-nothing rendition failure with partial-rendition cleanup; `retry-processing` endpoint.

**Owner:** Dev · **Timeline:** transcode phase · **Status:** Planned
**Verification:** fixture-corpus job suite green (real HEIC/HEVC/mp4 samples).

#### R-006: Auth email delivery (Score: 6)

1. Supabase send-email hook dispatches through the Brevo adapter so every auth mail gets a send_record + webhook tracking; bounced invites surface on the admin messages page.
2. Raise Supabase auth-email rate limit after custom SMTP wiring.

**Owner:** Dev · **Timeline:** messaging phase · **Status:** Planned
**Verification:** hook integration test + bounce-visibility test green; deliverability launch checklist complete.

#### R-012: Orphan-GC safety (Score: 6)

1. GC deletes only rows/prefixes `pending` > 24 h (TUS URL TTL); weekly diff-sweep compares storage prefixes to live asset ids.

**Owner:** Dev · **Timeline:** maintenance phase · **Status:** Planned
**Verification:** GC boundary suite green, including the committed-assets-never-swept invariant.

---

### Assumptions and Dependencies

#### Assumptions

1. The ADR is implemented as written (decisions 1–24 binding); test design assumes the DAL/audit/deletion patterns exist as specified.
2. Local Supabase stack (`supabase start`) is representative of production behavior for Auth, Storage TUS, pgmq, and RLS.
3. Solo developer owns both production code and test code; no separate QA role.
4. NFR1 is measured to the task list (ADR decision 16), pending PRD wording sync.
5. UI copy language (English vs Swedish) is unresolved — copy-assertion tests target error *codes* and structure, not exact strings, until decided.

#### Dependencies

1. B-1 test-auth strategy — required by auth spine phase
2. B-2 worker-in-CI decision — required by transcode phase
3. B-3 provider fault-injection seams — required by messaging phase
4. Fixture media corpus (tiled iPhone HEIC, HEVC clip, mp4, png, pdf, oversize samples) — required by transcode phase

#### Risks to Plan

- **Risk:** CI runtime blows the 15-min PR budget once worker-in-loop and large-file specs land.
  - **Impact:** slower feedback, temptation to skip suites.
  - **Contingency:** those suites are nightly by design; PR tier uses seeded renditions and small files only.
- **Risk:** Supabase local stack diverges from hosted behavior (session controls, storage RLS).
  - **Impact:** false confidence in auth/upload suites.
  - **Contingency:** thin staging smoke (tagged subset) against a hosted EU project before release candidates.

---

**End of Architecture Document**

**Next Steps for Architecture Team:**

1. Review Quick Guide (🚨/⚠️/📋) and prioritize blockers B-1..B-3
2. Confirm owners/timelines for high-priority risks (≥6)
3. Validate assumptions and dependencies
4. Feed decisions back before the auth spine phase starts

**Next Steps for QA Team:**

1. Wait for pre-implementation blockers to be resolved
2. Refer to companion QA doc (test-design-qa.md) for test scenarios
3. Begin test infrastructure setup (factories, fixtures, environments)
