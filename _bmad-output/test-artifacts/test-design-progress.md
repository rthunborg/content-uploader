---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-07-08'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad/tea/config.yaml'
  - 'knowledge/risk-governance.md'
  - 'knowledge/probability-impact.md'
  - 'knowledge/test-levels-framework.md'
  - 'knowledge/test-quality.md'
  - 'knowledge/adr-quality-readiness-checklist.md'
---

# Test Design Progress

## Step 1: Mode Detection

- **Mode:** System-Level
- **Rationale:** No `sprint-status.yaml` found in `_bmad-output/implementation-artifacts/` (no epics/stories yet). Planning artifacts present: `prd.md`, `architecture.md`, `ux-design-specification.md` — satisfies System-Level prerequisites (PRD + architecture/ADR).
- **Inputs located:**
  - PRD: `_bmad-output/planning-artifacts/prd.md`
  - Architecture: `_bmad-output/planning-artifacts/architecture.md`
  - UX spec: `_bmad-output/planning-artifacts/ux-design-specification.md`
  - Project context: `_bmad-output/project-context.md`

## Step 2: Context & Knowledge Loaded

- **Config (tea):** `tea_use_playwright_utils: true`, `tea_use_pactjs_utils: false`, `tea_pact_mcp: none`, `tea_browser_automation: auto`, `test_stack_type: auto`, `risk_threshold: p2`, `test_artifacts: _bmad-output/test-artifacts`, `test_design_output: _bmad-output/test-artifacts/test-design`
- **Stack detection:** Greenfield — no code scaffolded yet. Detected stack from architecture doc: **fullstack** (Next.js 16 App Router + React 19 + Supabase EU + Railway ffmpeg worker; testing stack decided in architecture: Vitest + Playwright + @axe-core/playwright).
- **Artifacts loaded:** PRD (48 FRs: 36 MVP / 12 v1.1; 20 NFRs; 5 journeys), Architecture Decision Document (complete, READY FOR IMPLEMENTATION, decisions 1–24 binding). No epics/stories exist yet.
- **Knowledge fragments loaded (system-level core set):** risk-governance, probability-impact, test-levels-framework, test-quality, adr-quality-readiness-checklist.
- **Browser exploration:** skipped — no running application exists (greenfield, pre-implementation).
- **Contract testing:** not relevant — monolith + worker communicating via Postgres; no external API consumers.

## Step 3: Testability Review & Risk Assessment

### 🚨 Testability Concerns (actionable)

1. **No documented test-auth strategy for magic-link-only login.** Every E2E flow starts behind `signInWithOtp`. Without a deterministic session-minting path, all E2E tests would scrape email. Required: (a) local Supabase Mailpit for the 2–3 specs that test the magic-link flow itself; (b) `supabase.auth.admin.generateLink()` / seeded sessions + Playwright `storageState` for every other spec.
2. **No seeding/factory layer defined.** Tests need instant construction of: profiles in each of the 5 account states, terms versions + acceptance records (with valid HMAC chains), assets in each `processing_status`, tagged/starred/triaged library states, send_records mid-lattice. Required: Drizzle-based factory module (faker-driven, parallel-safe) usable by Vitest and Playwright global setup.
3. **Worker-in-the-loop ambiguity for CI.** `processing → ready` transitions require the Railway ffmpeg worker. Decision needed: CI composes the worker Docker container against local Supabase (true integration), plus job-level tests with small real media fixtures (incl. tiled HEIC, HEVC, faststart verification). Renditions can be seeded directly for library/triage specs so they don't depend on ffmpeg.
4. **Provider fault injection undefined.** Brevo/46elks adapters are the right seam, but tests need: recorded response fixtures (success, bounce, 403 "Not enough credits"), signed webhook payload simulators, and a way to flip the persisted SMS budget state. FR36/NFR14/NFR20 are untestable without these.
5. **Upload interruption is hard to reproduce deterministically.** NFR4/NFR13 need Playwright route-abort on TUS PATCH requests (kill chunks mid-flight, assert resume + atomic commit), plus a token-rollover-during-long-upload spec (architecture decision 7). Real-device (iOS Safari) verification remains a manual launch-gate checklist item.
6. **Time-dependent behavior needs clock control.** 6-month audit expiry, 24 h orphan GC, 15-min link expiry, 7-day zip TTL, 30-day session inactivity. Strategy: seed backdated rows and invoke job SQL/handlers directly — never wait; link expiry tested via Supabase local config with shortened TTL or admin-expired tokens.
7. **NFR16 backup/restore is not automatable** — tested restore exercise is already a named launch gate (manual runbook). FYI, keep out of CI scope.

