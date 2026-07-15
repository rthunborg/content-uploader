---
title: '1.7 CI/CD pipeline & error-logging seam'
type: 'chore'
created: '2026-07-14T00:00:00+02:00'
status: 'done'
baseline_revision: 91e8e2710f4d8dc43a7ea6463f28074aa87a4d2e
final_revision: 3d40bf0b0288b1e19a3cb00d9854a6b570a271b4
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: []
---

<intent-contract>

## Intent

**Problem:** Pull requests and main-branch releases are not gated by repository CI, the app and worker do not both initialize the shared logger, and the later journey/accessibility/hard-case test obligations are not recorded as an executable delivery plan.

**Approach:** Add ordered GitHub Actions quality and deployment workflows, make the existing runtime-neutral logger an initialized and replaceable stdout transport used by both runtimes, and codify the named future E2E/manual suites without pretending unbuilt feature journeys already execute.

## Boundaries & Constraints

**Always:** PR CI starts local Supabase and runs typecheck, lint, Vitest, then Playwright/axe in that order. Main deployment runs only after quality succeeds and applies migrations before deploying the Railway worker; Vercel remains git-integrated and is gated through documented required-check/deployment-protection configuration. App and worker initialize one shared structured-JSON stdout seam. Test-plan documentation assigns every named journey and hard case to a clear tier and prerequisite.

**Block If:** A deploy command cannot be made non-interactive using documented repository secrets, or the worker cannot consume `src/shared/logger.ts` while preserving the worker import boundary and a buildable Docker image.

**Never:** Add Sentry packages/configuration, `instrumentation-client.ts`, or `SENTRY_DSN`; log domain errors as incidents; commit provider credentials or project identifiers; fabricate passing/skip-only E2E specs for features not implemented; route worker code through app-only modules; deploy the database or worker from untrusted pull-request code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Pull request | Clean checkout | Local Supabase boots; gates run typecheck → lint → Vitest → Playwright/axe | Failure stops later gates and retains Playwright diagnostics |
| Main release | Quality workflow succeeded on `main` | Production migrations apply before `railway up`; Vercel release proceeds through git integration | Concurrency prevents overlapping releases; either deploy failure fails the release |
| App/worker incident | Unexpected error or critical alert | One redacted JSON object is written to stdout through the shared transport | Logger serialization/transport failure never masks the original application path |
| Future transport | Post-MVP transport is installed at initialization | Existing `logError`/`logCritical` call sites remain unchanged | Invalid/repeated initialization remains deterministic and test-covered |

</intent-contract>

## Code Map

- `.github/workflows/ci.yml` -- ordered PR quality gate with local Supabase and Playwright artifacts.
- `.github/workflows/deploy.yml` -- trusted main-only migrations-before-worker release.
- `src/shared/logger.ts` -- runtime-neutral structured logger and replaceable stdout transport seam.
- `src/instrumentation.ts` -- Next server initialization point.
- `worker/index.ts`, `worker/lib/logger.ts`, `worker/Dockerfile` -- Railway runtime initialization and deployable shared-code packaging.
- `eslint.config.mjs`, `eslint-boundaries.test.ts` -- single unexpected-error call-site and worker-boundary enforcement.
- `docs/ci-cd.md` -- required GitHub/Vercel settings, secret contract, release ordering, and test tiers.
- `docs/pre-release-test-checklist.md` -- keyboard, screen-reader, and physical-device interruption passes.
- `README.md` -- accurate MVP platform-logging posture.

## Tasks & Acceptance

