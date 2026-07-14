---
title: 'Story 1.1: Project scaffold & EU-pinned infrastructure'
type: 'feature'
created: '2026-07-13'
status: done
baseline_revision: '4cefd5735814af4e72790321ff9c6747dc1428d4'
final_revision: '6004fa9dd07884ac3a7245a858d3663a8895690e'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '/mnt/c/stena-content-portal/_bmad-output/project-context.md'
  - '/mnt/c/stena-content-portal/_bmad-output/planning-artifacts/launch-decisions.md'
warnings: [oversized]
---

<intent-contract>

## Intent

**Problem:** The repository contains approved planning artifacts but no application code, worker, deploy configuration, or reproducible environment contract. Later stories would otherwise build on an unverified, potentially non-EU foundation.

**Approach:** Materialize the mandated Supabase-enabled Next.js 16 scaffold in the existing repository, adapt it to the passwordless/private route shape, add the EU-pinned app and worker shells, and record verifiable processor and region evidence.

## Boundaries & Constraints

**Always:** Preserve existing BMAD artifacts and repository history; scaffold from `create-next-app@latest` with the `with-supabase` example and initialize shadcn CLI 4.13+ with `-b radix`; use npm and commit the lockfile; pin Next to the latest patched 16.2.x release and React/React DOM to patched 19.2.x releases; keep the App Router under `src/app` with `src/proxy.ts`; use magic-link `signInWithOtp` only; keep secrets in ignored `.env.local`; make every production processor and runtime explicitly EU-pinned; keep shared logging runtime-neutral.

**Block If:** The replacement Supabase project `utohxfcfjmhypejrawmy` cannot be authoritatively verified as `eu-north-1` before completion, or is found elsewhere; report the evidence and do not create/recreate another billable project unattended. The superseded Ireland project `lupjrbrqgacgmcbuzdsc` must not be used. Block if a required scaffold dependency cannot be obtained at a non-vulnerable compatible version.

**Never:** Overwrite planning/agent files; commit credentials or copy `.env.local` values; retain password/sign-up/reset UI or `signInWithPassword`; add Sentry or `SENTRY_DSN`; expose an application page beyond `/auth/login` and `/auth/confirm`; route media through Vercel; implement Story 1.2 schema or Story 1.3's finished design system.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Magic-link request | Valid email submitted at `/auth/login` | `signInWithOtp` requests one link with `/auth/confirm` as redirect; no password field or API is present | Return a Swedish, remedy-led safe error without provider details |
| Protected request | Unauthenticated request outside the two public auth routes | `src/proxy.ts` redirects to `/auth/login` and preserves only an allow-listed relative `next` path | Reject absolute, protocol-relative, and unknown continuations by falling back to `/` |
| Link consumption | Valid `token_hash` and supported email OTP type | `/auth/confirm` verifies the token and redirects to an allow-listed relative destination | Missing/invalid/expired values redirect to `/auth/login` with a safe error state and no provider details |
| Worker image | Docker build and container start | Node 22 worker starts in a Railway-compatible shell with ffmpeg 8.1.2 available | Build/start fails loudly when the pinned binary cannot be installed or invoked |

</intent-contract>

## Code Map

- `package.json`, `package-lock.json` -- exact runtime/dependency baseline and canonical local scripts.
- `components.json`, `src/app/globals.css` -- Radix-backed shadcn initialization and placeholder Fleet Deck semantic tokens.
- `src/app/auth/login/*`, `src/app/auth/confirm/route.ts` -- the only public scaffold surfaces and minimal passwordless flow.
- `src/lib/auth/continuation.ts` -- one relative-path allow-list for login, confirmation, and proxy redirects.
- `src/lib/supabase/{browser,server}.ts`, `src/proxy.ts` -- current `@supabase/ssr` client factories, cookie refresh, and cheap route gating.
- `src/shared/logger.ts` -- runtime-neutral structured JSON error/critical logging seam.
- `next.config.ts`, `vercel.json` -- global `noindex` headers and Stockholm function placement.
- `worker/{Dockerfile,index.ts}` -- Railway EU West deployable Node 22/ffmpeg 8.1.2 worker shell.
- `.env.example` -- credential-free MVP environment canon.
- `docs/processor-inventory.md` -- GDPR processor, purpose, region, and Sentry deferral record.
- `docs/infrastructure-verification.md` -- reproducible evidence/checklist for Supabase, Vercel, and Railway placement.