### ✅ Testability Assessment Summary (strengths)

- **Server-only DAL choke point** — auth context, consent gate, role scoping, audit emission all testable at one integration seam; ambassador/admin DAL file split makes praise/triage leaks structurally assertable (and type errors at compile time).
- **Closed AUDIT_EVENTS registry + tx-threaded `audit.emit`** — deterministic compliance assertions ("this mutation emitted exactly this event, atomically").
- **Canonical error envelope + code→status map** — every negative path has an exact, assertable wire shape.
- **Runtime-neutral `src/shared` kernel** (limits, export-naming, slug, queue payload schemas) — pure-function unit-test territory.
- **Honest-state doctrine + polling** — UI states derive from server acks; no optimistic-mutation race flakiness in the critical upload/processing/export paths; network-first Playwright waits map cleanly onto the 3 s/5 s/15 s polls.
- **Worker ↔ app only via Postgres + storage** — worker jobs testable by seeding pgmq messages; no HTTP mocking needed.
- **Supabase local stack + migrations-as-code + seed.sql** — full-stack CI environment already in the architecture (`supabase start`), with Vitest + Playwright + axe-core named in CI.

### ASRs (Architecturally Significant Requirements)

| # | ASR | Source | Classification |
|---|-----|--------|----------------|
| ASR-1 | Atomic staged upload — no partial upload ever library-visible; lossless resume on iOS Safari | FR12, NFR4, NFR13 | **ACTIONABLE** — dedicated interruption test harness |
| ASR-2 | Per-request consent/revocation gate in DAL (`getUser()` + version check); revoked JWT window ≤ 10 min; TUS chunk residual accepted but commit must block | FR8, session model | **ACTIONABLE** |
| ASR-3 | Tamper-evident, INSERT-only acceptance records (HMAC chain + crypto-shred tombstones) | FR6, NFR10 | **ACTIONABLE** |
| ASR-4 | Server-side praise/triage separation — triage signals structurally unreachable from ambassador sessions | NFR8 | **ACTIONABLE** |
| ASR-5 | Complete-erasure orchestration across originals, renditions, replica, zips, attributions, send-record PII | FR29/33, NFR11 | **ACTIONABLE** |
| ASR-6 | Async transcode pipeline: HEIC/HEVC handling, all-or-nothing renditions, per-asset 5-min SLA (2 GB) | FR23, NFR3, NFR12 | **ACTIONABLE** |
| ASR-7 | Delivery tracking: per-recipient send records, monotonic status lattice, channel isolation, budget state | FR19/20/36, NFR14/19/20 | **ACTIONABLE** |
| ASR-8 | Retention classes: audit 6-month expiry scoped to `audit_events` only; acceptance records exempt; usage/export durable | FR35, NFR10 | **ACTIONABLE** |
| ASR-9 | EU residency on every processor | NFR9 | **FYI** — verified by configuration inspection/processor inventory, not automated tests |
| ASR-10 | Backups RPO ≤ 24 h / tested restore; replica erasure sweep | NFR16, NFR11 | **FYI** — manual launch-gate exercise + runbook |
| ASR-11 | Library performance at thousands of assets (<500 ms interactions, <200 ms thumbnails) | NFR2, NFR5 | **ACTIONABLE** (lightweight perf checks, seeded large library) |

### Risk Assessment Matrix

Scoring: Probability (1–3) × Impact (1–3); ≥6 = MITIGATE (high), 9 = BLOCK-level depth of coverage. Owner is the solo dev (Rasmus) unless noted.

