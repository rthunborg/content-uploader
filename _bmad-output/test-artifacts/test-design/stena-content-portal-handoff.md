---
title: 'TEA Test Design → BMAD Handoff Document'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
inputDocuments:
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/test-artifacts/test-design-qa.md'
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-07-08'
projectName: 'stena-content-portal'
---

# TEA → BMAD Integration Handoff

## Purpose

This document bridges TEA's system-level test design outputs with BMAD's epic/story decomposition workflow (`create-epics-and-stories`). It provides structured integration guidance so that quality requirements, risk assessments, and test strategies flow into implementation planning.

## TEA Artifacts Inventory

| Artifact | Path | BMAD Integration Point |
| --- | --- | --- |
| Test Design (Architecture) | `_bmad-output/test-artifacts/test-design-architecture.md` | Epic quality requirements, testability blockers B-1..B-3, risk mitigation plans |
| Test Design (QA) | `_bmad-output/test-artifacts/test-design-qa.md` | Story acceptance criteria (P0/P1 scenarios), coverage plan, effort estimates |
| Risk Assessment | (embedded in both, shared IDs R-001..R-018) | Epic risk classification, story priority |
| Coverage Strategy | (embedded in QA doc) | Story test requirements |
| Progress Log | `_bmad-output/test-artifacts/test-design-progress.md` | Workflow audit trail |

## Epic-Level Integration Guidance

### Risk References

High-priority risks (score ≥6) that should appear as epic-level quality gates:

- **R-001 (9, TECH/DATA)** — upload pipeline integrity → the Upload epic is release-blocking without its interruption/atomicity suite
- **R-002 (6, SEC)** — consent/revocation gate → Auth/Consent epic
- **R-003 (6, SEC)** — praise/triage separation → Auth + Library epics
- **R-004 (6, DATA)** — complete Art. 17 erasure → Deletion/Offboarding epic
- **R-005 (6, TECH)** — transcoding robustness on real media → Media Processing epic
- **R-006 (6, OPS)** — auth email delivery visibility → Messaging epic
- **R-012 (6, DATA)** — orphan-GC safety → Media Processing/Maintenance epic

### Quality Gates

- Every epic containing a score ≥6 risk lists that risk's mitigation suite as an epic-level done criterion.
- R-001 coverage (interruption harness + commit atomicity) is a **release BLOCK** condition for MVP.
- Testability blockers must land as early stories: **B-1** (test-auth fixture + account-state seeds) in the auth spine epic; **B-2** (worker-in-CI) in the media epic; **B-3** (provider fakes + webhook simulators) in the messaging epic; invokable job handlers in the maintenance epic.
- PR-tier CI (Vitest + Playwright, <15 min) must be green from the first epic onward; nightly/weekly tiers added with the media epic.

## Story-Level Integration Guidance

### P0/P1 Test Scenarios → Story Acceptance Criteria

Critical scenarios that MUST become story acceptance criteria (full tables in QA doc):

- **Upload stories:** P0-001…P0-008 — interruption/resume, no-partial-visibility, commit verify/atomicity/idempotency, batch independence, token rollover, client-side caps
- **Auth/consent stories:** P0-009…P0-016 — auth-context × account-state matrix, revocation propagation, consent-stale continuation, decline/re-entry, admin gate exemption
- **Role-separation stories:** P0-017…P0-022 — admin-endpoint denial, triage-field-free wire types, media-URL scoping, RLS/Storage-RLS backstops
- **Deletion/offboarding stories:** P0-023…P0-028 — delete vs erasure semantics, residual sweep, tombstone/crypto-shred, dismiss≠delete
- **Maintenance stories:** P0-029…P0-031, P0-039 — GC boundaries, committed-never-swept, expiry scoped to `audit_events`
- **Messaging stories:** P0-032…P0-033, P1-035…P1-041 — send suppression, auth-mail tracking, webhook lattice/idempotency, budget-cap envelope
- **Media stories:** P1-020…P1-027 — fixture-corpus transcode, all-or-nothing renditions, bit-exact originals
- **Export stories:** P1-042…P1-048 — naming pure-function suite, zip flow

### Data-TestId Requirements

For Playwright stability (selector-resilience), stories introducing these UI surfaces should include stable `data-testid` attributes: upload manager (file input, per-file progress rows, error states), consent card stack (per-card accept, decline), triage queue (item card, star/tag/skip verbs, keyboard legend), gallery grid (tile, selection state), filter rail (per-facet controls), selection bar (export, delete, tag actions), consequence dialog (confirm/cancel), task cards (mark-done), message compose (channel toggles), export list (status, download).

## Risk-to-Story Mapping

| Risk ID | Category | P×I | Recommended Story/Epic | Test Level |
| --- | --- | --- | --- | --- |
| R-001 | TECH/DATA | 3×3=9 | Upload pipeline epic (build-first) | INT + E2E harness |
| R-002 | SEC | 2×3=6 | Auth spine epic | INT + E2E |
| R-003 | SEC | 2×3=6 | Auth spine + Library epics | INT |
| R-004 | DATA | 2×3=6 | Deletion/Offboarding epic | INT + E2E (J4) |
| R-005 | TECH | 3×2=6 | Media processing epic | INT (worker) |
| R-006 | OPS | 2×3=6 | Messaging epic | INT + E2E (Mailpit) |
| R-012 | DATA | 2×3=6 | Maintenance epic | INT |
| R-007 | DATA | 2×2=4 | Consent/compliance stories | INT + UNIT |
| R-008 | TECH | 2×2=4 | Messaging (webhooks) stories | INT + UNIT |
| R-009 | BUS | 2×2=4 | Messaging (budget) stories | INT |
| R-010 | PERF | 2×2=4 | Library epic (nightly perf) | E2E perf |
| R-014 | SEC | 2×2=4 | Auth stories | INT + E2E |
| R-015 | PERF | 2×2=4 | Media epic (weekly SLA run) | INT |
| R-016 | BUS | 2×2=4 | Export stories | UNIT |
| R-018 | BUS | 2×2=4 | Messaging stories | INT |
| R-011 | DATA | 1×3=3 | Maintenance stories | INT |
| R-017 | SEC | 1×3=3 | Webhook stories | INT |
| R-013 | OPS | 2×1=2 | Triage stories | INT |

## Recommended BMAD → TEA Workflow Sequence

1. **TEA Test Design** (`TD`) → produces this handoff document ✅ (this run)
2. **BMAD Create Epics & Stories** → consumes this handoff, embeds quality requirements and B-1..B-3 as early stories
3. **TEA ATDD** (`AT`) → generates failing acceptance tests per story (P0 scenarios first)
4. **BMAD Implementation** → developers implement with test-first guidance
5. **TEA Automate** (`TA`) → expands the full suite per the coverage plan
6. **TEA Trace** (`TR`) → validates coverage completeness and issues the gate decision

## Phase Transition Quality Gates

| From Phase | To Phase | Gate Criteria |
| --- | --- | --- |
| Test Design | Epic/Story Creation | All 7 score ≥6 risks have mitigation strategies (✅ done in this design) |
| Epic/Story Creation | ATDD | Stories carry acceptance criteria from the P0/P1 scenario tables; B-1..B-3 scheduled as early stories |
| ATDD | Implementation | Failing acceptance tests exist for all P0 scenarios of the story in play |
| Implementation | Test Automation | All acceptance tests pass; PR tier green |
| Test Automation | Release | Trace matrix ≥80% P0/P1 coverage; P0 pass rate 100%; R-001 suite complete (BLOCK condition); manual launch gates signed off (restore exercise, iOS device run, deliverability, legal/HR gates) |