**Execution:**
- `.github/workflows/ci.yml` -- add a least-privilege Node 22 PR/push quality job that starts/resets local Supabase, installs Chromium dependencies, executes the four gates as separately named ordered steps, uploads failed Playwright reports/traces, and always stops the stack.
- `.github/workflows/deploy.yml` -- add a concurrency-guarded `main` release dependent on successful quality checks; link/push Supabase non-interactively, then deploy `worker/Dockerfile` using Railway CLI and repository secrets.
- `src/shared/logger.ts`, `src/shared/logger.test.ts` -- expose deterministic initialization/transport replacement while preserving redaction, JSON serialization, and no-throw behavior; default and MVP initialization must write one JSON line to stdout.
- `src/instrumentation.ts` and co-located test -- initialize the shared logger from Next's server-only `register()` hook without client instrumentation.
- `worker/lib/logger.ts`, `worker/index.ts`, worker tests, `worker/Dockerfile`, and `package.json` -- initialize/use the same seam for worker failures and critical alerts, bundle the worker plus allowed shared imports into a Node 22 image, and prove image startup/version behavior remains valid.
- `eslint.config.mjs`, `eslint-boundaries.test.ts` -- prevent direct unexpected-error console capture outside the shared logger while retaining permitted informational output and existing import rules.
- `docs/ci-cd.md` -- document stable required check names, Vercel preview/production deployment protection, required secret names, migration→worker→git-integrated-app semantics, PR/nightly/weekly tiers, and prerequisites for onboarding-consent, task-upload, triage, library-export, offboarding, throttled-4G, and upload-interruption suites.
- `docs/pre-release-test-checklist.md` -- document keyboard-only and screen-reader spot checks plus real-device airplane-mode/app-switch/lock-screen upload torture procedure and evidence capture.
- `README.md` -- describe MVP EU platform logs and explicit post-MVP Sentry deferral.

**Acceptance Criteria:**
- Given a pull request, when the quality workflow runs, then its stable required check starts local Supabase and executes typecheck, lint, Vitest, and Playwright with in-spec axe coverage sequentially, with failure diagnostics retained.
- Given a successful quality run on `main`, when deployment begins, then production migrations complete before Railway deploys the worker, overlapping deploys are serialized, and documentation identifies the external GitHub/Vercel settings that gate git-integrated previews and releases.
- Given the current pre-feature codebase, when the test plan is inspected, then all five named journeys, throttled-4G run, interruption torture run, keyboard pass, and screen-reader pass have explicit tiers, prerequisites, and evidence expectations without fake executable coverage.
- Given either runtime starts, when it captures an unexpected failure through `logError` or `logCritical`, then the initialized shared seam emits redacted structured JSON to stdout and no app/worker call site depends on a future transport implementation.
- Given an MVP dependency/configuration scan, when Sentry identifiers are searched, then no Sentry package, DSN, client instrumentation, or runtime wiring exists and documentation labels it post-MVP only.

## Spec Change Log

## Review Triage Log

### 2026-07-14 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 8: (high 1, medium 7, low 0)
- defer: 1: (high 0, medium 1, low 0)
- reject: 9: (high 0, medium 3, low 6)
- addressed_findings:
  - `[medium]` `[patch]` Added a CI worker-image build and `--versions` smoke so broken Docker COPY, entrypoint, or shared-module paths cannot pass the required gate.
  - `[medium]` `[patch]` Moved both worker entry modes behind the startup failure boundary and added entry-point tests proving one critical event plus unsuccessful propagation.
  - `[high]` `[patch]` Added a remote-main SHA freshness guard before production mutation so an obsolete queued quality run cannot roll the worker/database backward.
  - `[medium]` `[patch]` Added a production job timeout so a hung provider command cannot indefinitely block the serialized release queue.
  - `[medium]` `[patch]` Pinned the Railway CLI invoked by production releases to an explicit version.
  - `[medium]` `[patch]` Extended logger redaction to opaque sensitive URL query values used by signed links and provider credentials.
  - `[medium]` `[patch]` Routed transport-failure fallback through the known-safe stdout sink instead of retrying the failed custom transport.
  - `[medium]` `[patch]` Strengthened direct `console.error` enforcement to cover computed property access while preserving informational output and test exemptions.

### 2026-07-15 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 3, low 0)
- defer: 0
- reject: 18: (high 0, medium 7, low 11)
- addressed_findings:
  - `[medium]` `[patch]` Extended URL/query redaction to opaque `refresh_token`/`id_token`/`session*` tokens, provider `sig`/`key` params, and single-credential URL userinfo (`scheme://token@host`), and anchored the first query parameter — closing opaque-credential leak paths the prior `SENSITIVE_QUERY_VALUE`/`SECRET_VALUE` patterns missed.
  - `[medium]` `[patch]` Hardened the production-release freshness guard so an unresolved/empty remote `main` SHA (transient `git ls-remote` failure) now fails the job loudly via `set -euo pipefail` and an empty check, instead of silently marking the run stale and reporting a green no-op release.
  - `[medium]` `[patch]` Added executable coverage for the worker normal-startup path (`worker.ready` emission + `keepAlive`) and the `--versions` short-circuit, which previously had only failure-path tests, so a readiness/liveness regression cannot ship undetected.