| ID | Category | Risk | P | I | Score | Action |
|----|----------|------|---|---|-------|--------|
| R-001 | TECH/DATA | Upload pipeline fails under real conditions: interruption mid-batch, iOS Safari backgrounding, partial upload becomes library-visible, resume loses data | 3 | 3 | **9** | BLOCK-level coverage |
| R-002 | SEC | Consent/revocation gate bypass: revoked or consent-stale session reads data or commits an upload (stateless-JWT residual paths, missed DAL check) | 2 | 3 | **6** | MITIGATE |
| R-003 | SEC | Triage-signal leak: stars/dismissals reachable from an ambassador session via any endpoint, serializer, or media URL | 2 | 3 | **6** | MITIGATE |
| R-004 | DATA | Erasure incomplete: renditions, backup replica, export zips, usage attributions, or send-record PII survive Art. 17 erasure | 2 | 3 | **6** | MITIGATE |
| R-005 | TECH | Transcoding failures on real-world media: tiled HEIC, HEVC, 4K, odd containers → broken previews or stuck `processing` | 3 | 2 | **6** | MITIGATE |
| R-006 | OPS | Magic-link email undeliverable (SMTP misconfig, Brevo quota, spam filtering) = users cannot log in at all; failure invisible without delivery tracking | 2 | 3 | **6** | MITIGATE |
| R-012 | DATA | Orphan-GC race: cleanup deletes a still-in-progress (>24 h) or just-committed upload's storage prefix or pending row | 2 | 3 | **6** | MITIGATE |
| R-007 | DATA | HMAC chain false positives/negatives: tombstoned records flagged as tampering, or real tampering undetected | 2 | 2 | 4 | MONITOR |
| R-008 | TECH | Webhook processing bugs: status downgraded from `delivered`, duplicate events double-processed, unknown ids crash | 2 | 2 | 4 | MONITOR |
| R-009 | BUS | Budget-cap handling leaks raw provider errors or blocks email when only SMS is capped (FR36, NFR20) | 2 | 2 | 4 | MONITOR |
| R-010 | PERF | Library/triage degrades at thousands of assets (virtualized grid, filter queries, GIN search) | 2 | 2 | 4 | MONITOR |
| R-014 | SEC | Magic-link token misuse: reused/expired links authenticate, or expiry UX dead-ends (FR3 → 410 + re-request) | 2 | 2 | 4 | MONITOR |
| R-015 | PERF | NFR3 transcode SLA miss for max-size video under batch load (2 concurrent ffmpeg jobs) | 2 | 2 | 4 | MONITOR |
| R-016 | BUS | Export naming wrong: å/ä/ö slugs, sequence collisions, timezone-boundary dates break the "hand it to the agency" promise | 2 | 2 | 4 | MONITOR |
| R-018 | BUS | Send-suppression failure: inactive/declined ambassadors still receive tasks/messages (FR4 — trust/GDPR-adjacent) | 2 | 2 | 4 | MONITOR |
| R-011 | DATA | Audit-expiry cron touches the wrong table or deletes exempt acceptance records | 1 | 3 | 3 | DOCUMENT + targeted test |
| R-017 | SEC | Webhook endpoints accept unverified payloads (signature/Basic-auth bypass) | 1 | 3 | 3 | DOCUMENT + targeted test |
| R-013 | OPS | Multi-admin last-write-wins surprises (delete-while-viewing, concurrent triage) | 2 | 1 | 2 | DOCUMENT |

### High-Risk Mitigation Summary (score ≥ 6)

