---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-07-07'
updatedAt: '2026-07-15'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/consent-cards.md
  - _bmad-output/planning-artifacts/offboarding-erasure-runbook.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-10.md
workflowType: 'architecture'
project_name: 'stena-content-portal'
user_name: 'Rasmus'
date: '2026-07-07'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

_Updated 2026-07-12 to incorporate the approved Sprint Change Proposal — Themes and Campaign Seams. The amendment and validation decisions in this document govern over superseded tag/folder and campaign-seam language._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

48 FRs — 36 MVP (FR1–36), 11 v1.1 (FR37–44, FR46–48), and 1 v2 (FR45) — decomposing into 12 capability areas: Identity & Auth (4), Consent & Account Lifecycle (5), Upload & Ingestion (7), Media Processing (2), Tasks & Messaging (6), Library & Curation (6), Deletion/Export/Offboarding (3), Ambassador Administration (2), Audit & Governance (2), AI Generation & Provenance (5, v1.1), Usage & Social (3, v1.1), Campaign Calendar (1, v2).

Roughly half of MVP FRs are plain CRUD. Complexity concentrates in ~10 FRs:

- **FR12 — resumable, interruption-safe chunked upload** (the PRD's named make-or-break subsystem): staging-then-atomic-commit so no partial upload is ever library-visible (NFR13), lossless pause/resume under iOS Safari's no-background-transfer constraint, per-file independence in batches, client + server validation of per-type caps.
- **FR23 — async transcoding pipeline**: queue + workers, HEIC/HEVC conversion, renditions as separate objects from bit-exact originals (NFR12), per-asset processing-state machine consumed by every UI surface.
- **FR8 — server-side re-accept gate + session revocation**: consent currency checked on every authenticated request with destination continuation; effectively rules out pure stateless long-lived JWTs.
- **FR6/NFR10 — tamper-evident, append-only acceptance records** with retention distinct from (and exempt from) the 6-month audit expiry.
- **FR19/FR20 + NFR14/NFR20 — multi-channel notification fan-out** with per-recipient delivery tracking, send-suppression for inactive accounts (FR4), and channel isolation.
- **FR30 — async multi-GB zip export** streaming originals, with size estimate, progress, and durable itemized export records (the FR43 v1.1 check-off seam).
- **FR29/FR33 + NFR11 — complete-erasure orchestration**: one authoritative delete path shared by all three delete surfaces (delete-own, admin delete, offboarding bulk), fanning out across originals, renditions, and derived data.
- **FR34/FR35 — immutable audit event store** with 6-month auto-expiry job; day-one taxonomy already includes v1.1-only event types (shares, used-confirmations).

**Post-MVP requirements demanding MVP design-now provisioning:** the three-value `origin` enum incl. `generated` (FR38); asset identity tolerating version chains and provenance edges (FR39/FR40); a **durable usage/export event store separate from the expiring audit log** (FR41/43/44/47/48 vs FR35 — the sharpest hidden data-model requirement, with deletion-mode-dependent cascade semantics: ordinary deletion preserves historical counters, erasure purges attributions); a dependency-check hook in the delete flow for family-tree warnings (FR40); purpose-scoped magic-link tokens so FR46 deep links become a new purpose value, not a second auth system; and dormant `campaigns`/`asset_campaigns` tables for the v2 Campaign Calendar (FR45). Campaign linkage exists only through `asset_campaigns` — never on tasks or usage/event rows.

**Non-Functional Requirements:**

The 20 NFRs cluster onto four load-bearing subsystems; NFR5, NFR15, and NFR18 mostly grant permission to keep things simple.

1. **Upload pipeline** (NFR1, 4, 12, 13): resumable chunked protocol (tus/S3-multipart class, PRD-named), direct-to-storage so 2 GB never streams through the app tier, staged atomic commit with orphan garbage collection, checksum verification doubling as the commit gate.
2. **Media pipeline** (NFR2, 3, 17): renditions pre-generated at upload time — never on demand; thumbnails < 200 ms in-viewport, video playback < 2 s (faststart MP4 + posters suffice), 5-minute rendition SLA for a max-size video; EU object storage with an immutable-originals zone and a regenerable-renditions zone, low-TB growth without re-architecture, storage cost surfaced as a stakeholder line item.
3. **Compliance spine** (NFR6, 9, 10, 11, 16 — interlocking and partially conflicting): TLS + at-rest encryption on all tiers; EU residency as a selection gate on every processor; tamper-evident acceptance records (mechanism is a named architecture decision — proportionate options range from INSERT-only privileges to hash chaining; legitimate Art. 17 erasure must be distinguishable from tampering via tombstones or crypto-shredding); complete erasure demands an asset-centric data map enumerating every copy a file spawns; backups (RPO ≤ 24 h / RTO ≤ 1 business day, tested restore) collide with 30-day complete erasure — an explicit position is required (bounded backup retention is the simplest resolution), and restore-after-erasure resurrection must be addressed in the restore runbook.
4. **Messaging layer** (NFR14, 19, 20): per-recipient-per-channel delivery records fed by provider status events; delivery failures as first-class admin-visible states (an undelivered magic link = a user who can never log in); persisted binary budget state (OK/reached from last provider response) checked pre-send; channel isolation so SMS failure never blocks email — independent per-channel dispatch with bounded timeouts satisfies this (an outbox/queue is an option, not a mandate).

**Session model (UX handoff, hard requirements):** long-lived sessions + immediate all-device revocation on deactivation/deletion/consent-withdrawal + server-side re-accept enforcement = server-side session state checked per request. Auth middleware becomes the single choke point for identity, consent currency, and account status.

**Scale & Complexity:**

- Primary domain: full-stack responsive web application (one app, two optimized surfaces: phone-first ambassador, desktop-first admin) with a heavy media-handling backend
- Complexity level: **medium** — confirmed against the PRD's own classification; complexity is concentrated, not pervasive
- Estimated architectural components: ~12–14 server-side (upload service, transcoding workers, token service, session store, consent gate (in the DAL), acceptance-record store, audit store + expiry job, usage/export event store, messaging dispatch + delivery tracking, library query layer, triage queue state, zip export builder, deletion orchestrator, account state machine) + 5 signature UI components (UploadManager, TriageQueue, GalleryGrid, MediaPreview, ConsentCardStack)
- Scale reality check: 10–20 ambassadors + a small admin team, thousands of assets over years, hundreds of GB → low TB. Nothing justifies microservices, search engines, custom queue infrastructure, or multi-region anything.

### Technical Constraints & Dependencies

- **EU data residency (NFR9)** filters every provider slot before any other criterion: hosting, DB, object storage, transcoding, email, SMS, backups, logging/monitoring (logs carry actor names), and the v1.1 AI provider. Each provider is a GDPR processor requiring a DPA — the architecture should carry a processor inventory.
- **No soft delete for personal data or content** — permanent deletes with audit trail as accountability; dismiss (queue membership) and delete must never share code paths; architecture must not quietly reintroduce soft delete "for safety" (a soft-deleted personal/content row is lingering personal data). `themes.archived_at` and `campaigns.archived_at` are explicit lifecycle-status flags on non-personal organization records, not delete mechanisms; hard delete remains a separate operation.
- **Two roles only**, admin workspace shared/team-wide; enforcement is server-side (NFR8).
- **Auth floor:** magic-link only, no passwords, no SSO in MVP — but SSO is post-MVP Vision item 16, so the auth boundary should be swap-friendly (link consumption produces a session; SSO would later produce the same session).
- **Media constraints:** per-type caps (images ≤ 50 MB, video ≤ 2 GB/~5 min, audio/docs ≤ 200 MB) validated client-side before transfer and re-validated server-side; originals preserved bit-exact; HEIC/HEVC conversion in the transcoding step only. The "~5 min" video cap is approximate — pin down whether duration is enforced or advisory.
- **FR9 batches are unbounded in aggregate** (bounded only per-file): staging capacity, progress bookkeeping, orphan-GC, and transcoding-queue absorption must tolerate e.g. a dozen 2 GB videos in one session; clarify whether the NFR3 SLA is per-asset or per-batch.
- **Browser matrix:** iOS Safari + Android Chrome (current + previous), evergreen desktop; iOS Safari is the source of the two hardest platform constraints (no background transfer; HEIC/HEVC). Real-device verification against the actual ambassador group is explicitly permitted.
- **No offline mode by design** — resilience budget lives entirely in the upload layer; resist PWA/offline scope creep.
- **Team constraint:** 1–3 developers, MVP in weeks (flagged as unconfirmed stakeholder assumption) — default to managed services over self-operated infrastructure; one deployable over distribution.
- **Cut order as module boundaries:** SMS (feature-flagged channel adapter) → triage queue (view layer over library + per-asset triaged flag) → brand assets (`origin: admin` only, zero schema impact). Upload/consent/library/export are the uncuttable spine and get build-first priority.
- **External integrations:** SMS (Twilio vs 46elks — provider-side caps are a hard selection criterion, plus EU processing and delivery webhooks); transactional email (the only auth path — deliverability is launch infrastructure; SPF/DKIM/DMARC against Stena's actual mail environment belongs on the launch checklist); v1.1: AI provider (selection deferred to v1.1 planning; MVP records only the residency/transfer-mechanism constraint) and LinkedIn share API (developer-app approval has lead time — start before the v1.1 cycle).
- **Non-code launch gates — RESOLVED 2026-07-08** (see `launch-decisions.md`): consent-text legal review **approved**; HR erasure runbook **adopted** (owner: HR Manager); **no brand typeface exists → Inter (SIL OFL), self-hosted** is the UI font; SMS cap **200 SEK/month** (46elks prepaid); US-owned-processor bar **accepted** (EU regions under SCC/DPA); **UI copy language = Swedish**. Versioning machinery still ships before any future terms change (FR8). Remaining pre-launch task: tested backup/restore drill (Story 7.6).
- **Public surface inventory:** noindex, no public pages beyond login/link-consumption — provider status webhooks become the only other publicly reachable endpoints and need their own authentication (signature verification). No external API, no API versioning needed.

### Cross-Cutting Concerns Identified

1. **Consent gating as session validity** — terms-version currency checked server-side on every app-tier authenticated request, with destination continuation (TUS chunk traffic is gated by Storage RLS + short JWT TTL; the upload commit endpoint is the authoritative checkpoint); consent state transitions triggered by three actors (user decline/withdrawal, admin deactivation, version change) all feeding the same send-suppression + session-revocation machinery.
2. **Account state machine** (invited/active/inactive-declined/inactive-withdrawn/deactivated — deletion removes the row, it is not a state) consumed by auth middleware, messaging sends, session revocation, and admin UI — one authoritative model, not per-feature flags.
3. **Audit emission** from every mutating subsystem through a single internal emitter no delete surface can skip; FR35 expiry job is the first scheduled job besides transcoding — a shared background-job substrate pays off across transcoding, zip export, audit expiry, and v1.1 AI generation.
4. **Four retention classes as data-model law:** content (indefinite until deleted, then completely gone); audit events (immutable during their lifetime, 6-month expiry, reference deleted assets by id + filename snapshot, no FK to live rows); usage/export/send events (durable, no expiry — mutable only for erasure attribution purges); acceptance records (append-only, tamper-evident, life-of-account/content, backup-class alongside originals).
5. **Signal separation server-side:** every signal classified praise (ambassador-visible) or triage (admin-only) before it gets a schema and endpoint; triage signals structurally unreachable from ambassador sessions (role-scoped serializers/relations, and media-URL access scoping).
6. **Honest state doctrine:** client state for uploads/processing/exports derives from server acknowledgments, never optimistic mutation; feature-gated MVP/v1.1 copy seams.
7. **Async status propagation** (transcoding-done, export-ready, delivery status): polling is the right-sized default at this concurrency; realtime channels are an optimization, not a requirement.
8. **Week-one KPI instrumentation is an MVP schema requirement:** activation (invited-at → acceptance → first upload) and task fulfillment (created → fulfilled within 7 days) are the v1.1 go/no-go gates and must be computable from MVP data even though the stats page is v1.1.
9. **Shared config for limits and error copy:** per-type caps and soft-edge error messages consumed identically by client validation and server enforcement.

### Open Questions & Document Discrepancies (to resolve during architecture)

1. **NFR1 wording conflict (UX-flagged):** does "< 3 s on 4G" measure to the upload screen (PRD literal) or to the point-of-action/task list in MVP (UX reading)? Pin the performance contract.
2. **Admin provisioning + consent-gate scope:** FR1/FR8 say "users"; FR5/consent cards scope consent to ambassadors only. How are admin accounts created, and does the terms gate apply to admin sessions? Needs role-aware gating decision.
3. **Task due dates/expiry:** TaskCard's "Due" badge and "expired-quiet" state have no FR backing — include a nullable due date in the task model or cut the UX state.
4. **Task completion semantics:** FR18 mark-done on multi-recipient tasks — one shared state or per-recipient? Affects the fulfillment-metric denominator.
5. **Multi-admin concurrency:** shared workspace + server-persisted triage state, but no doc defines concurrent triage/theme-assignment/delete semantics (live queue shrinkage, per-admin vs global position, undo across admins, delete-while-viewed). Decide the coordination model (last-write-wins is likely sufficient at this scale — but decide it).
6. **NFR19 internal inconsistency:** NFR19 says SMS **and email** providers must support spending caps; Integration Requirements and FR36 name only SMS (later AI). Resolve whether email caps are a real selection criterion.
7. **Acceptance records must outlive the account row:** the runbook says account records (incl. acceptance records) are deleted with the account AND that acceptance records are retained as long as content exists — a contradiction. Structural rule: no FK cascade from user to acceptance record; denormalized identity snapshot; retained identity post-deletion needs a documented lawful basis. Second-order: after offboarding + 6 months, deletion audit events expire — is there still erasure evidence?
8. **Audit actor names vs Art. 17 (UX-flagged):** shape the audit store so actor identity can be pseudonymized without breaking event integrity, pending legal confirmation.
9. **Video duration cap and batch SLA ambiguity** (see constraints above).
10. **Caption tracks (UX-flagged):** MediaPreview must support caption tracks; caption authoring is out of scope.

### Right-Sizing Guardrails (analysis findings against over-engineering)

- **No CDN is required by the docs** — EU-region hosting with pre-generated renditions and cache headers meets the performance targets at this scale; adding a CDN creates erasure/residency obligations (cache purge) that skipping it deletes entirely. List as optional.
- **No search engine** — DB indexes and full-text meet NFR5 at thousands of assets.
- **No HA/multi-AZ** — NFR15 permits single region, single-instance managed DB, maintenance windows.
- **No storage lifecycle tiering** — low-TB standard-tier object storage is tens of euros/month; billing visibility satisfies the cost-surfacing requirement.
- **No HLS packaging** — progressive faststart MP4 + posters meet the < 2 s target.
- **Polling over realtime infrastructure** for status propagation.
- **Proportionate tamper evidence** — hash chain or per-record HMAC + backups meets "modification is detectable"; WORM anchoring is an escalation option, not the default.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack responsive web application — Next.js (React) confirmed by user; Tailwind + shadcn/ui + Radix bound by the UX spec; Postgres-class DB, EU object storage, resumable uploads, and background jobs required by the PRD. Solo developer, AI-assisted — starter should pre-make correct conventional decisions with minimal rip-out surface.

**Versions verified 2026-07-07:** Next.js 16.2.10 stable (16.3 preview; major platform changes since 15: `proxy.ts` replaces `middleware.ts` on the Node runtime, Turbopack default, dynamic-by-default caching with opt-in `cacheComponents`, `next lint` removed, Node ≥ 20.9); React 19.2.7; Tailwind v4 (CSS-first config); shadcn CLI 4.13.0 — **Base UI is now the shadcn default; Radix requires explicit `-b radix`**; @supabase/ssr is the current official Supabase↔Next.js integration.

### Starter Options Considered

| Starter | Verdict | Key evidence (verified 2026-07-07) |
|---|---|---|
| **Official `with-supabase` example** | **Selected** | Maintained inside vercel/next.js repo; ships @supabase/ssr cookie-session wiring (browser + server clients, session-refresh middleware), TypeScript, Tailwind, shadcn/ui — exact declared stack. One adaptation: ships password-auth block → swap for `signInWithOtp` magic links. |
| Plain `create-next-app` + `shadcn init` + hand-wired @supabase/ssr | Near-tie runner-up | Zero rip-out, newest baseline; ~half a day more setup; Supabase publishes an official AI-prompt doc for the wiring. Fallback if the example lags Next 16 conventions badly at scaffold time. |
| create-t3-app | Rejected | Stale (7.40.0, 2025-11-05 — 8 months; still Next 15 + NextAuth v5). NextAuth session tables conflict with Supabase Auth; tRPC adds abstraction a solo internal app doesn't need. |
| next-forge (Vercel, v6.0.2 2026-03-20) | Rejected | Actively maintained but structurally overkill: Turborepo monorepo, ~7 apps, Stripe/PostHog/CMS dead weight. Default auth is Clerk — US processor relying on DPF/SCC transfers, not EU residency → conflicts with NFR9; Schrems III pending makes DPF reliance riskier. |
| nextjs/saas-starter | Rejected | Custom stateless JWT-in-cookie auth directly violates the immediate-revocation requirement; Stripe/teams skeleton irrelevant. |
| Chef/Convex, epic-stack, paid kits (supastarter/Makerkit) | Excluded | Non-Postgres / non-Next.js / buy multi-tenant billing this project doesn't need. |

### Selected Starter: official `with-supabase` example (+ Supabase EU as backend platform)

**Rationale for Selection:**

- Pre-makes exactly the right decisions for this project's compliance spine and upload pipeline: Supabase Postgres + Auth + Storage in one **EU-pinned region (Stockholm, eu-north-1 — six EU regions available; GDPR DPA; SOC 2 Type 2)**.
- **Resumable uploads solved without running an upload server:** Supabase Storage speaks native TUS (up to 500 GB on Pro; 6 MB chunks; 24 h resumable URLs; pause/resume across connectivity loss — matches the iOS Safari lossless pause/resume requirement; Uppy/tus-js-client compatible) plus a full S3 multipart API for the transcoding worker.
- **Magic-link-only auth is first-class** (`signInWithOtp`, PKCE; no passwords anywhere), and the session model supports the revocation requirement *when implemented correctly*: sign-out/ban deletes DB sessions immediately, but issued JWTs remain valid until expiry (default 1 h) — so the architecture must use per-request `getUser()` (network-validated) or an `auth.sessions` check in the data-access layer; `getClaims()` alone is insufficient. Consent-version gate rides the same per-request check.
- **Background-job substrate included:** Supabase Cron (pg_cron) for audit expiry, Supabase Queues (pgmq, GA) for transcode/zip/export jobs.
- **Known gaps, accepted and planned-for:** (1) Supabase has NO video transcoding (Edge Functions: 256 MB / 2 s CPU — ffmpeg confirmed infeasible) → external EU-hosted ffmpeg worker consuming Queues via the S3 API (home decided next step); image side is partially covered (HEIC→WebP/JPEG transforms on Pro, ≤ 25 MB source). (2) Email/SMS with per-recipient delivery webhooks is out of Supabase scope → EU providers selected next step; Supabase auth emails must point at custom SMTP (same provider) — the default built-in SMTP is rate-limited and not residency-guaranteed.
- **Cost envelope (verified):** Pro $25/mo; at ~1 TB media ≈ $45–60/mo total — well inside an internal-tool budget, satisfies the NFR17 cost-surfacing line.
- **Solo AI-assisted dev:** the with-supabase + shadcn + Next.js stack is the single best-documented, most AI-legible stack available; create-next-app now even emits AGENTS.md/CLAUDE.md.

**Initialization Command:**

```bash
# Scaffold from the official example (verified current):
npx create-next-app@latest stena-content-portal -e with-supabase

# Bind the design system to Radix per the UX spec
# (Base UI became the shadcn default in July 2026 — Radix must be explicit):
npx shadcn@latest init -b radix
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:** TypeScript (strict), Node ≥ 20.9, React 19.2.x, Next.js 16.2.x App Router.

**Styling Solution:** Tailwind v4 (CSS-first config) + shadcn/ui components (re-init with `-b radix` per UX spec) + CSS variables for the Fleet Deck token set.

**Build Tooling:** Turbopack (Next 16 default) for dev and build; ESLint 9 flat config (note: `next build` no longer lints — lint runs as its own CI step).

**Testing Framework:** None included — testing stack (Vitest + Playwright + axe-core per the UX testing strategy) is selected in the architectural decisions step.

**Code Organization:** App Router structure; @supabase/ssr two-client pattern (browser + server); session-refresh middleware (rename to `proxy.ts` per Next 16 deprecation); server components + route handlers as the API surface (no separate API tier).

**Development Experience:** Hot reload (Turbopack), typed env vars via `.env.example`, AGENTS.md/CLAUDE.md scaffolding, Supabase local dev via CLI (`supabase start`) with migrations-as-code.

**Required adaptations at scaffold time (recorded as first-story tasks):**

1. Swap the template's password-auth block for `signInWithOtp` magic-link flows (the @supabase/ssr scaffolding carries over unchanged).
2. Re-init shadcn with `-b radix`; apply Fleet Deck tokens.
3. Rename `middleware.ts` → `proxy.ts` if the example hasn't yet adopted Next 16 conventions; keep it to cheap `getClaims()` gating only — strict revocation + consent-gate checks live in the data-access layer via `getUser()`/session checks (this placement is mandatory anyway if hosting lands on Vercel, whose middleware runs globally regardless of region pinning).
4. Create the Supabase project in **eu-north-1 (Stockholm)** before any data exists.

**Decisions locked by this selection:** Supabase (EU region) as the backend platform (Postgres, Auth, Storage+TUS, Queues, Cron).
**Explicitly deferred to the architectural decisions step:** hosting (Vercel-pinned-EU vs Railway/Fly EU — including where the consent gate may live per host), ffmpeg worker home, email/SMS providers, testing stack, session TTLs.

**Stakeholder flag (carried forward):** Supabase, Vercel, Railway, Fly, and R2 are all US-owned processors offering EU regions under SCC-backed DPAs. If Stena's legal bar is "EU-owned processors only" (not just "EU regions"), the stack must pivot to Scaleway/Hetzner-class providers — confirm with the data controller before implementation starts.

**Note:** Project initialization using the commands above should be the first implementation story.

## Core Architectural Decisions

_All versions and provider capabilities web-verified 2026-07-07 (research + independent skeptic re-verification against primary sources)._

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
Hosting topology (Vercel EU + Railway worker), data access (Drizzle + Supavisor pooling), authorization model (server-only DAL + RLS backstop), session/revocation policy, tamper-evidence mechanism, email/SMS providers (Brevo/46elks), upload wiring (Uppy→Supabase TUS).

**Important Decisions (Shape Architecture):**
Client state (TanStack Query + RSC), URL filter state (nuqs), forms (react-hook-form + Zod v4), virtualization (TanStack Virtual), testing stack (Vitest/Playwright/axe-core), observability (MVP: structured platform logs via `src/shared/logger.ts`; Sentry EU post-MVP), CI/CD (GitHub Actions + Vercel git integration + Railway CLI).

**Deferred Decisions (Post-MVP, with rationale):**
v1.1 AI provider (PRD defers to v1.1 planning; MVP carries only the provenance seams + EU-transfer constraint); LinkedIn share API (v1.1 — start developer-app approval before the v1.1 cycle); campaign hard-delete versus archive semantics (consciously deferred to Epic 10 / v2 planning; MVP provisions dormant tables only); CDN (not required at this scale — adding one creates cache-purge/residency obligations); `cacheComponents` (dynamic-by-default is correct for a fully auth-gated app); realtime channels (polling right-sized; revisit only if polling proves insufficient).

### Data Architecture

- **Database:** Supabase Postgres (Stockholm, eu-north-1). **ORM: Drizzle** — `drizzle-orm 0.45.2` + `drizzle-kit 0.31.10` (pre-1.0: pin exact, upgrade in lockstep).
- **Migrations:** `drizzle-kit generate` with `out: './supabase/migrations'` and `migrations.prefix: 'supabase'` (verified supported) → applied via Supabase CLI (`supabase migration up` locally, `supabase db push` in CI). Never `drizzle-kit push` against prod. Officially documented workflow on both Supabase and Drizzle sides.
- **Connections:** from Vercel functions → Supavisor shared pooler **transaction mode, port 6543, `postgres(url, { prepare: false })`** (prepared statements unsupported in transaction mode — verified). From the Railway worker (long-lived) → session pooler or direct connection. Migrations → session/direct only.
- **Validation:** **Zod 4.4.3** (v4 is current major — note real v3→v4 breaking changes: unified `error` param, top-level `z.email()`, output-typed `.default()`, two-arg `z.record()`, `.issues` not `.errors`) as the single validation layer shared client/server; limits config (per-type size caps) defined once, consumed by client validation and server enforcement.
- **Data-model laws (from context analysis):** single `assets` table with three-value `origin` enum from day one; acceptance records in their own table with **no FK cascade from users** (identity snapshot denormalized); three retention classes as separate tables/lifecycles (content / audit events with 6-month pg_cron expiry / acceptance records indefinite); durable usage+export event tables separate from audit events; provenance edges + version chains anticipated in asset identity (v1.1 fills them). There is **no `campaign_id` on tasks or usage/event rows**; campaign connections exist only in `asset_campaigns`.
- **Two orthogonal organization axes (approved 2026-07-10):** curated themes are live in MVP; campaigns are dormant v2 seams. The former one-taxonomy “tags as folders” doctrine and `tags`/`asset_tags` tables are removed.
- **Organization schema (binding):** `themes(id, name, archived_at, created_at, updated_at)` · `asset_themes(asset_id, theme_id, created_at)` · `campaigns(id, name, description, starts_at, ends_at, theme_id NULL REFERENCES themes(id), archived_at, created_at, updated_at)` · `asset_campaigns(asset_id, campaign_id, created_at)`. Both join tables enforce composite uniqueness in asset-first order: `UNIQUE(asset_id, theme_id)` and `UNIQUE(asset_id, campaign_id)`; reverse indexes `(theme_id, asset_id)` and `(campaign_id, asset_id)` support browse/filter access. `campaigns.name` is required for calendar display. The optional `campaigns.theme_id` FK uses `ON DELETE SET NULL`, so a valid theme hard delete cannot be blocked by a dormant campaign reference.
- **Organization column constraints:** all four table IDs/FKs and both join `created_at` columns are non-null; IDs follow the project UUID-PK convention. `themes.name`, `campaigns.name`, `campaigns.description`, `campaigns.starts_at`, and `campaigns.ends_at` are non-null; each `archived_at` and `campaigns.theme_id` is nullable. `created_at`/`updated_at` are non-null with `now()` defaults and `updated_at` maintained by the owning DAL mutation. Campaigns enforce `ends_at >= starts_at`. Asset-side join FKs cascade on asset hard delete; `asset_themes.theme_id` restricts deletion as a backstop to the guarded DAL. `asset_campaigns.campaign_id` is `RESTRICT` in the dormant MVP schema as a protective integrity default, not a campaign lifecycle decision; Epic 10 may amend it when delete-versus-archive semantics are decided.
- **Join ownership:** asset-theme and asset-campaign rows are manual-insert-only through explicit admin DAL mutations. `assets.task_id`, upload context, generated-content provenance, and every other workflow context may never infer, propagate, or write either join table. Theme mutation intent is encoded by separate server routes, never a client-supplied source flag: `/api/triage/[assetId]/themes` performs the join mutation and sets `triaged_at` in one transaction; `/api/assets/[assetId]/themes` and `/api/assets/bulk-themes` perform library curation without changing `triaged_at`. Campaign tables have no readers, routes, or UI in MVP.
- **Theme lifecycle:** `archived_at` is a lifecycle status flag like `triaged_at`, **not soft delete**. Themes and campaigns hold no personal data, while stable rows preserve existing organization links; this is compatible with the no-soft-delete personal-data rule. Archived themes are absent from `ThemePicker` assignment choices and every new `asset_themes` insert rejects an archived theme until it is restored, but they remain queryable in filters, browse views, and connected-upload views. Theme archive/restore, join insertion, and guarded deletion lock the theme row (`SELECT … FOR UPDATE`) inside a transaction so archive-versus-assign and check-versus-delete races cannot violate the rule. Theme hard delete checks `asset_themes` and deletes in that same transaction, succeeding only at zero connections; a connected theme returns `CONFLICT` with archive as the remedy.
- **Search and filtering (AR17 amended):** the GIN `tsvector` covers asset descriptions only. Theme names are a structured, indexed filter/browse join through `asset_themes`, not full-text search (FR24). Campaign hard-delete versus archive behavior remains deferred to Epic 10 / v2 planning.
- **Tamper evidence (NFR10 decision):** acceptance records are **INSERT-only (DB grants + trigger) with a per-record HMAC chain** — each record's HMAC covers its fields + previous record's HMAC; key held outside the DB (`ACCEPTANCE_HMAC_KEY`, app + worker env). Chain integrity is verified on schedule by the worker job `verify-acceptance-chain` (pg_cron → `maintenance_jobs` enqueue — Amendment 3), alerting Sentry on failure. PII snapshot columns are encrypted per-user (crypto-shredding — Validation decision 1); Art. 17 erasure deletes the key and appends a signed tombstone record keeping the chain intact. WORM anchoring documented as escalation option, not implemented.
- **Caching:** none beyond Postgres — Next 16 dynamic-by-default; `cacheComponents` not enabled.

### Authentication & Security

- **Authentication:** Supabase Auth magic links only (`signInWithOtp`, PKCE; invite flow via Supabase invite email) through the `@supabase/ssr` two-client pattern. One link-consumption front door; token schema anticipates v1.1 purpose-scoped deep links.
- **Session policy (decided):** access-token JWT **10 min**; rotating refresh tokens; **~30-day inactivity timeout + ~180-day time-box** (Supabase Pro session controls); magic link **15 min, single-use**. Long-lived feel for ambassadors, bounded exposure.
- **Revocation + consent gate (hard requirement):** every app-tier authenticated request passes through the **data-access layer, which calls `getUser()` (network-validated) and the consent-version check** before touching data — verified necessary: sign-out deletes DB sessions immediately but issued JWTs stay valid until expiry, and `getClaims()` validates only locally. `proxy.ts` (Next 16 rename of middleware) does only cheap `getClaims()` routing — mandatory placement anyway since Vercel runs middleware globally (verified).
- **Authorization (decided):** **server-only DAL + RLS backstop.** Browser supabase-js is used ONLY for Auth and Storage TUS uploads; media reads follow app-issued 302 redirects — the browser never mints read URLs. All table access goes through role-scoped DAL modules whose ambassador-facing query functions structurally cannot join triage signals (praise/triage separation at module level, NFR8). RLS policies exist as defense-in-depth on every table; storage buckets private with short-lived signed URLs; upload bucket writes governed by Storage RLS on the user's session JWT.
- **Roles and ambassador identity:** `admin` flag in Supabase `app_metadata` (server-settable only) + a `profiles` table carrying the account state machine (invited/active/inactive-declined/inactive-withdrawn/deactivated) and admin-maintained contact data. `profiles.full_name` is the authoritative display/export name: it is nullable only for migrated/pre-existing rows, never inferred from email, required for new ambassador invitations, and maintained with email/mobile. Missing legacy values render as “Namn saknas” until an admin supplies one.
- **Public surface inventory:** login/link-consumption routes, Brevo + 46elks webhook endpoints (authenticated via signature/Basic-auth verification), everything else session-gated; `noindex` headers globally.
- **Encryption:** TLS everywhere; Supabase provider-managed at-rest encryption (DB + Storage + backups). No custom crypto beyond the acceptance-record HMAC chain.

### API & Communication Patterns

- **API surface:** Next.js server components for reads (initial render) + route handlers for client-interactive mutations and all webhooks; server actions only for simple non-interactive form posts. No separate API tier, no versioning (no external consumers).
- **Error handling standard:** typed domain errors mapped to the UX soft-edge shape (*what happened / why / remedy*); provider errors normalized at the adapter boundary (never leak raw provider payloads — FR36); Zod validation errors at every boundary.
- **Async status propagation:** **polling** via TanStack Query `refetchInterval` (transcode processing→ready, export building→ready, delivery statuses). No websockets/SSE — right-sized and revisitable.
- **Audit emission:** one internal `audit.emit()` module called by every mutating DAL operation **whose action has a type in the closed AUDIT_EVENTS registry** (triage verbs, delivery-status lattice updates, and theme CRUD are deliberately unaudited), in the same transaction; event taxonomy includes v1.1 types (shares, used-confirmations) from day one.
- **Messaging dispatch:** channel adapters (Brevo API adapter, 46elks REST adapter) invoked independently per channel with bounded timeouts and per-recipient send records; send-suppression for inactive accounts enforced in the dispatch path; persisted binary SMS budget state (from last 46elks response; 403 "Not enough credits" → flag set, SMS disabled pre-send until balance restored — polled via `/me`).

### Frontend Architecture

- **State/data:** **@tanstack/react-query 5.101.2** (React 19/Next 16 verified) with RSC prefetch + `HydrationBoundary`; optimistic updates for reversible triage verbs (star and theme assign/unassign), server-reconciled; honest-state doctrine for uploads/processing (no optimistic mutation where state can betray).
- **URL state:** **nuqs 2.9.0** (`NuqsAdapter` for App Router) — filter combinations URL-canonical, bookmarkable, shareable.
- **Forms:** **react-hook-form 7.81.0 + @hookform/resolvers 5.4.0 + Zod 4** (dual v3/v4 resolver support verified in source).
- **Virtualization:** **@tanstack/react-virtual 3.14.5** for GalleryGrid (roving tabindex, aria-rowcount, scroll-restore per UX spec).
- **Uploads:** **Uppy 5** (`@uppy/core 5.2.0`, `@uppy/tus 5.1.1` — v5 breaking changes noted: subpath React components, UppyContextProvider, new CSS paths) → Supabase TUS endpoint `https://{projectId}.storage.supabase.co/storage/v1/upload/resumable`, **chunk size exactly 6 MB** (mandatory), `retryDelays [0,3s,5s,10s,20s]`, Bearer session-JWT + apikey headers, Golden-Retriever-style state persistence for interruption safety.
- **Structure:** route groups `(ambassador)` and `(admin)` with separate layouts — natural code-splitting for the two surfaces; shadcn/ui on Radix (`-b radix`), Fleet Deck tokens in Tailwind v4 CSS-first config.

### Infrastructure & Deployment

- **App hosting:** **Vercel Pro, functions pinned to arn1 (Stockholm)**; git integration (prod deploy on main, preview per PR) gated by GitHub Actions checks. Media never transits Vercel (4.5 MB body limit is irrelevant: uploads go direct-to-Supabase TUS, downloads via signed URLs).
- **Worker hosting:** **Railway, EU West Metal (Amsterdam)** — Docker service bundling **ffmpeg 8.1.2 static build** (8.1+ mandatory: native tiled HEIC decode added March 2026 — 8.0 cannot reassemble iPhone tile grids; verified) + **sharp 0.35.3** (prebuilt, for JPEG/PNG/WebP thumbnails — prebuilt sharp excludes HEIC, so HEIC stills route through ffmpeg). Worker long-polls **Supabase Queues (pgmq) via `read_with_poll`** over a Postgres connection — the documented external-worker model. Also runs zip-export assembly. Temp-file hygiene per job (100 GB ephemeral disk cap).
- **Email:** **Brevo** (French, EU-only hosting verified: OVH France/Germany + encrypted backups Google Cloud Belgium; DPA in ToS). SMTP relay for Supabase Auth magic links (Supabase officially lists Brevo; **raise the default 30/hr auth email limit after wiring**); HTTP API + 15 per-recipient webhook event types (delivered/bounces/blocked/error…) for app sends and NFR14 delivery tracking. Free tier 300/day suffices for ~20 users.
- **SMS:** **46elks** (Swedish, all servers in Sweden). Prepaid balance = verified provider-side hard cap (403 "Not enough credits" on exhaustion — the PRD's exact requirement); low-balance emails < 2 EUR/20 SEK; balance API `/me`; `whendelivered` per-message webhooks (≥5 retries/6 h). **Operational rules:** stay on prepaid top-ups (invoice billing removes the cap); note 200-day credit expiry; record 46elks as independent **data controller** (telecom posture — not processor) in Art. 30 records. Twilio (IE1 Dublin) documented as fallback adapter only — its Usage Triggers are notification-only, failing the cap criterion.
- **Observability (MVP: platform logs; Sentry DEFERRED to post-MVP — decision 2026-07-08, see `launch-decisions.md`):** MVP ships **no Sentry**. Unexpected errors and critical alerts route through a runtime-neutral **error-logging seam** (`src/shared/logger.ts`, imported by both app and worker) that writes structured JSON to stdout — captured by **Vercel** and **Railway** platform logs (both EU). Post-MVP swaps in **Sentry, EU region (Frankfurt)** behind the same seam without touching call sites (`@sentry/nextjs 10.63.0`, Next 16 peer-verified; org created EU from day one — region is immutable; control-plane metadata stays US — record in GDPR docs; Team plan $26/mo or free Developer tier). MVP observability cost = $0.
- **CI/CD:** GitHub Actions — lint/typecheck/Vitest 4.1.10/Playwright 1.61.1 + @axe-core/playwright 4.12.1 on PR; `supabase db push` for migrations; Railway worker deploy via `ghcr.io/railwayapp/cli` container + project-token `railway up`; Vercel deploys via git integration.
- **Backups & erasure position (NFR16 vs NFR11 resolution):** Supabase Pro daily backups; **backup retention documented at ≤ 30 days** so erased data ages out within the Art. 17 window; restore runbook includes a re-apply-erasures step (recent deletion audit events + a manual check); position folded into the pending legal review.
- **Running cost envelope:** Supabase Pro $25 + Vercel Pro $20 + Railway ~$5–20 + Brevo $0 + 46elks per-SMS ≈ **$50–65/month for MVP** (Sentry deferred → $0 in MVP; adds $0–26 when introduced post-MVP, keeping the prior ~$50–90 envelope) — the NFR17 stakeholder cost line.

### Decision Impact Analysis

**Implementation Sequence:**

1. Scaffold (with-supabase example + shadcn `-b radix` + Fleet Deck tokens); Supabase project in eu-north-1; Vercel arn1 + Railway Amsterdam wiring; `src/shared/logger.ts` error-logging seam (Sentry post-MVP).
2. Data model + migrations (Drizzle): profiles/state machine, terms + acceptance records (INSERT-only + HMAC chain), assets (origin enum), themes + asset theme joins, dormant campaigns + asset campaign joins, tasks, audit events, usage/export events, send records.
3. Auth spine: magic-link flows, proxy.ts (getClaims routing), DAL with getUser + consent gate + role scoping; RLS backstop policies.
4. Upload pipeline (Uppy→TUS→staging→commit) and transcoding worker (pgmq + ffmpeg 8.1) — the PRD's build-first subsystems.
5. Library/triage/export; then messaging (Brevo/46elks adapters + webhooks + budget state); audit expiry cron; CI hardening.

**Cross-Component Dependencies:**

- The DAL is the single choke point: revocation, consent gate, role scoping, audit emission, and send-suppression all hang off it — build it before any feature code.
- The pgmq + worker substrate serves transcoding, zip export, and (v1.1) AI generation — one pattern, three consumers.
- Acceptance-record versioning must exist before legal review completes (any wording change = new terms version through FR8).
- Uppy chunk size (6 MB exact) and the staging-commit protocol jointly implement NFR13 — changing either breaks atomicity assumptions.
- Supabase project region is immutable-at-creation — must be EU on day one (eu-north-1 Stockholm). (Sentry's org region is likewise immutable, but Sentry is deferred to post-MVP; when introduced, create the org EU.)

## Implementation Patterns & Consistency Rules

_Draft adversarially reviewed by three critics (missed-conflict-points, contradiction-vs-sources, AI-agent practicality); all findings integrated._

### Naming Patterns

**Database (Postgres via Drizzle, `casing: 'snake_case'` — TS camelCase ↔ DB snake_case):**

- Tables: snake_case plural — `profiles`, `terms_versions`, `acceptance_records`, `assets`, `renditions`, `themes`, `asset_themes`, `campaigns`, `asset_campaigns`, `tasks`, `task_recipients`, `audit_events`, `usage_events`, `export_records`, `export_items`, `send_records`.
- Columns snake_case; PK `id uuid DEFAULT gen_random_uuid()`; FKs `<singular>_id`; timestamps `created_at`/`updated_at` (timestamptz). Indexes `idx_<table>_<cols>`.
- **Enums: text columns with Drizzle `{ enum: [...] }` + DB CHECK constraint — no `pgEnum`/`CREATE TYPE`** (planned enum growth: `origin` gains `generated` in v1.1). Values snake_case: `origin: ambassador|admin|generated`; `account_state: invited|active|inactive_declined|inactive_withdrawn|deactivated`; `processing_status: pending|processing|ready|failed`; `send_status: queued|sent|delivered|bounced|failed`.
- **Named exceptions (compliance spine — generic conventions do NOT apply):**
  - `acceptance_records`: INSERT-only (no UPDATE/DELETE grants, trigger-enforced), **no `updated_at`**, **no FK to profiles/auth.users** — denormalized identity snapshot columns (`user_id_snapshot`, `user_email_snapshot`, `user_name_snapshot`); `hmac` + `prev_hmac` columns form the per-record chain (key = `ACCEPTANCE_HMAC_KEY` env, never in DB); Art. 17 erasure via signed tombstone records.
  - `audit_events`: INSERT-only, no `updated_at`, `occurred_at` instead of `created_at`, references entities by `entity_id` + `entity_snapshot` jsonb (filename etc.) — **never FK to live rows**.
- Drizzle schema: one file per domain in `src/db/schema/*.ts`, re-exported from `index.ts`.

**API:**

- Route handlers under `app/api` — kebab-case plural resources: `/api/assets`, `/api/assets/[assetId]/themes`; dynamic params camelCase; query params camelCase; JSON wire camelCase; dates ISO-8601 UTC strings. Campaign routes do not exist in MVP.
- Webhooks: `/api/webhooks/brevo`, `/api/webhooks/46elks`.
- **URL namespaces (route groups do NOT prefix URLs — pin them):** ambassador surface owns the root (`/`, `/tasks`, `/upload`, `/my-uploads`, `/profile` under `(ambassador)/`); admin surface lives under a real `/admin` segment (`/admin`, `/admin/triage`, `/admin/library`, `/admin/ambassadors`, `/admin/exports`). Auth: `/auth/login`, `/auth/confirm` (magic-link verification), `/auth/consent`, `/auth/error` (Amendment 5). **Continuation param is `next` everywhere** (login, consent gate, `emailRedirectTo`) — relative paths only, allow-listed.
- Media URLs: JSON payloads carry **stable app URLs only** — `/api/assets/[assetId]/file?kind=thumb|preview|original` → DAL access check → 302 to a 60 s signed URL. The browser never mints read URLs.

**Code:**

- ALL files kebab-case (`triage-queue.tsx` exports `TriageQueue`); hooks `use-*.ts`; functions/variables camelCase; components/types PascalCase; true constants SCREAMING_SNAKE.
- **Type namespace rule:** Drizzle row types get the `Row` suffix (`type AssetRow = typeof assets.$inferSelect`); Zod-inferred wire types own the bare name (`Asset`). Components, route handlers, and TanStack caches carry wire types only; the DAL maps Row → wire, and role-scoped wire types omit fields at the type level (`AmbassadorAsset` has no `starred`/`dismissed` — leaks become type errors).

### Structure Patterns

```
src/
  app/                      # thin routes: (ambassador)/, (admin)/admin/, api/, auth/
  features/<feature>/       # upload, triage, library, consent, tasks, messaging, ambassadors, export
    dal/                    # server-only data access ('import "server-only"' at top)
    queries/                # client-side: TanStack key factories + useQuery/useMutation hooks
    components/  schemas/  hooks/
  components/ui/            # shadcn (owned code — see edit rule)
  db/                       # schema/, client.ts
  lib/                      # auth guards, supabase/{browser,server,admin}.ts, errors, query-config
  shared/                   # RUNTIME-NEUTRAL kernel: limits.ts, export-naming.ts, slug.ts,
                            # audit-events.ts, queue payload schemas, error codes
worker/                     # Railway deployable: Dockerfile, npm run worker; imports ONLY
                            # src/db/schema + src/shared + worker-local lib/ (eslint-enforced; Amendment 2)
e2e/                        # Playwright + page objects
supabase/                   # migrations (drizzle-kit output), config.toml
```

- **DAL is the named boundary:** `dal/` modules are server-only; where a feature serves both roles, split `dal/ambassador.ts` / `dal/admin.ts` — the ambassador file physically contains no triage-signal joins. Route handlers/server components **never import the db client directly**.
- **`src/shared` is runtime-neutral:** no `server-only`, no `next/*`, no React — the worker imports it. Zip naming, slugs, limits, queue payload Zod schemas, audit-event registry, and error codes live here.
- **shadcn edit rule:** components in `components/ui` are owned code and may be edited; any deviation from stock gets `// customized: <reason>` at the top so a future `shadcn add` overwrite is caught in diff. Feature-specific behavior goes in feature wrappers, not in `ui/`.
- Tests co-located (`foo.test.ts(x)`); Playwright in `e2e/`.

### Format Patterns

- **Success:** direct JSON payload, proper 2xx. **Lists:** always `{ items: T[], nextCursor: string | null }` (opaque keyset cursor).
- **Error envelope:** `{ error: { code, message, remedy? } }` — never 200-with-error; `message`/`remedy` in the UX soft-edge register.
- **Code → HTTP status map (canonical):** `AUTH_REQUIRED`/`SESSION_REVOKED` → 401 · `FORBIDDEN`/`ACCOUNT_INACTIVE` → 403 · `NOT_FOUND` → 404 · `CONSENT_REQUIRED` → 409 (carries `next` destination) · `CONFLICT` → 409 · `FILE_TOO_LARGE` → 413 · `UNSUPPORTED_FILE_TYPE` → 415 · `VALIDATION_FAILED` → 422 (field details) · `BUDGET_REACHED` → 429 · `LINK_EXPIRED` → 410 (remedy = request-new-link) · `RENDITION_FAILED`/`EXPORT_FAILED` → 500-class, retryable flag.
- **Global client handling:** one `QueryCache`/`MutationCache` `onError` in the QueryClient factory — `SESSION_REVOKED` → sign out + `/auth/login?next={current}`; `CONSENT_REQUIRED` → `/auth/consent?next={current}`. Features never handle these two codes locally. RSC equivalents via `redirect()` inside the auth guards.
- Nullable fields serialize as `null` (never omitted); booleans true/false; IDs UUID v4.
- **Display:** all timestamps rendered in Europe/Stockholm via one `Intl` helper in `src/shared`; wire stays UTC ISO. Relative dates in dense views, absolute on hover/detail (UX rule).

### Communication Patterns

- **Audit events:** dot-notation `entity.verb`, past tense. **Registry is closed:** all types live in `AUDIT_EVENTS` in `src/shared/audit-events.ts`; `audit.emit()` accepts only that union. MVP taxonomy: `asset.uploaded`, `asset.deleted`, `asset.erased`, `export.created`, `asset.shared` (v1.1 producer), `asset.used_confirmed` (v1.1 producer), `auth.logged_in`, `account.invited`, `account.deactivated`, `account.reactivated`, `account.deleted`, `consent.accepted`, `consent.declined`, `consent.withdrawn`, `terms.version_created`, `task.created`, `task.completed`, `message.sent`. **Explicitly NOT audited:** reversible triage verbs (star/theme assign/theme unassign/dismiss) and theme CRUD — admin-private curation state, not compliance events (PRD FR34 taxonomy governs).
- **Transaction rule (the shape, not just the rule):** every mutating DAL function:
  `db.transaction(async (tx) => { …mutation…; await audit.emit(tx, event); await jobs.enqueue(tx, 'transcode_jobs', payload); })`
  — `audit.emit` and `jobs.enqueue` take the tx handle as first argument (pgmq.send is plain SQL — transactional enqueue works). Calling either with the global client is a violation. **Storage-coupled mutations:** DB rows + audit event commit first; storage operations run after commit; orphaned storage objects are swept by the scheduled orphan-GC job.
- **Queues:** pgmq names snake_case (`transcode_jobs`, `export_jobs`); payloads versioned `{ v: 1, ... }` validated by Zod schemas in `src/shared`; handlers idempotent — check the entity's status column first, treat "already done" as success; max 3 receives → archive + mark `failed` (UI-retryable).
- **Webhooks:** verify Brevo signature / 46elks Basic-auth **before parsing**; unverified → 401, no detail. Resolve by `provider_message_id` (UNIQUE per provider); apply a **monotonic status lattice** (never downgrade `delivered`); append raw payload to `raw_events`; return 200 for unknown ids (log via the error-logging seam). Provider-event → canonical `send_status` mapping lives in each channel adapter.
- **State doctrine (three categories):** server state in TanStack Query; **filter/sort/search state URL-canonical via nuqs** (camelCase params; components read from URL, never useState; query keys derive from parsed URL state); local UI state in components. No global client store; exception: the Uppy instance in a React context provider.
- **Query conventions:** per-feature key factories (`assetKeys.list(filters)`); default `staleTime` 30 s; polling `refetchInterval`: processing status 3 s, export jobs 5 s, delivery status 15 s — all stop on terminal states; constants in `src/lib/query-config.ts`.
- **Optimistic-update verb table:** OPTIMISTIC (onMutate patch + rollback + invalidate on settle): star/unstar, theme assign/unassign. SERVER-ACK then invalidate: dismiss/mark-triaged, task mark-done, sends, profile edits. NEVER optimistic (honest-state doctrine): uploads, processing, exports, consent, deletion, budget state. New verbs default to server-ack unless added here. Bulk theme operations do **not** set `triaged_at`; they are library curation, not triage.

### Process Patterns

- **Auth contexts (three, enumerated — resolves the consent-gate deadlock):**
  1. `requireUser()` — the ambassador default: `getUser()` + account-state check + consent-version gate. `requireAdmin()` — `getUser()` + admin-flag + account-state check, **no consent gate** (Amendment 6: consent cards apply to ambassadors only).
  2. `requireUserPreConsent()` — `getUser()` + account-state check, consent gate skipped. Allowed ONLY in: `getCurrentTerms`, `acceptTerms`, `declineTerms`, `withdrawConsent`, `getOwnAccountState`.
  3. `systemContext()` — no session; importable only from `app/api/webhooks/` and app cron entries (the worker uses its worker-local context and the shared emitter, passing actor `'system'` — Amendment 2); audit events get `actor_id: null`, `actor_name_snapshot: 'system'`.
- **Upload contract (NFR13 wire protocol):** buckets `originals` (immutable) + `renditions` (regenerable) + `exports` (regenerable zips, 7-day TTL — Amendment 4), all private. Keys: `assets/{assetId}/original.{ext}` and `assets/{assetId}/{kind}.{ext}`. Staging is a **DB state**: upload-init creates the asset row (`processing_status: 'pending'`, library-invisible) and returns assetId + object key; Uppy TUS metadata = `{ bucketName, objectName, contentType, cacheControl }`, **chunk size exactly 6 MB (Supabase-mandated — never change)**; commit = `POST /api/uploads/[assetId]/commit` — server verifies object existence/size/type, flips status, enqueues `transcode_jobs` in the same transaction. Orphan GC: pg_cron enqueues a daily `maintenance_jobs` message; the worker `orphan-gc` job deletes storage prefixes (S3 API) **and the pending rows** for uploads still `pending` after 24 h (TUS URL TTL), plus a weekly diff-sweep of storage prefixes vs live asset ids (Amendment 3 / Validation decision 9).
- **Renditions:** own table (`asset_id, kind, storage_path, mime, width, height`). Canonical kinds — image: `thumb` (webp ~400px) + `preview` (webp ~1600px); video: `poster` (jpg) + `thumb` (webp) + `preview` (faststart mp4 720p); audio/doc: none (UI renders type icon). Partial rendition failure = asset `failed` (all-or-nothing).
- **Deletion:** ONLY via `deleteAssets(assetIds, { mode: 'delete' | 'erasure' })` — `delete` removes originals/renditions/derived + asset rows, **preserves** usage/export event rows (id + snapshot refs); `erasure` (offboarding/Art. 17) additionally purges actor attributions in usage/export events, purges recipient PII in send_records (raw_events scrubbed), force-expires exports-bucket zips referencing erased assets, sweeps the backup replica, and triggers the acceptance-record crypto-shred + tombstone path (full ordered protocol: Validation decision 4). Audit event records the mode. Delete-own and admin-delete = `delete`; offboarding bulk = `erasure`. Triage dismiss is `markTriaged()` — a queue-membership flag (single-asset star/theme/dismiss routes under `/api/triage` set `triaged_at`; Z-undo clears it; `/api/assets/*themes` library mutations do not), **never sharing a code path with deletion**.
- **Retention classes (per-table law):** content tables — live until deleted, then gone completely · `audit_events` — 6-month pg_cron expiry, **scoped to that single table by name** · `acceptance_records` — indefinite, exempt · `usage_events`/`export_records`/`export_items`/`send_records` — durable, no expiry. _(The UX-spec sentence saying export records expire on the audit schedule is superseded by the step-2/step-4 durable-event-store decision — do not "re-fix".)_
- **KPI columns (durable, never derived from the expiring audit log):** `profiles.invited_at / first_accepted_at / first_upload_at / last_login_at` (DAL-updated); `tasks.created_at / fulfilled_at`; `task_recipients.completed_at` — **task completion is per-recipient** (each recipient marks their own card done; `tasks.fulfilled_at` = first recipient completion, feeding the 7-day fulfillment KPI). In the ambassador roster, the PRD shorthand “last-login/activity” means `profiles.last_login_at` only; no aggregate `last_activity_at` is introduced, and null renders as “Aldrig.” _Resolves Open Question 4 and the Story 2.1 roster-data clarification._
- **Export naming:** `src/shared/export-naming.ts` (worker + app both import): slug = lowercase, NFC-normalize, å/ä→a, ö→o, non-alnum→hyphen; date = **Europe/Stockholm calendar date** of upload completion; `nn` = zero-padded sequence per (ambassador, date) within the export, ordered by `created_at`; original extension preserved.
- **Loading:** skeletons after 200 ms delay, layout space reserved, no blocking spinners; TanStack `isPending` naming.
- **Errors:** DAL throws typed `DomainError` subclasses (code + user-safe message + remedy); route handlers map to the envelope; server actions (allowed only for non-interactive form posts: consent accept/decline, login email) return the same error object — never throw to the client. All other client-interactive mutations are route handlers via `useMutation`. Unexpected errors are recorded via the error-logging seam (`src/shared/logger.ts` → structured platform logs in MVP; Sentry post-MVP) — domain errors are product states, not incidents and are never logged as such.
- **Validation:** Zod schemas in `features/*/schemas` shared by client forms and server boundaries; caps + `UPLOAD_CHUNK_SIZE` in `src/shared/limits.ts` only.
- **Supabase clients:** factories at `src/lib/supabase/{browser,server,admin}.ts`. Browser client = **Auth + TUS upload only**; client-side `.from()` table access is a violation (RLS is backstop, not API). Env canon (in `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `DATABASE_URL` (transaction pooler 6543, app), `DATABASE_SESSION_URL` (worker), `DIRECT_URL` (migrations), `ACCEPTANCE_HMAC_KEY`, `BREVO_API_KEY`, `BREVO_WEBHOOK_SECRET`, `ELKS_API_USERNAME`, `ELKS_API_PASSWORD`, `SENTRY_DSN`.

### Enforcement Guidelines

**All AI agents MUST:**

1. Access tables only through feature DAL modules (correct auth context of the three; ambassador DAL files contain no triage joins).
2. Emit audit events via `audit.emit(tx, …)` with a type from the closed registry, inside the mutation transaction.
3. Take limits, slugs, export naming, and queue schemas from `src/shared` — never inline.
4. Use the error envelope + canonical code→status map; soft-edge copy register for user-facing messages.
5. Never change the 6 MB chunk size, bypass the staging commit, add UPDATE paths or FKs to `acceptance_records`/`audit_events`, or let the expiry cron touch any table but `audit_events`.
6. Follow kebab-case files, feature modules, `Row`-suffix type rule, and the optimistic-verb table.
7. Write co-located tests for DAL functions; Playwright specs for journey-level changes; run typecheck + lint + tests before completion.

**Pattern enforcement:** eslint `no-restricted-imports` guards the worker/shared/DAL boundaries; violations are fixed on sight; patterns change only by editing this document (and noting why).

### Pattern Examples

**Good:** `await db.transaction(async (tx) => { await tx.insert(assets)…; await audit.emit(tx, AUDIT_EVENTS.assetUploaded, {…}); await jobs.enqueue(tx, 'transcode_jobs', { v: 1, assetId }); })`
**Anti-pattern:** `await audit.emit(db, …)` after the transaction — ghost audit events on rollback.

**Good:** `GET /api/assets?cursor=…` → `{ items, nextCursor }`; thumbnails at `/api/assets/{id}/file?kind=thumb`.
**Anti-pattern:** embedding 60 s signed URLs in list JSON — they expire inside the query cache and break the virtualized grid.

**Good (soft edge):** `{ code: 'BUDGET_REACHED', message: "SMS budget reached — this message wasn't sent.", remedy: "Email still works." }`
**Anti-pattern:** `{ error: 'Error 403: quota exceeded' }` — raw provider payload, no remedy, wrong register.

**Resolved 2026-07-08:** UI copy language = **Swedish** for all user-facing surfaces (copy register — warm, soft-edge — applies in Swedish). Code, DB identifiers, audit-event type strings, and developer docs stay English. Date/number formatting uses `sv-SE`; timestamps still render Europe/Stockholm. See `launch-decisions.md`.

## Project Structure & Boundaries

_Tree verified by two agents: FR-coverage walk (FR1–FR36 → every requirement has a named home) and pattern-consistency check (tree vs. Implementation Patterns, line by line). All findings integrated._

### Amendments to Implementation Patterns (authoritative corrections)

1. **Feature list:** `admin` renamed to `ambassadors` (avoids collision with the `(admin)` route group and `dal/admin.ts` role convention).
2. **Worker import surface:** `worker/` may import `src/db/schema` + `src/shared` + its own `worker/lib/`. The audit emitter and job enqueuer move to `src/shared/` (runtime-neutral, take a Drizzle tx handle) so the worker can emit audit events; `src/lib/auth.ts` contexts remain app-only — worker jobs pass `actor: 'system'` explicitly.
3. **Scheduled-job mechanics corrected:** pure pg_cron SQL only works for the audit expiry. The HMAC chain-verification and orphan-GC jobs run **in the worker** (pg_cron enqueues onto a `maintenance_jobs` pgmq queue on schedule; worker consumes) — the HMAC key lives in worker env, and storage-prefix deletion needs the S3 API. Chain-verification failure alerts via the error-logging seam (critical structured log in MVP, captured by Railway platform logs; Sentry alerting post-MVP).
4. **Third storage bucket:** `exports` (private, keys `exports/{exportId}.zip`, regenerable) — zips expire after 7 days via the maintenance queue; download via the 302 pattern.
5. **Auth namespace:** `/auth/error` added (expired/used-link landing, `LINK_EXPIRED` remedy page per FR3).
6. **Consent-gate scope (resolves Open Question 2):** the consent cards grant upload/likeness rights — they apply to **ambassadors only**. `requireAdmin()` skips the consent-version gate. Admin accounts are provisioned via `scripts/create-admin.ts` (service-role: sets `app_metadata.admin`, creates profile row); first admin seeded manually at setup.
7. **Ambassador root:** `/` redirects to `/tasks` (the task list is home per UX bottom-nav).
8. `src/components/shared/` documented for cross-feature UI (CelebrationMoment).
9. **Themes and dormant campaign seams (approved Sprint Change Proposal, 2026-07-10):** two orthogonal axes replace the former one-taxonomy tags-as-folders model. Curated themes are live in MVP; campaigns are schema-only until Epic 10 / v2, with no MVP readers, routes, or UI. This supersedes AR11's nullable campaign seams on tasks/events: there is no `campaign_id` on tasks or usage/event rows, and campaign connections exist only in `asset_campaigns`. Both asset joins require explicit admin DAL mutations and can never be populated from upload context or `assets.task_id`. AR17 is amended to description-only full-text search plus structured indexed theme filtering. Campaign hard-delete versus archive behavior is deliberately deferred to Epic 10 / v2 planning.

### Complete Project Directory Structure

```
stena-content-portal/
├── README.md
├── package.json                      # scripts: dev, build, worker, test, e2e, db:generate, db:push
├── next.config.ts                    # plain in MVP (wrap with Sentry post-MVP)
├── postcss.config.mjs                # Tailwind v4
├── tsconfig.json
├── eslint.config.mjs                 # + no-restricted-imports boundary rules
├── vitest.config.ts
├── playwright.config.ts
├── drizzle.config.ts                 # out: ./supabase/migrations, prefix: 'supabase'
├── components.json                   # shadcn, Radix base
├── vercel.json                       # { "regions": ["arn1"] }
├── .env.example                      # env canon (single source of truth)
├── .gitignore
├── .github/workflows/ci.yml          # typecheck+lint+vitest+playwright/axe → supabase db push → railway up
├── scripts/
│   ├── create-admin.ts               # admin provisioning (service role)
│   └── publish-terms.ts              # new terms version via consent DAL (emits terms.version_created)
├── public/                           # favicon only; noindex via headers
├── supabase/
│   ├── config.toml
│   ├── seed.sql                      # local dev: initial terms version, dev admin
│   └── migrations/                   # drizzle-kit output + NNNN_cron_jobs.sql (pg_cron defs:
│                                     #   audit expiry SQL, maintenance_jobs enqueues)
├── src/
│   ├── proxy.ts                      # Next 16: cheap getClaims() routing ONLY
│   ├── instrumentation.ts            # server init + error-logging seam (add Sentry post-MVP)
│   ├── instrumentation-client.ts     # POST-MVP only (client Sentry) — omit in MVP
│   ├── app/
│   │   ├── layout.tsx  globals.css   # Fleet Deck tokens (Tailwind v4 CSS-first)
│   │   ├── global-error.tsx          # root error boundary → logs via seam (Sentry reporting post-MVP)
│   │   ├── (ambassador)/             # URL: root namespace
│   │   │   ├── layout.tsx            # bottom tab bar (Tasks/Upload/My uploads/Profile)
│   │   │   ├── page.tsx              # "/" → redirect to /tasks
│   │   │   ├── tasks/page.tsx        # task list (home)
│   │   │   ├── tasks/[taskId]/page.tsx
│   │   │   ├── upload/page.tsx       # spontaneous upload (flow A2)
│   │   │   ├── my-uploads/page.tsx   # delete-own variant of GalleryGrid
│   │   │   └── profile/page.tsx      # + "Your consent" panel (Flow 5b)
│   │   ├── (admin)/admin/            # URL: /admin/*
│   │   │   ├── layout.tsx            # top bar + left rail
│   │   │   ├── page.tsx              # library home, "New this week" card
│   │   │   ├── triage/page.tsx       # full-screen queue (surface-media black)
│   │   │   ├── library/page.tsx      # filters (nuqs) + GalleryGrid + SelectionBar
│   │   │   │                         #   + brand-asset UploadManager mount (FR28)
│   │   │   ├── ambassadors/page.tsx
│   │   │   ├── ambassadors/[profileId]/page.tsx   # detail + offboarding entry
│   │   │   ├── tasks/page.tsx        # request compose + manage (Flow 6)
│   │   │   ├── messages/page.tsx     # free-form compose + delivery status
│   │   │   └── exports/page.tsx      # export history + statuses
│   │   ├── auth/
│   │   │   ├── login/page.tsx        # one-field email (the only typing in the product)
│   │   │   ├── confirm/route.ts      # ONE front door: token_hash verification → session → `next`
│   │   │   ├── consent/page.tsx      # ConsentCardStack (first login + re-accept, `next` continuation)
│   │   │   └── error/page.tsx        # LINK_EXPIRED landing, one-tap re-request
│   │   └── api/
│   │       ├── assets/route.ts                   # GET list { items, nextCursor }
│   │       ├── assets/[assetId]/route.ts         # GET (status poll) · PATCH (description) · DELETE (single)
│   │       ├── assets/[assetId]/file/route.ts    # 302 → 60s signed URL (kind=thumb|preview|original)
│   │       ├── assets/[assetId]/themes/route.ts  # POST/DELETE library theme assignment; never sets triaged_at
│   │       ├── assets/bulk-delete/route.ts       # POST { assetIds, mode } → deleteAssets()
│   │       ├── assets/bulk-themes/route.ts       # POST { assetIds, addThemeIds, removeThemeIds }; no triaged_at side effect
│   │       ├── triage/route.ts                   # queue list + verbs (mark-triaged/undo)
│   │       ├── triage/[assetId]/star/route.ts    # POST/DELETE star + triaged_at in one tx
│   │       ├── triage/[assetId]/themes/route.ts  # POST/DELETE theme assignment + triaged_at in one tx
│   │       ├── uploads/init/route.ts             # asset row 'pending'; origin from session role
│   │       ├── uploads/[assetId]/commit/route.ts # verify → flip visible → enqueue transcode (one tx)
│   │       ├── themes/route.ts                   # GET active/all for browse/filter; POST create
│   │       ├── themes/[themeId]/route.ts         # PATCH/archive/restore; DELETE guarded at zero joins
│   │       ├── tasks/route.ts  tasks/[taskId]/route.ts        # incl. per-recipient mark-done
│   │       ├── messages/route.ts                 # send via channel adapters
│   │       ├── exports/route.ts                  # POST create (size estimate) · GET list
│   │       ├── exports/[exportId]/route.ts       # GET status poll
│   │       ├── exports/[exportId]/file/route.ts  # 302 → signed zip URL
│   │       ├── ambassadors/route.ts  ambassadors/[profileId]/route.ts  # invite/deactivate/delete
│   │       └── webhooks/brevo/route.ts  webhooks/46elks/route.ts      # signature-verified, idempotent
│   ├── features/
│   │   ├── consent/      {dal/, components/consent-card-stack.tsx, schemas/, queries/}
│   │   ├── upload/       {dal/, components/{upload-manager,progress-strip,selection-review}.tsx,
│   │   │                  hooks/use-uppy.ts, schemas/, queries/}          # 3s processing poll
│   │   ├── triage/       {dal/admin.ts, components/{triage-queue,keyboard-legend}.tsx, queries/}
│   │   │                                                    # verbs validate via library/schemas
│   │   ├── library/      {dal/{ambassador,admin}.ts, components/{gallery-grid,media-preview,
│   │   │                  filter-rail,theme-picker,selection-bar,consequence-dialog}.tsx, # picker lists active themes only
│   │   │                  queries/, schemas/}
│   │   ├── tasks/        {dal/{ambassador,admin}.ts, components/{task-card,task-compose}.tsx,
│   │   │                  queries/, schemas/}
│   │   ├── messaging/    {dal/admin.ts, adapters/{brevo,elks}.ts, components/message-compose.tsx,
│   │   │                  schemas/, queries/}                             # 15s delivery poll
│   │   ├── export/       {dal/admin.ts, components/, queries/, schemas/} # 5s export poll
│   │   └── ambassadors/  {dal/admin.ts, components/{invite-form,ambassador-table}.tsx,
│   │                      schemas/, queries/}
│   ├── components/
│   │   ├── ui/                        # shadcn (owned; `// customized:` headers on deviations)
│   │   └── shared/celebration-moment.tsx
│   ├── db/
│   │   ├── client.ts                  # app Drizzle client (DATABASE_URL, prepare:false)
│   │   └── schema/{profiles,consent,assets,themes,campaigns,tasks,audit,usage,exports,messaging}.ts + index.ts
│   │       # audit.ts = expiring class ONLY; usage.ts/exports.ts/messaging.ts = durable class
│   │       # campaigns.ts is schema-only in MVP: no readers, route handlers, or UI
│   ├── lib/
│   │   ├── auth.ts                    # requireUser / requireAdmin (no consent gate) /
│   │   │                              # requireUserPreConsent / systemContext (webhooks+cron routes)
│   │   ├── deletion.ts                # deleteAssets(assetIds, {mode}) — THE delete path
│   │   ├── errors.ts                  # DomainError subclasses + envelope mapper
│   │   ├── query-config.ts            # staleTime + polling constants
│   │   └── supabase/{browser,server,admin}.ts
│   └── shared/                        # runtime-neutral kernel (no next/*, no React, no server-only)
│       ├── limits.ts  slug.ts  export-naming.ts  datetime.ts   # Europe/Stockholm helpers
│       ├── audit-events.ts            # closed AUDIT_EVENTS registry
│       ├── audit.ts  jobs.ts          # emit(tx,…) + enqueue(tx,…) — moved here (amendment 2)
│       ├── error-codes.ts             # code → HTTP status map
│       └── queue-payloads.ts          # Zod schemas: transcode_jobs, export_jobs, maintenance_jobs
├── worker/                            # Railway deployable
│   ├── Dockerfile                     # node:22 + ffmpeg 8.1.x static build
│   ├── index.ts                       # pgmq read_with_poll loop (all queues) + error-logging seam init (Sentry post-MVP)
│   ├── jobs/{transcode,export-zip,orphan-gc,verify-acceptance-chain}.ts
│   ├── lib/{db,ffmpeg,storage}.ts     # db = Drizzle on DATABASE_SESSION_URL; storage = S3 client
│   └── tsconfig.json
└── e2e/
    ├── fixtures/  pages/
    └── specs/{onboarding-consent,task-upload,triage,library-export,offboarding}.spec.ts
                                       # + axe checks inside each critical-flow spec
```

### Architectural Boundaries

**API boundaries:** three public surfaces only — `/auth/login` + `/auth/confirm` (link consumption), `/api/webhooks/*` (signature-verified), everything else session-gated. All data flows: client → route handler → DAL (auth context + role scoping + audit) → Drizzle → Postgres. Media bytes flow client ↔ Supabase Storage directly (TUS up, 302-signed-URL down) — never through Vercel.

**Component boundaries:** features never import each other's `dal/` — cross-feature server logic lives in `src/lib` (deletion, auth) or `src/shared`; cross-feature UI in `components/shared`. Route files compose features; they contain no business logic. The `(ambassador)` bundle never imports from `features/*/dal/admin.ts` (build-level praise/triage separation, backed by the wire-type rule).

**Service boundaries:** worker ↔ app communicate ONLY through Postgres (pgmq messages + status columns) and object storage — no HTTP between them. Provider adapters (`brevo.ts`, `elks.ts`) are the only modules that touch provider SDKs/APIs; budget state and error normalization live inside them. SMS is severable by feature flag (cut order #1).

**Data boundaries:** four retention classes = four schema files (assets/content, audit expiring, usage/exports durable, consent indefinite); the expiry cron names `audit_events` only. RLS backstop on all tables; storage buckets private; `originals` written once (upload commit), read by worker + export + file route; `renditions` written only by worker; `exports` written only by worker, expired by maintenance job.

### Requirements → Structure Mapping

| Capability area (FRs) | Primary home |
|---|---|
| Identity & Auth (FR1–3) | `app/auth/*`, `lib/auth.ts`, `lib/supabase/*` |
| Consent & Lifecycle (FR4–8) | `features/consent/`, `db/schema/consent.ts`, `app/auth/consent/`, `scripts/publish-terms.ts` |
| Upload & Ingestion (FR9–15) | `features/upload/`, `api/uploads/*`, `db/schema/assets.ts` |
| Media Processing (FR22–23) | `worker/jobs/transcode.ts`, `db/schema/assets.ts` (processing_status), renditions table |
| Tasks & Messaging (FR16–20, 36) | `features/tasks/`, `features/messaging/` (+adapters), `api/tasks|messages`, `api/webhooks/*` |
| Library & Curation (FR21, 24–28) | `features/library/`, `features/triage/`, `api/assets*`, `api/themes*`, `db/schema/themes.ts`, admin library page (FR28 mount) |
| Deletion/Export/Offboarding (FR29, 30, 33) | `lib/deletion.ts`, `api/assets/bulk-delete`, `features/export/` + `worker/jobs/export-zip.ts` |
| Ambassador Administration (FR31–32) | `features/ambassadors/`, `api/ambassadors/*`, `scripts/create-admin.ts` |
| Audit & Governance (FR34–35) | `src/shared/audit{,-events}.ts`, `db/schema/audit.ts`, cron migration (expiry SQL) |
| v1.1 seams (FR37–44, 46–48) | schema-only now: origin enum, provenance/version columns, `usage.ts`/`exports.ts` durable events, closed audit taxonomy, purpose param in `/auth/confirm` |
| Campaign Calendar (FR45, v2) | MVP schema seam only: `db/schema/campaigns.ts` with `campaigns` + `asset_campaigns`; no readers, routes, or UI until Epic 10 |

**Cross-cutting:** auth contexts → `lib/auth.ts` consumed by every DAL; audit emission → `shared/audit.ts` (tx-threaded); limits/naming → `src/shared`; KPI columns → `profiles` + `tasks`/`task_recipients` (durable, DAL-updated).

### Integration Points & Data Flow

- **Upload:** Uppy (6 MB TUS chunks) → Supabase Storage `originals` → `POST commit` → asset visible + `transcode_jobs` enqueued (one tx) → worker ffmpeg → `renditions` + status `ready` → client 3 s poll flips the tile.
- **Export:** SelectionBar → `POST /api/exports` (size estimate → export_record + `export_jobs`) → worker streams originals → zip in `exports` bucket → 5 s poll → "export ready" → 302 download.
- **Messaging:** compose → dispatch (suppression check → per-channel adapter → send_records) → provider webhooks → status lattice updates → 15 s poll surfaces failures (NFR14).
- **Scheduled:** pg_cron: audit-expiry SQL (direct), `maintenance_jobs` enqueues (orphan-GC daily, chain-verify daily, export-zip cleanup) → worker handlers.
- **External services:** Supabase (Auth/Storage/Postgres/pgmq, Stockholm) · Brevo (SMTP for auth mail + API/webhooks) · 46elks (REST + webhooks) · Vercel arn1 (app) · Railway Amsterdam (worker) · Sentry EU (app + worker) — **POST-MVP**.

### Development Workflow Integration

- **Local:** `supabase start` (local stack) → `npm run dev` (Turbopack) + `npm run worker` (tsx watch; ffmpeg installed locally or via the worker Docker image). Migrations: `npm run db:generate` (drizzle-kit) → `supabase migration up`. Seed: `supabase/seed.sql` (terms v1 + dev admin).
- **CI (GitHub Actions):** typecheck → lint → Vitest → Playwright + axe (against local supabase) → on main: `supabase db push` → `railway up` (worker) — Vercel deploys via git integration, gated by these checks.
- **Deploy targets:** Vercel builds `src/` app (arn1); Railway builds `worker/Dockerfile`; Supabase migrations are the single schema source of truth.

## Architecture Validation Results

_Validated by four parallel agents: cross-section coherence, NFR walk (all 20), FR coverage + open-questions audit, and an implementation-readiness probe that simulated an AI agent implementing three stories (upload commit + transcode, triage queue, offboarding erasure) from this document alone. All findings resolved below; stale superseded sentences corrected in place._

### Coherence Validation ✅ (after corrections)

The decision spine is compatible end-to-end (versions re-verified 2026-07-07; one staleness fixed: worker Dockerfile now `node:22` — Node 20 is past EOL). Fifteen unmarked superseded sentences (pg_cron/worker job placement, retention classes, consent-gate scope, feature naming, bucket count, browser-client scope, HMAC key location) corrected in place to match the authoritative amendments. Remaining known tensions are explicitly documented as accepted residuals (below), not contradictions.

### Requirements Coverage Validation ✅

- **FRs:** all 36 MVP FRs have concrete homes (verified by walk); previously-gapped FR8/FR27/FR28/FR29/FR33/FR35 confirmed closed. All 11 v1.1 FRs have named MVP seams, and the single v2 requirement FR45 has its dormant campaign schema seam. Two last gaps closed here: **FR15** — `assets.task_id` (nullable FK) set by upload-init when the flow enters from a task, validated against an open task addressed to the session user; **FR10** — capture mode (`<input capture>`) explicitly part of the upload feature.
- **NFRs:** walk verdict was 12 covered / 8 partial / 0 missing; every partial is resolved by a decision below. Standouts confirmed exemplary: NFR8 (role separation), NFR10 (tamper evidence), NFR13 (staging protocol), NFR9/NFR20 (provider selection).

### Validation Issues Addressed (decisions now binding)

**Critical resolutions:**

1. **Acceptance-record PII erasure = crypto-shredding (user decision).** `user_email_snapshot`/`user_name_snapshot` are stored encrypted with a per-user key in a separate `consent_pii_keys` table (outside the HMAC chain; key material never in backups' plaintext). Erasure deletes the key and appends a signed tombstone record; the chain verifies intact; `user_id_snapshot` (pseudonymous UUID) remains as evidence. The chain-verification job treats tombstoned users' records as valid. The consent DAL owns the encrypt/decrypt helper.
2. **Originals backup = nightly replication (user decision).** A `maintenance_jobs`-scheduled worker job replicates the `originals` bucket to a second EU bucket (S3-to-S3 sync) nightly (RPO ≤ 24 h); **erasure mode also sweeps the replica** (NFR11 preserved); a **tested restore exercise (DB + storage) is a named launch gate** and a documented runbook. Replica retention ≤ 30 days for deleted objects (consistent with the backups-vs-erasure position).
3. **Auth email delivery tracking = Supabase Send-Email hook (user decision).** Supabase Auth is configured with the send-email hook calling our endpoint, which dispatches through the app's Brevo adapter — every magic-link/invite email gets a `send_record` + webhook tracking identical to app sends; bounced invites surface on the admin messages page (NFR14's headline case closed). Hook capability is verified against current Supabase docs at implementation time; fallback if unavailable: ingest unknown-id Brevo webhooks keyed by (recipient, template class).
4. **Offboarding erasure protocol (the NFR11 data map, now explicit).** Ordered: (1) deactivate + `auth.admin.signOut(userId)` (all devices); (2) `deleteAssets(assetIds, {mode:'erasure'})` — assets + renditions + originals (and backup replica) + **exports-bucket zips whose export_items reference erased assets are force-expired**; usage/export event attributions purged; (3) `deleteAccount(profileId)` — deletes auth user + profiles row; `task_recipients` rows deleted; **`send_records` recipient PII purged** (channel/status/timestamps retained, contact fields nulled, `raw_events` scrubbed); `export_items` filename snapshots retained (slug = already-public-by-export data; noted for legal review); acceptance-record crypto-shred + tombstone; (4) a durable **`erasure_records`** row (who executed, when, counts — no subject PII) is written so erasure evidence survives the 6-month audit expiry. Audit events `account.deleted` + `asset.erased` emitted. Account deletion is row removal — `deleted` is NOT an account_state enum value (no-soft-delete law).

**Upload pipeline decisions (probe A):**

5. **Checksum is deliberately not implemented** — TUS offset completion + size match is the commit gate (supersedes the context-analysis wording; TUS's own chunk accounting provides transfer integrity).
6. **Init/commit schemas pinned:** init body = `{ filename, mime, declaredSize, taskId? }` → `{ assetId, objectKey }`; commit verifies via S3 HEAD (existence + size vs declaredSize + server-side type sniff of leading bytes); failures: size/type mismatch → staged object deleted immediately + `FILE_TOO_LARGE`/`UNSUPPORTED_FILE_TYPE`; object missing/incomplete → **`UPLOAD_INCOMPLETE` → 409** (new canonical code), row stays `pending` for retry-or-GC. Commit is idempotent (already `processing`/`ready` → 200 no-op). Commit sets `processing_status='processing'`.
7. **NFR4 token seam:** Uppy TUS headers are supplied **dynamically** (function-form/`onBeforeRequest`) pulling the current session token from supabase-js (which auto-refreshes); 401 on chunk PATCH = refresh-and-retry, not terminal. Long-upload token-rollover case added to the e2e plan.
8. **OQ9 resolved:** video duration cap is **advisory copy only** (2 GB size is the enforced limit; no duration probe in MVP). **NFR3 SLA is per-asset** from that asset's upload completion under normal load; worker runs **2 concurrent ffmpeg jobs** (2 vCPU Railway instance); batch arrivals process FIFO best-effort; scale-out lever = second Railway replica on the same queue. Failed jobs delete any partial renditions before marking `failed`; retry via **`POST /api/assets/[assetId]/retry-processing`** (added to route tree).
9. **Orphan-GC completed:** deletes pending-row storage prefixes after 24 h **and the pending rows themselves** (no audit event — nothing entered the library); plus a weekly diff-sweep mode (storage prefixes vs live asset ids) that also catches deletion-failure orphans. **Storage RLS INSERT policy pinned:** originals-bucket writes require object key `assets/{id}/…` where `assets.id = {id} AND uploader_id = auth.uid() AND processing_status = 'pending'`; renditions/exports buckets have no client-write policies.

**Triage decisions (probe B):**

10. **Queue predicate:** `triaged_at IS NULL AND processing_status IN ('processing','ready')`, all origins, ordered `created_at ASC`; "new this week" is display copy — untriaged items persist until triaged.
11. **Star and theme-assignment routes:** triage mutations use `POST/DELETE /api/triage/[assetId]/star` and `POST/DELETE /api/triage/[assetId]/themes`; each sets `triaged_at` in the mutation transaction. Library curation uses `POST/DELETE /api/assets/[assetId]/themes` or `/api/assets/bulk-themes` and never sets `triaged_at`. The route namespace is the server-visible intent boundary — no client `source` flag. The client optimistically patches only star/theme fields and lets queue membership reconcile on invalidate. Every join mutation requires explicit admin intent; `assets.task_id` and upload context never write `asset_themes` or `asset_campaigns`.
12. **OQ5 resolved — multi-admin model declared:** last-write-wins on all triage verbs; `triaged_at` is a shared flag; Z-undo clears it regardless of who set it; queue **position is per-admin client state** (derived cursor, no server position row); an asset deleted while another admin views it advances the queue with a quiet notice (standard `NOT_FOUND` envelope).

**Session/lifecycle decisions (probe C):**

13. **Revocation mechanics:** deactivate/delete/withdraw call `supabase.auth.admin.signOut(userId)` (global). `/auth/confirm` checks `profiles.account_state` after verification: `inactive_declined`/`inactive_withdrawn` → session created → consent cards (self-service re-entry, FR7); `deactivated` → paused screen, session created but every DAL call returns `ACCOUNT_INACTIVE` → 403 (no state oracle before auth; FR4 suppresses task/message sends, not login links).
14. **Generated-children hook is a code artifact:** `getDeletionImpact(assetIds)` → `{count, generatedChildren: []}` runs before every ConsequenceDialog; MVP always returns an empty children array; v1.1 fills it from provenance edges.
15. **Bulk-erasure execution:** DB-row deletion is synchronous (assets vanish immediately — the UX promise); storage fan-out runs inline for ≤ 50 objects, else via `maintenance_jobs`.

**Remaining NFR closures:**

16. **OQ1/NFR1 resolved:** MVP performance contract adopts the UX reading — notification link → **interactive task list < 3 s on 4G** (literal upload-screen target activates with v1.1 tokenized links; flagged for PRD wording sync). Throttled-4G task-link→upload check added to the e2e plan.
17. **NFR5 / AR17 made concrete:** named indexes — `idx_assets_created_at (DESC)`, `idx_assets_uploader_id`, `idx_assets_type`, `idx_assets_triaged_at (partial, WHERE triaged_at IS NULL)`, join uniqueness `UNIQUE(asset_id, theme_id)` / `UNIQUE(asset_id, campaign_id)`, reverse browse indexes `idx_asset_themes_theme_id_asset_id` / `idx_asset_campaigns_campaign_id_asset_id`, and `idx_send_records_provider_message_id (UNIQUE)`; search = **GIN `tsvector` over asset descriptions only** (`simple` config; Swedish descriptions don't stem well). Theme names are resolved through the indexed `asset_themes` join for structured filtering/browsing and are not included in full-text search.
18. **NFR2 hot path:** the `/api/assets/[id]/file` 302 response for `kind=thumb|preview` sets `Cache-Control: private, max-age=300` so repeat views inside a session skip the auth chain; rendition objects themselves are immutable per (assetId, kind). Accepted residual: first-view latency includes one auth round-trip — within budget on pre-generated renditions.
19. **OQ6/NFR19 resolved:** Brevo's plan-level daily quota is accepted as the de facto email spending cap; the Brevo adapter maps quota-exceeded responses to `BUDGET_REACHED` exactly like SMS. NFR19's email-cap wording noted as a PRD inconsistency, satisfied in spirit.
20. **OQ3 resolved:** `tasks.due_at` (nullable) added — display-only (drives the TaskCard "Due" badge and `expired-quiet` state); no enforcement, no reminder semantics, no effect on the fulfillment KPI.
21. **OQ8 position:** audit_events are **never modified by erasure**; the 6-month auto-expiry is the accepted bound for actor names **pending external legal confirmation** (added to the legal-review bundle, alongside the lawful-basis note for pseudonymous `user_id_snapshot` retention). Durable erasure evidence = acceptance tombstones + `erasure_records`.
22. **OQ10 resolved:** MediaPreview renders `<track>` elements when a caption stream exists; MVP renditions do not extract or generate caption tracks (per UX pragmatic stance).
23. **TUS consent-gate residual stated:** chunk traffic is gated by Storage RLS + ≤10-min JWT TTL; the commit endpoint is the authoritative consent/revocation checkpoint — a revoked/withdrawn user can push chunks for at most ~10 minutes but can never commit. Accepted.
24. **Sentry retention** noted for the processor inventory when introduced (EU event data, US control-plane metadata, 30–90 day retention per plan) — **Sentry is deferred to post-MVP (2026-07-08); not part of the MVP processor set.**

### Gap Analysis Results

- **Critical gaps:** 4 found (PII erasure mechanism, originals backup, auth-mail tracking seam, offboarding data map) — **all resolved** (items 1–4).
- **Important gaps:** 15 found (upload schemas, checksum ambiguity, SLA scope, queue predicate, star route, revocation mechanics, indexes, token seam, email cap, erasure fan-out, FR15, OQ dispositions…) — **all resolved** (items 5–22).
- **Minor/accepted residuals:** TUS chunk-window exposure (item 23); export_items name slugs retained post-erasure (legal bundle — **accepted** by legal 2026-07-08); UI copy language **resolved → Swedish** (2026-07-08); HMAC key rotation procedure deferred to ops runbook.

### Architecture Completeness Checklist

**✅ Requirements Analysis** — context, scale, constraints, cross-cutting concerns mapped (step 2, adversarially critiqued)
**✅ Architectural Decisions** — stack fully specified with web-verified versions; providers verified against hard criteria (46elks cap, Brevo webhooks/EU, Sentry EU)
**✅ Implementation Patterns** — naming/structure/format/communication/process pinned; three-critic review integrated; closed audit registry; enforcement rules
**✅ Project Structure** — complete tree; FR→structure mapping; boundaries; two-agent verification integrated
**✅ Validation** — coherence corrected in place; NFR walk 20/20 addressed; readiness probes pass with decisions 1–24 applied

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**
**Confidence: HIGH** — every section was adversarially reviewed at creation and the whole document was re-validated by four independent agents; all critical and important findings are resolved with binding decisions.

**Key strengths:** compliance spine (consent gating, tamper-evident records with a workable erasure story, complete offboarding data map); the upload/transcode contract specified to wire level; role separation that makes praise/triage leaks type errors; right-sized throughout (polling over realtime, no CDN, no search engine) with documented guardrails against over-engineering.

**Pre-launch external gates — ALL RESOLVED 2026-07-08** (see `launch-decisions.md`): consent-text legal review + Art. 17 bundle **approved**; HR runbook **adopted**; no brand typeface → **Inter self-hosted**; SMS cap **200 SEK/mo**; UI copy language **Swedish**; US-processor legal bar **accepted** (EU regions under SCC/DPA). Only the tested backup/restore drill (Story 7.6) remains as a pre-go-live ops task.

### Implementation Handoff

**AI Agent Guidelines:** follow the architectural decisions exactly as documented; the Implementation Patterns section (as amended by Project Structure and this section's decisions 1–24) is the consistency contract; the DAL is the choke point — build it first; when this document and an earlier section conflict, the later section governs (amendments are authoritative).

**First implementation priority:**

```bash
npx create-next-app@latest stena-content-portal -e with-supabase
npx shadcn@latest init -b radix
# + adaptations 1–5 (OTP swap, Radix re-init, proxy.ts rename, eu-north-1, root→src/)
```

followed by the Decision Impact Analysis implementation sequence (scaffold → data model → auth spine → upload/transcode → library/triage/export → messaging → cron/CI).