- rejected/out-of-scope highlights (no action):
  - Vercel app deploys not sequenced behind the migration/worker release, and provider deployment-protection/required-check gating — the intent explicitly scopes Vercel to git integration gated by *external documented* configuration (Design Notes + Residual risks already cover this; repository files cannot enforce provider state).
  - `deploy.yml` verified only by string-contract tests and not executed pre-production — intrinsic to provider commands that need credentials; already recorded as a residual risk.
  - No `next build` gate / dev-mode Playwright / stdout-vs-stderr / floating `node:22` base tag / `railway up --detach` / migrations-without-rollback — either the intent fixes the exact gate set and stdout stream, or the concern is delegated to provider build/health state; not defects introduced by this change.
  - `console.log`/`console.warn` still bypass the error-console lint guard — `console.log` is the logger's own transport, so a blanket ban is infeasible; the guard targets the `console.error` footgun by design.

### 2026-07-15 — Review pass (second follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 1, low 1)
- defer: 0
- reject: 22: (high 0, medium 9, low 13)
- addressed_findings:
  - `[medium]` `[patch]` Extended `SENSITIVE_QUERY_VALUE` to anchor on `#` so opaque credentials carried in a URL *fragment* (e.g. Supabase implicit-flow `#refresh_token=<opaque>`, which is not a JWT and so escaped `SECRET_VALUE`) are redacted — closing the fragment-symmetric hole left by the two prior query-value redaction passes; added a fragment-redaction test.
  - `[low]` `[patch]` Added the new root-level `ci-workflows.test.ts` to the `npm run lint` file enumeration; it was excluded while its sibling `eslint-boundaries.test.ts` was linted, so the workflow-contract test previously escaped lint coverage.
- rejected/out-of-scope highlights (no action):
  - No `next build` gate, no PR-run concurrency control, `railway up --detach` not awaiting worker health, migrations without rollback, unpinned `node:22`/no-`node_modules` Docker image — either the intent fixes the exact gate set or the concern is delegated to provider build/health state; all restate findings the prior two passes already rejected.
  - Vercel app deploy not sequenced behind the migration/worker release and provider gating not repo-enforced — intent explicitly scopes Vercel to git integration gated by *external documented* configuration; already a recorded residual risk.
  - `console.log`/`warn`/`info` bypass the `console.error` lint guard; denylist-based query redaction is inherently incomplete (`code=`/`state=` param names, `key=` over-redaction); `initializeLogger()` is an MVP no-op; serialization/transport-failure fallback drops diagnostic detail — all by-design per the intent (informational output is permitted, the seam is a replaceable post-MVP transport, and logging must never throw or mask the app path).
  - Freshness-guard TOCTOU/non-SHA-value handling, worker entry-point path-normalization and `--versions` probe labelling, secrets passed via `--password` — safe failure modes (skip/no-op), theoretical for the direct Dockerfile entrypoint, or the safer non-interactive choice for an unattended pipeline; not defects introduced by this change.

## Design Notes

Keep repository workflows provider-neutral at call sites: secrets carry Supabase and Railway linkage, while Vercel stays under git integration. The repo can define stable checks and deployment workflow behavior; required-check and Vercel deployment-protection toggles are external controls and must be documented and verified on a real PR rather than represented as code-complete provider state.