| Risk | Mitigation | When |
|------|-----------|------|
| R-001 (9) | Dedicated upload test harness: Playwright TUS-chunk abort/resume specs, batch independence, commit atomicity integration tests, token-rollover spec; manual iOS-device checklist as launch gate | Build-first phase (with upload pipeline) |
| R-002 (6) | DAL integration suite: every auth context × every account state; revocation propagation test (deactivate → admin.signOut → next request 401/403); consent-stale → 409 CONSENT_REQUIRED with `next` | Auth spine phase |
| R-003 (6) | Negative-authorization suite: ambassador session hits every admin endpoint + asserts wire types never contain `starred`/`dismissed`/triage fields; media URL access scoping | Auth spine + library phase |
| R-004 (6) | Erasure protocol integration test: seed full object graph → `deleteAssets(mode:'erasure')` → assert zero residuals in DB/storage/exports + attribution purge + tombstone; runbook dry-run as launch gate | Deletion/export phase |
| R-005 (6) | Worker job tests with real fixture corpus (tiled iPhone HEIC, HEVC, mp4, png, pdf); all-or-nothing rendition failure test; retry endpoint test | Transcode phase |
| R-006 (6) | Send-Email-hook integration test (auth mail → send_record), Mailpit E2E for magic-link flow, bounce-webhook → admin-visible failure test; SPF/DKIM/DMARC on launch checklist (manual) | Messaging phase + launch gate |
| R-012 (6) | Orphan-GC job tests: pending <24 h untouched, pending >24 h swept (prefix + row), committed assets never swept; weekly diff-sweep test with deliberate orphan | Transcode/maintenance phase |

## Step 4: Coverage Plan & Execution Strategy

### Test Level Split (duplicate-coverage guard applied)

- **Unit (Vitest):** `src/shared` kernel (limits, slug, export-naming, error-code map, queue payload schemas), Zod schemas, HMAC chain math, status-lattice reducer, provider-error normalization. Pure logic only — never re-tested through the UI.
- **Integration (Vitest against local Supabase):** DAL functions per auth context, upload init/commit protocol, deletion/erasure orchestration, audit emission transactionality, webhook handlers, cron/maintenance job handlers, worker jobs (with fixture media). The primary level for this system — the DAL choke point makes it the highest-value seam.
- **E2E (Playwright against local Supabase + worker):** the five PRD journeys as thin happy-path specs + the interruption harness + axe checks. E2E never re-validates business logic covered at lower levels; it validates the journeys work wired together.

### Coverage Matrix (MVP scope, FR1–36; risk-driven)

