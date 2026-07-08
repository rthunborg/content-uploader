# Stena Content Portal

Internal, mobile-first web platform that turns 10–20 employee ambassadors into a steady, consented source of authentic media content, and gives Stena's HR/marketing admins one fast library to request, organize, and publish from.

- **Ambassadors** (phone-first): magic-link login, plain-language consent, camera-roll batch upload in a 90-second moment.
- **Admins** (desktop-first): inbox-style triage queue, one shared library with tags-as-folders, zip export with human-readable filenames — "need content" to publish-ready in under 10 minutes.

Ships in two releases: an **MVP** (request → upload → organize → export loop) and a fast-follow **v1.1** (AI generation with provenance, LinkedIn sharing, campaigns, leaderboard, stats).

## Status

Planning complete and **implementation-ready**. Application code has not been scaffolded yet — the first development step is Epic 1, Story 1.1 (scaffold from the `with-supabase` Next.js starter, EU-pinned infrastructure).

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

- **Stack:** Next.js 16 + Supabase (Postgres/Auth/Storage TUS/pgmq, Stockholm) + Vercel (arn1) + Railway worker (Amsterdam, ffmpeg) + Sentry EU. All data in EU regions.
- **UI language:** **Swedish** for all user-facing copy.
- **Typography:** Inter (SIL OFL), self-hosted.
- **GDPR:** consent-as-comprehension, tamper-evident acceptance records, documented erasure runbook, EU-only data residency.

## Tech stack (planned)

TypeScript (strict) · Next.js 16 App Router · React 19 · Drizzle ORM · Zod v4 · TanStack Query · Tailwind v4 + shadcn/Radix · Uppy 5 (TUS uploads) · Vitest + Playwright + axe-core.