The later journey files should land with their feature stories. This story establishes their authoritative tier/prerequisite matrix; a skipped placeholder would make the gate look more complete than its observable coverage.

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test` -- expected: logger/init/boundary tests and all existing suites pass.
- `npx supabase start && npm run e2e` -- expected: current Playwright/axe suite passes against local Supabase; stop the stack afterward.
- `docker build -f worker/Dockerfile -t stena-worker .` and worker version/startup smoke -- expected: shared logger is packaged and the Node 22/ffmpeg image starts successfully.
- `git diff --check` -- expected: no whitespace errors.
- `rg -n 'SENTRY_DSN|@sentry|instrumentation-client' --glob '!node_modules/**' --glob '!_bmad-output/**' .` -- expected: no MVP runtime/dependency/configuration matches.

**Manual checks:**
- Open a real pull request and confirm the documented stable check gates the Vercel preview; run a protected non-production release to confirm migration-before-worker ordering and provider log capture.

## Auto Run Result

### 2026-07-14 — Initial run

Status: done

Summary: Added an ordered GitHub Actions quality gate and protected main-release workflow, initialized one replaceable structured-JSON stdout logger in Next and the Railway worker, made the worker image CI-buildable/smoke-tested, and documented provider controls plus future automated/manual test tiers. Review hardening prevents obsolete queued releases, pins the production Railway CLI, closes direct-console and sensitive-query logging gaps, and proves every I/O matrix row with executed tests.

Files changed:
- `.github/workflows/ci.yml` — local-Supabase PR/main quality gate with ordered checks, Playwright diagnostics, worker image build, and version smoke.
- `.github/workflows/deploy.yml` — successful-main release with concurrency, timeout, stale-SHA guard, migrations-before-worker ordering, and pinned Railway CLI.
- `ci-workflows.test.ts` — executable workflow contract and ordering/guard coverage.
- `src/shared/logger.ts`, `src/shared/logger.test.ts` — initialized transport seam, stdout fallback, structured redaction including signed-query credentials, and no-throw/replacement tests.
- `src/instrumentation.ts`, `src/instrumentation.test.ts` — Next Node-runtime logger initialization.
- `worker/lib/logger.ts`, `worker/lib/logger.test.ts` — worker adapter over the shared seam.
- `worker/index.ts`, `worker/index.test.ts` — structured startup failure capture and both entry-mode tests.
- `worker/Dockerfile`, `tsconfig.json` — Node 22 image packaging for allowed shared TypeScript imports.
- `eslint.config.mjs`, `eslint-boundaries.test.ts` — enforced shared-seam routing for direct error-console access.
- `docs/ci-cd.md` — provider protection, secrets, release ordering, CLI pin, and future test-tier contract.
- `docs/pre-release-test-checklist.md` — keyboard, screen-reader, and physical-device interruption procedures.
- `README.md` — current CI posture and explicit post-MVP Sentry deferral.
- `_bmad-output/implementation-artifacts/deferred-work.md` — recorded the pre-existing provider-error diagnostic-field limitation.

Review findings: 8 patches applied (high 1, medium 7, low 0); 1 medium item deferred; 9 items rejected. Follow-up review recommendation: true — a high-severity stale-release patch was applied; the medium/low weighted score is `3 × 7 + 1 × 0 = 21`.

Verification performed:
- `npm run typecheck` — passed after regenerating disposable Next route types corrupted by an interrupted Playwright dev server.
- `npm run lint` — passed.
- `npm test` — passed: 45 files passed, 1 environment-gated file skipped; 220 tests passed, 5 skipped. All four matrix rows have executed coverage.
- `npm run e2e` against local Supabase — passed on retry: 5 Chromium journeys including axe coverage; the first run hit a transient local `AuthRetryableFetchError` during admin creation.
- `docker build -f worker/Dockerfile -t stena-worker-review .` and `docker run --rm stena-worker-review --versions` — passed with Node 22.23.1 and ffmpeg 8.1.2.
- `git diff --check` — passed; only DrvFS line-ending warnings.
- Sentry identifier scan outside dependencies/artifacts — no MVP runtime, dependency, DSN, or client-instrumentation matches.

Residual risks:
- GitHub branch/environment protection, Vercel required deployment checks, production secrets, Railway service/build-path configuration, and real platform-log capture are external provider state and require the documented real-PR/non-production-release validation.
- The production migration/Railway commands were not exercised without provider credentials; workflow contract tests verify their repository-visible trust, freshness, failure, and ordering semantics.
- Provider-specific enumerable fields on `Error` objects remain omitted from the logger pending focused safe/redacted serialization work recorded in the deferred ledger.

### 2026-07-15 — Follow-up review pass

Status: done

Summary: A fresh four-layer adversarial/edge-case/verification-gap/intent-alignment review of the story-1-7 diff. Triage: 3 medium patches applied, 0 deferred, 18 rejected (0 high). The patches close opaque-credential leak paths in logger redaction, make the production-release freshness guard fail loudly instead of silently no-op'ing, and add executable coverage for the worker normal-startup path. The bulk of CI/CD findings were rejected as intent-scoped external provider state (Vercel gating, provider command execution) already documented as residual risks, or as deliberate design choices fixed by the intent (gate set, stdout stream).

Files changed this pass:
- `src/shared/logger.ts` — extended `SECRET_VALUE` to single-credential URL userinfo and `SENSITIVE_QUERY_VALUE` to opaque refresh/id/session tokens, `sig`/`key`/provider-signature params, and leading-parameter anchoring.
- `src/shared/logger.test.ts` — added redaction tests for opaque refresh/id/session/`sig` query values and single-userinfo/leading-parameter cases.
- `.github/workflows/deploy.yml` — freshness guard now uses `set -euo pipefail` and fails on an unresolved remote `main` SHA rather than silently skipping the release.
- `worker/index.test.ts` — added normal-startup (`worker.ready` + `keepAlive`) and `--versions` short-circuit tests.

Review findings breakdown: 3 patches applied (high 0, medium 3, low 0); 0 deferred; 18 rejected (high 0, medium 7, low 11). Follow-up review recommendation: true — no high-severity patch, but the medium/low weighted score is `3 × 3 + 1 × 0 = 9`, which is ≥ 5.

Verification performed:
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — passed: 45 files passed, 1 skipped; 224 tests passed (up from 220 with the 4 new tests), 5 skipped.
- Sentry identifier scan (`grep`, excluding `node_modules`/`_bmad-output`/`.next`) — no matches.
- `git diff --check` — clean; only DrvFS CRLF warnings.
- `npx supabase start && npm run e2e` and `docker build`/`--versions` smoke were not re-run: the patches touch only the unit-tested logger redaction, a contract-tested `deploy.yml` shell guard (not executable without provider credentials), and worker test additions — none of which affect the e2e or Docker-packaging runtime paths.

Residual artifacts (left uncommitted, not part of this change): `_bmad-output/implementation-artifacts/sprint-status.yaml` (orchestrator-owned; modified before this run).

### 2026-07-15 — Second follow-up review pass

Status: done

Summary: A fresh four-layer adversarial/edge-case/verification-gap/intent-alignment review of the full story-1-7 diff. Triage: 2 patches applied (1 medium, 1 low), 0 deferred, 22 rejected (0 high). The medium patch closes a fragment-symmetric hole in the logger redaction seam (opaque credentials in a URL `#fragment`, e.g. Supabase implicit-flow `refresh_token`, previously escaped both `SENSITIVE_QUERY_VALUE` and `SECRET_VALUE`). The low patch restores lint coverage to the new `ci-workflows.test.ts`. The verification-gap layer found no gaps; the intent-alignment layer confirmed the diff faithfully implements the artifact/declarative reading appropriate to CI-as-config and prescribed no new work. The rejected bulk restates prior-pass dispositions: intent-scoped external provider state (Vercel gating, provider command execution/health), the intent-fixed gate set, by-design `console.log` transport and no-op MVP initializer, and safe/theoretical edge cases.