| Area | Scenario group | Level | Priority | ~Count | Covers |
|------|----------------|-------|----------|--------|--------|
| **Upload pipeline (R-001)** | Chunk-abort/resume mid-batch; batch per-file independence; no partial upload visible pre-commit; commit atomicity (verify→flip→enqueue one tx); commit idempotency; size/type mismatch → staged object deleted + typed error; `UPLOAD_INCOMPLETE` retry path; token rollover during long upload | INT + E2E harness | **P0** | 10–14 | FR9, FR11, FR12, NFR4, NFR13 |
| | Client-side validation (per-type caps, friendly copy); capture mode; description; task-linked upload (`task_id` validated against open task) | E2E/Component + UNIT (limits) | P1 | 5–7 | FR9–11, FR13, FR15 |
| **Auth & consent (R-002, R-014)** | Magic-link E2E via Mailpit: invite→first login; expired/used link → 410 + re-request; single-use enforcement | E2E + INT | **P0** | 4–5 | FR1–3, NFR7 |
| | Consent gating: accept-all activates + acceptance record (HMAC-chained); decline → inactive + self-service re-entry; terms version bump → re-accept on next request with `next` continuation; admin sessions skip consent gate | INT + 1 E2E | **P0** | 6–8 | FR5–8 |
| | Revocation: deactivate/withdraw/delete → global signOut → next DAL call 401/403; deactivated login → paused screen; JWT-window residual documented | INT | **P0** | 4–5 | FR4, session model |
| **Role separation (R-003)** | Ambassador session × every admin endpoint → 403; ambassador wire types never contain triage fields (type-level + serializer test); media file route access scoping (own vs others); RLS backstop spot-checks | INT | **P0** | 8–12 | NFR8 |
| **Acceptance records & audit (R-007, R-011, ASR-3/8)** | INSERT-only enforcement (UPDATE/DELETE rejected); HMAC chain verify job: intact, tampered, tombstoned-user cases; crypto-shred → chain still verifies; audit emit in-tx (rollback → no ghost event); closed registry rejects unknown types; expiry cron deletes only >6-month `audit_events`, never acceptance records | UNIT + INT | **P0** | 8–10 | FR6, FR34, FR35, NFR10 |
| **Erasure & deletion (R-004)** | `deleteAssets(mode:'delete')`: rows+storage gone, usage/export events preserved; `mode:'erasure'`: full residual sweep (renditions, replica, zips force-expired, attributions purged, send-record PII nulled, tombstone written, `erasure_records` row); delete-own scoping; bulk delete; dismiss ≠ delete (separate code paths); generated-children hook returns empty (MVP) | INT + 1 E2E (offboarding journey) | **P0** | 8–10 | FR14, FR29, FR33, NFR11 |
| **Transcoding worker (R-005, R-012)** | Fixture corpus jobs: tiled HEIC, HEVC video, mp4 faststart output, png/webp thumbs, audio/doc no-renditions; all-or-nothing failure (partial renditions deleted, status `failed`); retry endpoint; originals bit-exact untouched; max-3-receives → archived+failed; orphan-GC: <24 h kept / >24 h swept / committed never swept / weekly diff-sweep | INT (worker jobs) | **P0/P1** | 10–12 | FR22, FR23, NFR3, NFR12 |
| **Tasks & messaging (R-006, R-008, R-009, R-018)** | Task CRUD, per-recipient mark-done, `fulfilled_at` = first completion; send-suppression for every inactive state; channel isolation (SMS adapter failure → email still sends); budget state: 46elks 403 → `BUDGET_REACHED`, SMS disabled pre-send, email unaffected; Brevo quota → same envelope; webhook handlers: signature verification (unverified → 401), monotonic lattice (no `delivered` downgrade), duplicate idempotency, unknown id → 200+log; auth-mail via send-email hook creates send_record; bounce → admin-visible | INT + UNIT (lattice, adapters) | **P0/P1** | 14–18 | FR4, FR16–20, FR36, NFR14, NFR19, NFR20 |
| **Library & curation (R-010)** | Filters (ambassador/type/date/tag) + search correctness; cursor pagination shape; auto-derived type categories; triage queue predicate (`triaged_at IS NULL`, processing+ready); star/tag set `triaged_at`, bulk-tags does NOT; Z-undo; stars shared across admins, never in ambassador payloads (covered by role suite — no duplicate); processing-state UI (poll flips tile); brand-asset upload `origin: admin` | INT + E2E (triage journey) | P1 | 12–15 | FR21, FR22, FR24–28 |
| **Export (R-016)** | Naming: å/ä/ö slugs, NFC, sequence `nn` per (ambassador, date), Stockholm date boundary, extension preserved (pure fn); zip contents match selection; size estimate; status poll → ready → 302 download; 7-day expiry job | UNIT (naming) + INT + E2E (export journey) | P1 | 7–9 | FR30 |
| **Ambassador management** | Invite flow; contact data CRUD; activate/deactivate; last-login/activity; filter-by-ambassador + bulk delete (reuses deletion suite — no duplicate) | INT | P1 | 5–6 | FR31–33 |
| **Journeys (E2E umbrella)** | J1 invite→consent→task→upload→mark-done; J2 oversize reject→trim→interrupt-resume→decline→re-entry→delete-own; J3 triage→tag/star→filter→export zip; J4 offboarding erasure; each with axe-core checks | E2E | **P0** (J1, J3), P1 (J2, J4) | 4–6 specs | All journeys, NFR18 |
| **Performance (R-010, R-015, ASR-11)** | Seeded 5k-asset library: filter/search <500 ms, thumbnail route <200 ms budget; throttled-4G task-link→task-list <3 s; 2 GB transcode SLA ≤5 min (nightly, real worker); upload progress visibility | E2E perf (nightly) | P2 | 5–7 | NFR1, NFR2, NFR3, NFR5 |
| **Accessibility** | axe inside each journey spec; keyboard operability of triage queue (keystrokes = a11y feature); focus states on consent cards + dialogs | E2E (embedded) | P1/P2 | embedded + 3–4 | NFR18 |
| **Config/residency assertions** | Processor inventory check-script: Supabase region, Vercel `regions:["arn1"]`, Sentry EU DSN, bucket privacy flags, noindex header | INT (smoke) | P2 | 3–4 | NFR6, NFR9 |

