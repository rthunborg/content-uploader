---
title: 'Story 1.4: Magic-link authentication & the single front door'
type: 'feature'
created: '2026-07-14'
status: 'in-review'
baseline_revision: '9aa936520e8f90ce45797a2877207c06989d2335'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '/mnt/c/stena-content-portal/_bmad-output/project-context.md'
warnings: [oversized]
---

<intent-contract>

## Intent

**Problem:** The scaffold can request and consume email OTP links, but invalid links fall back into login, the required recovery page and 15-minute policy are absent, and the provider templates and browser-level single-use journey are not verified.

**Approach:** Harden the existing email-only flow around one `/auth/confirm` token-hash endpoint, configure local Supabase to issue matching 15-minute links, and add a Swedish `/auth/error` recovery surface plus tests at route, UI, and local-provider boundaries.

## Boundaries & Constraints

**Always:** Use `signInWithOtp` with account creation disabled; consume `email`, `magiclink`, and `invite` token hashes only through `/auth/confirm`; sanitize `next` through the existing relative allow-list; keep login, confirmation, and recovery public and every other app route gated; use Swedish, remedy-led copy with no provider detail; retain the `purpose` parameter as an ignored/validated future seam rather than adding another auth system.

**Block If:** Hosted Supabase settings cannot be reconciled with the repository's 15-minute link contract, or the local Supabase version cannot render token-hash templates that all converge on `/auth/confirm`.

**Never:** Add passwords, public self-signup, SSO, task-purpose deep links, a second callback endpoint, an external auth API, account-state/consent routing owned by Stories 1.5/3, or expose an email address/token/provider error in a recovery URL.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Login request | Valid existing-user email plus allowed `next` | One 15-minute email link targets `/auth/confirm`; UI confirms generically | Provider failures return safe Swedish copy and structured logging |
| Valid link | Supported type and unused `token_hash` | Session cookies are established and browser reaches sanitized `next` | Unsafe/missing `next` becomes `/` |
| Invite link | `type=invite` with valid hash | Same confirmation endpoint establishes the invited user's session | Downstream onboarding remains owned by later stories |
| Invalid link | Missing, malformed, expired, or consumed token | Browser reaches `/auth/error` with preserved safe `next` and a fresh-link remedy | Classify as `LINK_EXPIRED`/410 without exposing provider detail |
| Re-request | User follows the recovery remedy | Login form is shown for another email submission with safe `next` retained | The public response does not disclose whether an account exists |
| Reuse | A previously consumed link is opened again | No session is created; recovery surface is shown | Same safe expired-link treatment |

</intent-contract>

## Code Map

- `src/app/auth/auth-flow.ts` -- centralized Swedish copy, OTP request options, confirmation URL, and accepted email OTP types.
- `src/app/auth/login/{page.tsx,login-form.tsx,actions.ts}` -- email-only public request surface and server action.
- `src/app/auth/confirm/route.ts` -- sole token-hash verification and session-establishment front door.
- `src/lib/auth/continuation.ts` -- canonical relative continuation allow-list.
- `src/proxy.ts` -- cheap claim-based routing and public-route list.
- `supabase/config.toml`, `supabase/templates/` -- local auth TTL, signup policy, redirect/template contract.
- `e2e/` -- local Supabase/Mailpit auth journeys and accessibility coverage.

## Tasks & Acceptance

**Execution:**
- `src/app/auth/auth-flow.ts`, `src/app/auth/auth-flow.test.ts` -- centralize expired-link/recovery copy and confirmation/error URL builders; keep provider details out of public states and preserve the future `purpose` seam without changing behavior.
- `src/app/auth/confirm/route.ts`, `src/app/auth/confirm/route.test.ts` -- redirect every missing, unsupported, expired, consumed, rejected, or thrown verification case to `/auth/error` with only a sanitized `next`; verify valid `email`, `magiclink`, and `invite` hashes exactly once and preserve session cookies.
- `src/app/auth/error/page.tsx` and focused tests -- add the public Swedish expired/used-link landing with what/why/remedy semantics; its primary remedy links to `/auth/login?next=...` for a fresh email submission, so no email PII must be carried in the callback URL.
- `src/app/auth/login/{page.tsx,login-form.tsx,actions.ts}` and tests -- remove the legacy `error=link_invalid` branch, retain generic account-enumeration-safe success/failure states, and verify the rendered surface has no password control and meets the shared form/focus/target primitives.
- `src/proxy.ts`, `src/proxy.test.ts` -- make the exact `/auth/error` route public while keeping lookalike and all application routes gated.
- `supabase/config.toml`, `supabase/templates/{magic_link,invite}.html` -- set email OTP expiry to 900 seconds, disable public signup while allowing administrator invitations, and make both local templates emit token-hash links to the single confirmation endpoint using supported types and the canonical `next` parameter.
- `e2e/auth-magic-link.spec.ts`, `e2e/pages/auth-page.ts`, `e2e/fixtures/auth.ts` and runner configuration as needed -- against local Supabase/Mailpit, prove plain login and invite links establish sessions, a consumed link cannot establish a second session, expired/invalid links reach recovery, the remedy retains safe continuation, and login/error pages pass axe checks.
- `.env.example` or operational documentation only if required by the implemented provider boundary -- record hosted Supabase dashboard values that cannot be versioned (15-minute OTP, allowed redirect origins, Brevo SMTP); do not claim repository config configures production.