Files changed this pass:
- `src/shared/logger.ts` — added `#` to the `SENSITIVE_QUERY_VALUE` leading-separator class so fragment-carried opaque credentials are redacted.
- `src/shared/logger.test.ts` — added a URL-fragment redaction test (opaque `refresh_token`/`access_token`/`sig` in `#…`, benign `session_state`/`page` preserved).
- `package.json` — added `ci-workflows.test.ts` to the `lint` script's file enumeration.

Review findings breakdown: 2 patches applied (high 0, medium 1, low 1); 0 deferred; 22 rejected (high 0, medium 9, low 13). Follow-up review recommendation: false — no high-severity patch, and the medium/low weighted score is `3 × 1 + 1 × 1 = 4`, which is below 5.

Verification performed:
- `npm run typecheck` — passed.
- `npm run lint` — passed, now including `ci-workflows.test.ts`.
- `npm test` — passed: 45 files passed, 1 skipped; 225 tests passed (up from 224 with the new fragment test), 5 skipped.
- `npx supabase start && npm run e2e` and `docker build`/`--versions` smoke were not re-run: the patches touch only the unit-tested logger redaction regex and the `package.json` lint enumeration — neither affects the e2e or Docker-packaging runtime paths.

Residual risks: unchanged from the prior passes — GitHub/Vercel provider protection state, production secrets, Railway service/build-path configuration, real platform-log capture, and unexercised production migration/Railway commands remain external provider state requiring the documented real-PR/non-production-release validation.

Residual artifacts (left uncommitted, not part of this change): `_bmad-output/implementation-artifacts/sprint-status.yaml` (orchestrator-owned; modified before this run).