**Not automated (documented):** NFR16 restore exercise (manual launch gate); iOS Safari real-device upload checklist (manual launch gate); SPF/DKIM/DMARC verification (launch checklist); NFR15 availability (no SLA); NFR17 storage cost (billing review).

**Estimated total: ~110–140 automated scenarios** (≈35–45 P0, ≈45–55 P1, ≈25–35 P2, ≈5 P3/exploratory).

### Execution Strategy

- **PR gate (<15 min target):** all Vitest unit + integration (local Supabase in CI service container) + P0/P1 Playwright specs with seeded renditions (no ffmpeg dependency) + axe checks. Selective tagging `@p0/@p1/@p2`.
- **Nightly:** full Playwright suite incl. worker-in-the-loop transcode specs (real ffmpeg container, real fixture media), interruption harness with large files, perf checks against 5k-asset seed, throttled-4G checks.
- **Weekly / pre-release:** 2 GB max-size upload + transcode SLA run, burn-in of flaky-suspect specs, full regression incl. P2/P3.
- **Launch gates (manual, tracked):** restore exercise, iOS real-device upload run, deliverability (SPF/DKIM/DMARC + real magic-link delivery), legal/HR gates from PRD.

### Resource Estimates (ranges)

| Band | Scope | Estimate |
|------|-------|----------|
| Test infrastructure (factories, auth session minting, Mailpit wiring, worker CI compose, fixture corpus, perf seed) | one-time | ~20–30 h |
| P0 scenarios | ~35–45 | ~30–45 h |
| P1 scenarios | ~45–55 | ~25–40 h |
| P2 scenarios | ~25–35 | ~10–20 h |
| P3/exploratory | ~5 | ~2–5 h |
| **Total** | | **~90–140 h**, spread across the build phases (test infra lands with the auth spine; upload harness lands with the upload pipeline — build-first subsystems get their tests first) |

### Quality Gates

- **P0 pass rate = 100%** on PR gate — no merge with a failing P0.
- **P1 pass rate ≥ 95%** on PR gate; failures triaged within the day.
- **All score ≥ 6 risks** have their mitigation suites implemented before MVP launch; R-001 (score 9) coverage is a release **BLOCK** condition.
- **Coverage target:** ≥ 80% line coverage on `src/shared` + `features/*/dal` + `worker/jobs` (the logic tiers); UI component coverage is not gated.
- **Flake policy:** any test failing intermittently is quarantined + fixed within a week; no hard waits, no conditionals, <300 lines, <1.5 min per test (test-quality DoD).
- **Gate decision rule (for later `*trace` runs):** score-9 risk uncovered → FAIL; score 6–8 uncovered → CONCERNS; else PASS.

## Step 5: Outputs Generated & Validated

- **Execution mode:** sequential (config `tea_execution_mode: auto`; all analysis already in main context — parallel workers would have required full context re-transfer with reconciliation risk).
- **Outputs written:**
  - `_bmad-output/test-artifacts/test-design-architecture.md` (concerns/blockers contract for the dev team)
  - `_bmad-output/test-artifacts/test-design-qa.md` (test execution recipe: 4 priority tables, ~125 scenarios)
  - `_bmad-output/test-artifacts/test-design/stena-content-portal-handoff.md` (BMAD `create-epics-and-stories` integration)
- **Checklist validation:** passed — risk IDs/scores consistent across all three docs (18 risks: 7 high / 10 medium / 1 low); PR/Nightly/Weekly execution model; interval-based estimates only; priority sections carry criteria only (no execution timing); no duplicate coverage across levels; playwright-utils example included (config-enabled); quality thresholds live in QA doc Exit Criteria; no browser sessions opened; all artifacts under `_bmad-output/test-artifacts/`.
- **Open assumptions carried:** NFR1 measured to task list (PRD wording sync pending); UI copy language undecided (tests assert error codes, not strings); local-vs-hosted Supabase parity mitigated by staging smoke.
- **Completed:** 2026-07-08 — system-level test design (Phase 3) for MVP scope FR1–36.
