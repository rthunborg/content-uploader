# Stena Content Portal

Internal, mobile-first web platform that turns 10–20 employee ambassadors into a steady, consented source of authentic media content, and gives Stena's HR/marketing admins one fast library to request, organize, and publish from.

- **Ambassadors** (phone-first): magic-link login, plain-language consent, camera-roll batch upload in a 90-second moment.
- **Admins** (desktop-first): inbox-style triage queue, one shared library with tags-as-folders, zip export with human-readable filenames — "need content" to publish-ready in under 10 minutes.

Ships in two releases: an **MVP** (request → upload → organize → export loop) and a fast-follow **v1.1** (AI generation with provenance, LinkedIn sharing, campaigns, leaderboard, stats).

## Status

Platform-foundation implementation is in progress. Pull requests are gated by repository CI and production migrations/worker delivery run through the protected release workflow documented in [`docs/ci-cd.md`](docs/ci-cd.md).

## Planning artifacts

All planning documents live in [`_bmad-output/planning-artifacts/`](_bmad-output/planning-artifacts/):

| Document | Purpose |
|----------|---------|
| `prd.md` | Product Requirements — 48 FRs, 20 NFRs, 5 user journeys |
| `architecture.md` | Solution architecture — stack, data model, decisions (AR1–AR57) |
| `ux-design-specification.md` | UX spec — Fleet Deck design system, flows, components |
| `epics.md` | 9 epics / 51 stories with BDD acceptance criteria |
| `consent-cards.md` | Verbatim consent text (Swedish production + English reference) |
| `offboarding-erasure-runbook.md` | HR GDPR offboarding & erasure process |
| `launch-decisions.md` | **Authoritative record of resolved launch-gate decisions** |
| `implementation-readiness-report-2026-07-08.md` | Readiness assessment (READY for MVP) |

## Key decisions (see `launch-decisions.md`)

- **Stack:** Next.js 16 + Supabase (Postgres/Auth/Storage TUS/pgmq, Stockholm) + Vercel (arn1) + Railway worker (Amsterdam, ffmpeg). All data in EU regions.
- **UI language:** **Swedish** for all user-facing copy.
- **Typography:** Inter (SIL OFL), self-hosted.
- **GDPR:** consent-as-comprehension, tamper-evident acceptance records, documented erasure runbook, EU-only data residency.

## Tech stack (planned)

TypeScript (strict) · Next.js 16 App Router · React 19 · Drizzle ORM · Zod v4 · TanStack Query · Tailwind v4 + shadcn/Radix · Uppy 5 (TUS uploads) · Vitest + Playwright + axe-core.

## MVP logging

Unexpected app and worker failures use one redacting structured-JSON seam and write to Vercel/Railway platform stdout logs in the configured EU regions. Domain errors remain product states and are not incident logs. Sentry is explicitly deferred until after MVP; the MVP has no Sentry dependency, DSN, client instrumentation, or runtime wiring.