## Tasks & Acceptance

**Execution:**
- `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `next.config.ts`, `src/app/**`, `public/**` -- merge a fresh non-interactive `with-supabase` scaffold into this non-empty repo, remove template demo/password surfaces, preserve strict TypeScript, and add `dev`, `build`, `worker`, `test`, `e2e`, `db:generate`, and `db:push` script names without inventing later-story implementations.
- `components.json`, `src/app/globals.css` -- run `npx shadcn@4.13.0 init -b radix`, retain CSS-first Tailwind v4, and stage named Fleet Deck placeholders without completing Story 1.3.
- `src/app/auth/login/*`, `src/app/auth/confirm/route.ts`, `src/lib/auth/continuation.ts`, `src/lib/supabase/{browser,server}.ts`, `src/proxy.ts`, `src/app/auth/auth-flow.test.ts`, `src/lib/auth/continuation.test.ts`, `src/proxy.test.ts` -- implement and test the matrix's passwordless, token-consumption, continuation, and private-route behavior using current `@supabase/ssr` patterns (`getClaims()` in proxy; no proxy-only authorization claim).
- `src/shared/logger.ts`, `src/shared/logger.test.ts` -- emit serializable structured JSON to stdout/stderr with no Next.js, React, provider, secret, or Sentry dependency; cover Error and non-Error inputs and secret-safe output.
- `worker/Dockerfile`, `worker/index.ts`, `.dockerignore` -- create a buildable Railway service shell pinned to Node 22 and ffmpeg 8.1.2, importing only worker-local/runtime-neutral code.
- `vercel.json`, `.env.example` -- pin `regions` to `arn1`, apply global `X-Robots-Tag: noindex, nofollow`, and list the full canon: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`, `DATABASE_SESSION_URL`, `DIRECT_URL`, `ACCEPTANCE_HMAC_KEY`, `BREVO_API_KEY`, `BREVO_WEBHOOK_SECRET`, `ELKS_API_USERNAME`, `ELKS_API_PASSWORD`; omit values and Sentry.
- `docs/processor-inventory.md`, `docs/infrastructure-verification.md` -- record Supabase Stockholm, Vercel Stockholm, Railway Amsterdam, Brevo EU, and 46elks EU with purpose/legal basis; record Sentry as post-MVP only; capture commands/dashboard evidence and the Supabase region gate without credentials.

**Acceptance Criteria:**
- Given a clean checkout on Node 22, when `npm ci`, typecheck, lint, unit tests, and build run, then the scaffold succeeds from committed sources with Next 16.2.x, React 19.2.x, App Router under `src/`, and no password-auth symbol or UI.
- Given shadcn configuration is inspected, when its base and generated CSS are read, then the base is Radix and Fleet Deck semantic placeholders exist without a finished theme.
- Given any route is requested, when headers and proxy behavior are observed, then responses are globally `noindex, nofollow`, only the login/confirm surfaces are public, and unsafe `next` values never redirect off-site.
- Given infrastructure artifacts and authoritative provider evidence are inspected, when their regions are compared, then Supabase is `eu-north-1`, Vercel is `arn1`, the Railway shell targets Amsterdam, and the processor inventory contains no MVP Sentry processor.
- Given the worker image is built and run, when its versions are inspected, then Node reports major 22 and ffmpeg reports 8.1.2 before the shell starts.

## Spec Change Log

- 2026-07-14: Human resolved the infrastructure escalation by replacing the Ireland Supabase project with `utohxfcfjmhypejrawmy`. Authenticated Supabase CLI evidence reports the replacement `ACTIVE_HEALTHY` in `eu-north-1`; `.env.local` now targets it. The earlier project reference in `launch-decisions.md` is historical and superseded by this frozen resolution.
- 2026-07-14: Self-approved the default non-interactive provider-link repair for the second escalation: authenticated `vercel pull --yes --environment=development --scope enhancior` linked the local checkout to the existing `enhancior/content-uploader` project. A subsequent `npx vercel@latest build` completed successfully and produced `.vercel/output`; local Vercel metadata remains ignored.

## Review Triage Log

### 2026-07-14 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 13: (high 4, medium 8, low 1)
- defer: 0
- reject: 6: (high 0, medium 4, low 2)
- addressed_findings:
  - `[high]` `[patch]` Caught rejected magic-link provider calls and returned the existing safe Swedish recovery state.
  - `[high]` `[patch]` Caught confirmation client and OTP verification failures and redirected to safe link recovery.
  - `[high]` `[patch]` Added direct proxy verification for claims failures, authentication decisions, and refreshed-cookie propagation.
  - `[high]` `[patch]` Made structured logging non-throwing for hostile values and output failures.
  - `[medium]` `[patch]` Added direct confirmation-handler coverage for valid, invalid, missing, unsupported, and rejected OTP inputs.
  - `[medium]` `[patch]` Added direct server-action coverage for validation, origin handling, continuation safety, and provider failures.
  - `[medium]` `[patch]` Sanitized logger event names so sensitive values cannot bypass redaction.
  - `[medium]` `[patch]` Preserved safely redacted Error stack and cause details for diagnostics.
  - `[medium]` `[patch]` Routed unexpected authentication and proxy provider failures through the runtime-neutral structured logger.
  - `[medium]` `[patch]` Made malformed login origins and Supabase client creation failures return safe action state.
  - `[medium]` `[patch]` Added an authoritative verification gate for the 15-minute Supabase OTP lifetime.
  - `[medium]` `[patch]` Added authoritative evidence procedures for Brevo and 46elks EU processing placement.
  - `[low]` `[patch]` Bounded public email input length before forwarding it to Supabase.

## Design Notes

The repository is already the intended project root and contains non-scaffold files. Generate the official starter in an isolated temporary directory and merge its owned application files, or use an equivalently safe non-interactive method; never force-overwrite the working root. Current Supabase documentation prefers `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; retain `NEXT_PUBLIC_SUPABASE_ANON_KEY` only as a compatibility alias if the fetched starter still requires it, and document that exception.

The authoritative production Supabase target is project `utohxfcfjmhypejrawmy` in Stockholm (`eu-north-1`). Authenticated `supabase projects list --profile content-uploader --output json` verified that placement on 2026-07-14. Update infrastructure evidence to this reference without recording credentials. `DATABASE_URL`, `DATABASE_SESSION_URL`, and `ACCEPTANCE_HMAC_KEY` remain ordinary Story 1.1 environment-completion tasks; their absence is not a region ambiguity.

## Verification

**Commands:**
- `npm ci && npm run typecheck && npm run lint && npm test && npm run build` -- expected: all local quality gates pass.
- `rg -n "signInWithPassword|password|SENTRY|SENTRY_DSN" src package.json .env.example worker docs/processor-inventory.md` -- expected: no password-auth or MVP Sentry implementation matches (ordinary explanatory documentation may name the deferral).
- `npx shadcn@4.13.0 info` -- expected: valid Tailwind v4/Radix configuration.
- `docker build -t stena-content-worker:story-1-1 worker && docker run --rm stena-content-worker:story-1-1 --versions` -- expected: Node 22 and ffmpeg 8.1.2, exit 0.
- `npx vercel@latest build` -- expected: project configuration parses and Next.js build succeeds with `arn1` recorded in `vercel.json`.
- Provider-management read/check documented in `docs/infrastructure-verification.md` -- expected: project `utohxfcfjmhypejrawmy` reports `eu-north-1`; otherwise trigger the Block If gate.

## Auto Run Result

Status: done

Summary: Materialized the pinned Next.js 16/Supabase scaffold, passwordless private-route shell, Radix-backed shadcn baseline, runtime-neutral structured logging, Stockholm Vercel configuration, Railway-compatible Node 22/ffmpeg 8.1.2 worker image, and EU processor/placement evidence gates. Review hardening added direct authentication-boundary tests, safe provider-failure handling, non-throwing secret-safe logging, and missing provider verification procedures.

Files changed:
- `.dockerignore`, `.env.example` -- exclude local secrets/build output and define the credential-free environment canon.
- `package.json`, `package-lock.json` -- pin the runtime/toolchain, canonical scripts, and vulnerability-free dependency graph.
- `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `postcss.config.mjs`, `next-env.d.ts` -- strict TypeScript, lint, test, Tailwind, and Next.js scaffold configuration.
- `next.config.ts`, `vercel.json` -- global noindex headers and Stockholm `arn1` placement.
- `components.json`, `src/app/globals.css`, `src/components/ui/button.tsx`, `src/lib/utils.ts` -- Radix shadcn initialization and Fleet Deck placeholder tokens.
- `src/app/layout.tsx` -- Swedish root metadata and robots policy.
- `src/app/auth/**` -- passwordless login, token confirmation, safe recovery behavior, and direct boundary tests.
- `src/lib/auth/**` -- allow-listed relative continuation handling and tests.
- `src/lib/supabase/**` -- current browser/server SSR client factories and public environment validation.
- `src/proxy.ts`, `src/proxy.test.ts` -- private-route claims gate, safe failure behavior, cookie propagation, and direct tests.
- `src/shared/logger.ts`, `src/shared/logger.test.ts` -- runtime-neutral, non-throwing, secret-safe structured logging and hostile-input coverage.
- `worker/Dockerfile`, `worker/index.ts` -- Railway-compatible Node 22 and ffmpeg 8.1.2 worker shell.
- `docs/processor-inventory.md`, `docs/infrastructure-verification.md` -- EU processor inventory, placement evidence, and authoritative verification gates.
- `_bmad-output/implementation-artifacts/epic-1-context.md` -- compiled Epic 1 continuity context.

Review findings breakdown:
- Patches applied: 13 (high 4, medium 8, low 1).
- Items deferred: 0.
- Items rejected: 6 (operational or later-story expectations not required by this intent, plus one incorrect matcher claim).
- Follow-up review recommendation: true; patched severity counts high 4, medium 8, low 1; weighted medium/low score 25, and high findings independently require follow-up.

Verification performed:
- `npm ci && npm run typecheck && npm run lint && npm test && npm run build` -- passed; 6 test files and 48 tests passed, and the Next.js production build completed.
- Forbidden password/Sentry symbol scan -- passed with no matches.
- `npx shadcn@4.13.0 info` -- passed; Tailwind v4 and Radix base confirmed.
- Worker Docker build/run -- passed; Node 22 and ffmpeg 8.1.2 reported.
- `npx vercel@latest build` -- passed and produced `.vercel/output`.
- Supabase project `utohxfcfjmhypejrawmy` Stockholm placement relies on the binding authenticated evidence recorded on 2026-07-14; the current shell lacked a Supabase access token for repetition.

Residual risks: Brevo EU placement, 46elks EU processing evidence, and the 15-minute Supabase OTP setting still require the documented authoritative account checks before production launch. The repository expresses Vercel and Railway placement, while final deployed-runtime verification remains an operational launch gate.
