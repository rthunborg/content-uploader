# CI/CD and test delivery plan

## Repository gates

The stable required GitHub check is **Quality / Quality gate**. Protect `main` and require that check before merge. The workflow starts and resets local Supabase, then runs the separately named gates in this fixed order: Typecheck, Lint, Vitest, Playwright and axe. It then builds `worker/Dockerfile` from the repository root and runs the image's version probe. Failed browser runs retain the Playwright report and traces for 14 days.

Vercel remains connected through Git integration. Configure previews for pull requests and production for `main`, require **Quality / Quality gate** for both through Vercel deployment protection, and keep the production environment protected. Confirm these provider-side settings on a real pull request; repository files cannot enforce them.

The **Release / Production release** workflow runs only after a successful `main` Quality workflow and serializes production releases. Before any production mutation it compares the tested SHA with the current remote `main` head and harmlessly ignores an obsolete queued run. It checks out the exact tested commit, links Supabase, applies all migrations, and only then uploads the Railway worker with the explicitly pinned Railway CLI version. Configure the Railway service to build `worker/Dockerfile` with the repository root as build context. Vercel then releases the same `main` commit through Git integration. A migration or worker failure fails Release; production protection must prevent Vercel promotion until Release succeeds.

## Secret contract

Store these only as GitHub Actions secrets on the protected `production` environment:

- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`
- `RAILWAY_TOKEN`, `RAILWAY_SERVICE_ID`

Railway owns worker runtime values such as `DATABASE_SESSION_URL` and `ACCEPTANCE_HMAC_KEY`; Vercel owns app runtime values. Do not put provider project identifiers or credentials in repository files.

## Test tiers and future prerequisites

No unbuilt journey has a skipped placeholder. Its feature story adds the executable spec once the listed prerequisite exists.

| Suite | Tier | Prerequisite | Evidence |
|---|---|---|---|
| onboarding-consent | PR | consent UI, terms seed, magic-link fixture | Playwright HTML report, trace on failure, axe result |
| task-upload | PR | tasks, TUS upload, commit and processing states | report, trace, axe result, uploaded fixture details |
| triage | PR | admin triage queue and role fixture | report, trace, axe result |
| library-export | PR | library filters, export job and download | report, trace, axe result, exported archive assertion |
| offboarding | PR | account deactivation and erasure path | report, trace, axe result, durable erasure assertion |
| throttled-4G notification-to-task | Nightly | messaging link and task list; browser network throttling | timing record proving interactive task list under 3 seconds |
| upload interruption torture | Weekly/manual pre-release | resumable TUS upload and physical supported devices | checklist evidence described below |
| keyboard-only pass | Manual pre-release | complete release candidate journeys | browser/device, tester, date, findings |
| screen-reader pass | Manual pre-release | complete release candidate journeys | AT/browser/device, tester, date, findings |

The current `auth-magic-link` Playwright spec and its axe scan remain the only executable browser coverage until those feature prerequisites land.