**Acceptance Criteria:**
- Given `/auth/login`, when an ambassador or admin submits an existing email, then the rendered public surface contains no password control, requests `signInWithOtp` without creating a user, gives an enumeration-safe Swedish response, and the emitted token-hash link expires after 15 minutes.
- Given any valid plain-login or invitation email link, when the browser opens it, then `/auth/confirm` is the only verification endpoint, establishes the Supabase cookie session, ignores no unsafe redirect input, and continues to the allow-listed relative `next` (or `/`).
- Given a missing, unsupported, expired, already-used, or provider-rejected token, when `/auth/confirm` handles it, then no session or raw error is exposed and the browser lands on public `/auth/error` with `LINK_EXPIRED` semantics and a primary Swedish remedy leading to a fresh-link request while retaining only sanitized `next`.
- Given the same valid link is opened twice in isolated browser contexts against local Supabase, when the second consumption occurs, then the first context is authenticated and the second reaches recovery without an authenticated session.
- Given anonymous requests, when exact auth entry routes are requested, then `/auth/login`, `/auth/confirm`, and `/auth/error` remain public while all other application routes and auth-route lookalikes are redirected through login with safe continuation.
- Given the auth journey suites run, when route responses, browser navigation, keyboard focus, and axe results are inspected, then invite, plain login, expiry/reuse recovery, 44 px targets, 16 px mobile email input, visible focus, Swedish copy, and global noindex are verified at their outermost surfaces.

## Spec Change Log

## Review Triage Log

### 2026-07-14 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 9: (high 0, medium 3, low 6)
- defer: 0
- reject: 12: (high 0, medium 5, low 7)
- addressed_findings:
  - `[medium]` `[patch]` Proved reused and invalid links leave their isolated browser contexts unauthenticated by challenging a gated route after recovery.
  - `[medium]` `[patch]` Added browser-level keyboard focus visibility verification for the public auth controls.
  - `[medium]` `[patch]` Measured the login submit and recovery remedy targets at the rendered surface to enforce the 44 px floor.
  - `[low]` `[patch]` Moved local auth-user and browser-context cleanup into failure-safe `finally` blocks.
  - `[low]` `[patch]` Made Mailpit polling report network and non-success responses precisely instead of timing out or failing during JSON parsing.
  - `[low]` `[patch]` Made local Supabase discovery fail fast with a clear prerequisite error.
  - `[low]` `[patch]` Rejected missing service-role configuration explicitly instead of constructing an unusable admin client.
  - `[low]` `[patch]` Selected the confirmation link by callback pathname rather than assuming the first email hyperlink is the auth link.
  - `[low]` `[patch]` Strengthened route coverage so every supported email OTP type must complete with the expected safe redirect.

## Design Notes

`LINK_EXPIRED` is the stable domain classification for invalid, expired, and already-consumed email links. The confirmation handler redirects to a friendly HTML landing; the canonical 410 mapping remains available to API/domain consumers, while the navigated document may render normally. A literal resend cannot be safe from an expired callback without carrying email PII or introducing a signed recovery credential, so “one tap” is implemented as one primary remedy into the pre-existing fresh-link form with `next` retained.

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test && npm run build` -- expected: static, focused auth, accessibility, and production gates pass.
- `npm run e2e -- --grep "magic link"` -- expected: local Supabase/Mailpit plain-login, invitation, single-use, recovery, and axe journeys pass.
- `git diff --check && rg -n "password|signInWithPassword|signUp" src/app/auth supabase/templates` -- expected: clean diff and no password/signup implementation in the auth surface.

## Auto Run Result

Status: done

Summary: Hardened the passwordless entry flow around one token-hash confirmation endpoint, added Swedish expired/used-link recovery, configured local 15-minute single-use email links and invitation templates, and verified the provider-backed journey through local Supabase and Mailpit.

Files changed:
- `src/app/auth/**` -- centralize safe auth copy/URLs, consume supported email OTP hashes, provide the recovery page, and keep login email-only.
- `src/proxy.ts` and tests -- expose only the three exact public auth entry routes while gating lookalikes and application routes.
- `src/app/globals.css` -- give the recovery remedy the shared visible-focus and 44 px interaction treatment.
- `supabase/config.toml`, `supabase/templates/*`, `supabase/auth-config.test.ts` -- lock local signup, redirect, 900-second OTP, and single-callback email-template behavior.
- `e2e/**`, `playwright.config.ts`, `vitest.config.ts` -- add isolated local-provider browser journeys, axe checks, and separate Playwright/Vitest discovery.
- `package.json`, `package-lock.json` -- add the exactly pinned axe Playwright integration and E2E command support.
- `docs/infrastructure-verification.md` -- record hosted Supabase/Brevo settings that repository config cannot apply.

Review findings breakdown: patch 9 (high 0, medium 3, low 6); defer 0; reject 12 (high 0, medium 5, low 7). Follow-up review recommendation: true; patched-severity score is `3 × 3 + 1 × 6 = 15`.

Verification performed: typecheck and lint passed; Vitest passed 132 tests with 5 environment-dependent database tests skipped; production build passed; local Supabase accepted the auth configuration/templates; Playwright magic-link suite passed 3/3 journeys including login, invitation, single-use recovery, unauthenticated failure state, keyboard/target checks, and axe; `git diff --check` passed with line-ending notices only.

Residual risk: hosted Supabase dashboard settings, redirect origins, and Brevo SMTP remain operational deployment state and are documented for environment verification; elapsed-wall-clock 15-minute expiry is configuration-tested rather than making the suite wait 15 minutes.
