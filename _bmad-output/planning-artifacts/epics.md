---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
completedAt: '2026-07-08'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/consent-cards.md'
  - '_bmad-output/planning-artifacts/offboarding-erasure-runbook.md'
---

# stena-content-portal - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for stena-content-portal, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Authentication & Access (MVP)**

- FR1: Users (ambassadors and admins) can log in via a short-lived, single-use magic link sent to their email; no passwords exist in the system
- FR2: Ambassadors can activate their account through an invitation email that doubles as their first login
- FR3: Users can request a fresh login link when a link has expired or been used
- FR4: The system suppresses all task and message sends to inactive accounts

**Consent & Terms (MVP)**

- FR5: Ambassadors are presented with plain-language consent cards (with full legal text accessible) on first login and must accept all terms before their account activates
- FR6: The system stores an acceptance record (user, terms version, timestamp) for every acceptance
- FR7: Ambassadors can decline terms, which sets their account inactive without deleting anything; they can return and accept later without admin intervention
- FR8: The system maintains versioned terms; when terms change, users must re-accept on next login before continuing

**Content Contribution (MVP)**

- FR9: Ambassadors can batch-upload photos/videos (two or more in one action) from their device (camera roll or file picker) without per-file forms; no fixed batch limit — bounded only by per-file size caps
- FR10: Ambassadors can capture a photo or video directly with the device camera and upload it in the same flow
- FR11: The system validates file type and size limits (per-type caps) before an upload begins and explains any rejection by stating the specific limit and remedy (e.g., "Videos can be up to 2 GB / ~5 min — trim the clip and try again")
- FR12: Uploads automatically recover from connection interruptions without user intervention or visible failure
- FR13: Ambassadors can add descriptions to their uploads
- FR14: Ambassadors can view their own uploads and delete any of them at any time
- FR15: Uploads made in the context of a task are automatically linked to that task

**Content Requests & Messaging (MVP)**

- FR16: Admins can create a content request task addressed to one or more ambassadors
- FR17: Ambassadors can view their open and completed tasks in an in-app task list
- FR18: Either the ambassador or an admin can mark a task as done
- FR19: The system notifies ambassadors of new tasks via email, SMS, or both — the admin chooses the channel(s) per send
- FR20: Admins can send free-form messages via email and SMS to a single ambassador or to all active ambassadors

**Content Library & Organization (MVP)**

- FR21: Admins can browse all assets in one shared library regardless of origin (ambassador upload or admin brand asset)
- FR22: The system auto-derives each asset's content-type category from the file itself; no manual categorization
- FR23: The system generates web-friendly preview renditions and thumbnails for every asset, preserving originals untouched, and shows a processing state until ready
- FR24: Admins can filter the library by ambassador, content type, upload date, and tag/folder, and search by description and tags
- FR25: Admins can review new arrivals in a "new this week" triage queue with previews and single-action tagging/starring per item
- FR26: Admins can star/unstar assets as a quality signal; stars are shared across all admins and never visible to ambassadors
- FR27: Admins can create tags and assign/remove them on assets, including multi-select bulk tagging; tags are browsable as folders
- FR28: Admins can upload brand assets into the same library, marked as admin-origin
- FR29: Admins can delete any asset, including multi-select bulk deletion; deletes are permanent

**Export (MVP)**

- FR30: Admins can multi-select assets and export them as a zip with human-readable filenames (`{ambassador-name}-{upload-date}-{nn}`, where the sequence suffix disambiguates multiple files from the same ambassador and date)

**Ambassador Management (MVP)**

- FR31: Admins can invite ambassadors by email, and can activate, deactivate, or delete ambassador accounts
- FR32: Admins can view and maintain each ambassador's contact details (email, mobile) and see last-login/activity
- FR33: Admins can filter the library by a specific ambassador and bulk-delete their content (offboarding support)

**Audit & Governance (MVP)**

- FR34: The system logs audit events — uploads, deletions, exports, shares, used-confirmations — with actor and timestamp, from day one
- FR35: The system automatically deletes audit events older than 6 months; terms-acceptance records are exempt and retained
- FR36: The system surfaces a clear "budget reached" message naming the blocked action — never a raw provider error — when a provider spending cap (SMS, later AI) blocks an action

**AI Content Generation (v1.1)**

- FR37: Admins can generate new content by providing a prompt, selecting source assets, and choosing output type and settings
- FR38: Generated assets appear in the library as generated-origin, with tags, filters, starring, and export working as for any asset
- FR39: Admins can iteratively re-prompt a generated asset; each iteration creates a new version with prior versions revisitable
- FR40: The system records each generated asset's source assets (family tree); deleting a source warns about affected generated children
- FR41: When a generated asset is used, "used" credit propagates to the source uploads' ambassadors

**Social Sharing & Usage Tracking (v1.1)**

- FR42: Admins can share an asset to LinkedIn with a caption directly from the portal; shares are recorded as usage events
- FR43: The system prompts admins after zip exports to confirm which exported items were published (per-item check-off)
- FR44: Ambassadors are notified when their content is used in published material, and their profile shows a usage counter

**Campaigns & Engagement (v1.1)**

- FR45: Admins can create campaigns and link tasks, assets, shares, and usage to them
- FR46: Admins can send task links that open directly into the upload/capture flow via tokenized 1:1 magic links
- FR47: All users can view a top-5 ambassador leaderboard with all-time and rolling 3-month windows, ranked by uploads and used uploads
- FR48: Admins can view a stats page (uploads over time, % used, campaigns, top content) and browse the audit trail in a viewer UI

### NonFunctional Requirements

**Performance**

- NFR1: Task link → interactive upload screen in < 3 s on a 4G mobile connection; the full task-to-upload journey completes in < 2 min. *(Architecture OQ1 resolution: MVP contract = notification link → interactive task list < 3 s on 4G; literal upload-screen target activates with v1.1 tokenized links)*
- NFR2: Library and triage thumbnails render in < 200 ms of entering the viewport (pre-generated renditions, lazy loading); video previews start playback in < 2 s
- NFR3: Preview renditions and thumbnails are available within 5 minutes of upload completion for a max-size (2 GB) video, sooner for smaller files (async pipeline); the UI shows a processing state, never a broken preview. *(Architecture: SLA is per-asset under normal load)*
- NFR4: Upload of a max-size file (2 GB video) succeeds on an unstable connection via chunked auto-retry, with progress visible throughout
- NFR5: Library interactions (filter, search, tag, star) respond in < 500 ms at expected library sizes (thousands of assets over years)

**Security & Privacy**

- NFR6: All data encrypted in transit (TLS) and at rest, including original media files
- NFR7: Magic-link tokens are single-use and short-lived (architecture: 15 min); consumed or expired links cannot authenticate; no credentials stored anywhere
- NFR8: Role separation enforced server-side: ambassadors can only access their own uploads and profile; admin capabilities (library, triage signals, management, messaging) are inaccessible to ambassador sessions
- NFR9: All personal data (contact details, media, acceptance records, audit events) is stored and processed exclusively in EU regions, including third-party processors (transcoding, SMS, later AI)
- NFR10: Terms-acceptance records are append-only and tamper-evident — any modification is detectable (architecture: INSERT-only grants + per-record HMAC chain) — and retained as long as the related account/content exists; audit events are immutable during their 6-month lifetime
- NFR11: Erasure operations (offboarding runbook) achieve complete removal — originals, renditions, and derived data — supporting the 30-day GDPR response window

**Reliability & Data Integrity**

- NFR12: Original files are preserved bit-exact as uploaded; transcoding never modifies or replaces originals
- NFR13: No partial uploads enter the library — an upload either completes and appears, or fails cleanly and invisibly to admins
- NFR14: Magic-link and notification email/SMS delivery is launch-critical: delivery failures are logged and surfaced to admins (a message that silently never arrives = an ambassador who can never log in)
- NFR15: Availability matches internal-tool expectations — business-hours reliability; brief maintenance windows acceptable; no formal HA/uptime SLA required
- NFR16: Data loss tolerance for originals and acceptance records: RPO ≤ 24 hours, RTO ≤ 1 business day — backups with tested restore required

**Storage & Capacity**

- NFR17: Storage must handle indefinite retention of original-format media (hundreds of GB → low TB over the first years) without architectural change; storage cost is surfaced as a running-cost line for stakeholder sign-off

**Accessibility**

- NFR18: WCAG 2.1 AA intent as engineering discipline: semantic HTML, full keyboard operability, sufficient contrast, visible focus states, labeled controls; no formal audit/certification gate

**Integration Quality**

- NFR19: SMS and email providers must support provider-side spending caps; when a cap blocks an action, the user sees a clear "budget reached" message, never a raw provider error. *(Architecture OQ6 resolution: Brevo plan-level daily quota accepted as the de facto email cap)*
- NFR20: Provider outages degrade gracefully: an SMS-provider failure must not block email notification paths or any in-app functionality

### Additional Requirements

**Starter Template (Epic 1, Story 1 — mandated by Architecture)**

- AR1: Project scaffolded from the official `with-supabase` Next.js example: `npx create-next-app@latest stena-content-portal -e with-supabase`, then `npx shadcn@latest init -b radix` (Radix explicitly — Base UI is the current shadcn default). Required scaffold-time adaptations: (1) swap template password-auth for `signInWithOtp` magic-link flows, (2) apply Fleet Deck tokens, (3) rename `middleware.ts` → `proxy.ts` (Next 16), (4) create Supabase project in eu-north-1 (Stockholm) before any data exists, (5) root → `src/` layout

**Platform, Infrastructure & Region Constraints**

- AR2: Supabase (EU, Stockholm) is the backend platform: Postgres, Auth, Storage (TUS), Queues (pgmq), Cron (pg_cron). Region is immutable — must be EU on day one
- AR3: App hosting on Vercel Pro with functions pinned to arn1 (Stockholm); media bytes never transit Vercel (TUS direct-to-storage up, 302 signed URLs down)
- AR4: Transcoding/export worker hosted on Railway (EU West, Amsterdam): Docker service with ffmpeg 8.1.x static build + sharp; long-polls pgmq via `read_with_poll` over a Postgres session connection; worker ↔ app communicate only through Postgres and object storage
- AR5: Observability — **MVP ships NO Sentry (deferred to post-MVP, decision 2026-07-08, `launch-decisions.md`).** Unexpected errors and critical alerts route through a runtime-neutral error-logging seam (`src/shared/logger.ts`, app + worker) writing structured JSON to stdout, captured by Vercel + Railway platform logs (both EU). Post-MVP swaps **Sentry EU (Frankfurt)** in behind the same seam (org created EU from day one, immutable; app + worker instrumented)
- AR6: CI/CD via GitHub Actions: typecheck → lint → Vitest → Playwright + axe-core → on main: `supabase db push` (migrations) → `railway up` (worker); Vercel deploys via git integration gated by checks
- AR7: Testing stack: Vitest (co-located unit tests for DAL functions), Playwright e2e for journey-level specs (onboarding-consent, task-upload, triage, library-export, offboarding) with axe checks inside critical-flow specs; upload torture test and throttled-4G task-link→upload check in the e2e plan
- AR8: Running cost envelope ≈ $50–90/month surfaced as the NFR17 stakeholder cost line

**Data Layer & Modeling**

- AR9: Drizzle ORM (pinned versions) with `drizzle-kit generate` → `supabase/migrations` applied via Supabase CLI; never `drizzle-kit push` against prod; transaction-mode pooling (port 6543, `prepare: false`) from Vercel; session/direct connections for worker and migrations
- AR10: Zod v4 as the single validation layer shared client/server; per-type size caps and error copy defined once in `src/shared/limits.ts`, consumed by client validation and server enforcement
- AR11: Single `assets` table with three-value `origin` enum (`ambassador|admin|generated`) from day one; text columns + CHECK constraints instead of pgEnum; v1.1 seams provisioned now: provenance/version columns in asset identity, nullable campaign seams on tasks/events, purpose param in `/auth/confirm`
- AR12: Four retention classes as separate tables/lifecycles: content (until deleted, then gone); `audit_events` (INSERT-only, 6-month pg_cron expiry scoped to that table only, entity snapshots — never FK to live rows); `acceptance_records` (INSERT-only, indefinite, no FK to users, denormalized identity snapshots); durable usage/export/send event tables (no expiry; mutable only for erasure attribution purges)
- AR13: Tamper evidence (NFR10): acceptance records get a per-record HMAC chain (key `ACCEPTANCE_HMAC_KEY` in app+worker env, never in DB); PII snapshot columns encrypted per-user (crypto-shredding via `consent_pii_keys` table); Art. 17 erasure deletes the key and appends a signed tombstone; scheduled worker job `verify-acceptance-chain` alerts via the error-logging seam on failure (Sentry post-MVP)
- AR14: KPI columns are an MVP schema requirement (durable, never derived from expiring audit log): `profiles.invited_at/first_accepted_at/first_upload_at/last_login_at`; `tasks.created_at/fulfilled_at`; `task_recipients.completed_at` — task completion is per-recipient; `tasks.fulfilled_at` = first recipient completion
- AR15: `tasks.due_at` (nullable) — display-only (TaskCard "Due" badge and expired-quiet state); no enforcement, no reminders, no KPI effect
- AR16: FR15 mechanics: `assets.task_id` nullable FK set by upload-init when entering from a task, validated against an open task addressed to the session user
- AR17: Named indexes for NFR5 (assets created_at DESC, uploader_id, type, partial triaged_at, asset_tags, send_records provider_message_id UNIQUE); search = GIN tsvector over description + tag names (`simple` config)

**Auth, Sessions & Authorization**

- AR18: Supabase Auth magic links only (`signInWithOtp`, PKCE; invite flow via Supabase invite email); one link-consumption front door `/auth/confirm` (token_hash verification → session → `next` continuation, relative allow-listed paths); `/auth/error` landing for expired/used links with one-tap re-request (FR3)
- AR19: Session policy: access-token JWT 10 min; rotating refresh tokens; ~30-day inactivity timeout + ~180-day time-box; magic link 15 min single-use
- AR20: Revocation + consent gate: every authenticated request passes through the server-only DAL calling `getUser()` (network-validated) + consent-version check; `proxy.ts` does only cheap `getClaims()` routing; deactivate/delete/withdraw call `auth.admin.signOut(userId)` (all devices)
- AR21: Three auth contexts, enumerated: `requireUser()` (ambassador default: user + account-state + consent gate), `requireAdmin()` (no consent gate — consent cards apply to ambassadors only), `requireUserPreConsent()` (only for consent DAL functions), `systemContext()` (webhooks + cron; actor 'system')
- AR22: Authorization model: server-only DAL + RLS backstop. Browser supabase-js used ONLY for Auth and Storage TUS uploads; all table access via role-scoped DAL modules; ambassador DAL files structurally contain no triage-signal joins; role-scoped wire types omit admin fields at the type level (leaks become type errors); storage buckets private with short-lived signed URLs via app 302 redirects
- AR23: Account state machine: `invited|active|inactive_declined|inactive_withdrawn|deactivated` on `profiles` (deletion removes the row — not a state); consumed by auth middleware, sends, revocation, admin UI; `/auth/confirm` post-verification routing per state (inactive → consent cards; deactivated → paused screen with DAL returning ACCOUNT_INACTIVE 403)
- AR24: Admin provisioning via `scripts/create-admin.ts` (service role: `app_metadata.admin` + profile row); first admin seeded manually; `admin` flag server-settable only
- AR25: Terms publishing via `scripts/publish-terms.ts` (new terms version through consent DAL, emits `terms.version_created`); versioning machinery must exist before external legal review completes

**Upload Pipeline & Media Processing**

- AR26: Upload wiring: Uppy 5 → Supabase Storage TUS endpoint, chunk size exactly 6 MB (Supabase-mandated, never change), retryDelays [0,3s,5s,10s,20s], dynamic session-token headers (401 on chunk = refresh-and-retry), Golden-Retriever-style state persistence for interruption safety
- AR27: Staging-commit protocol (NFR13): upload-init creates asset row (`processing_status: 'pending'`, library-invisible) returning assetId + object key; commit endpoint verifies via S3 HEAD (existence + size vs declaredSize + leading-bytes type sniff), flips status to `processing`, enqueues `transcode_jobs` in the same transaction; commit idempotent; failures map to FILE_TOO_LARGE / UNSUPPORTED_FILE_TYPE (staged object deleted) or UPLOAD_INCOMPLETE 409 (row stays pending for retry-or-GC). Checksum deliberately not implemented — TUS offset completion + size match is the commit gate
- AR28: Three private buckets: `originals` (immutable), `renditions` (regenerable, worker-written only), `exports` (regenerable zips, 7-day TTL); keys `assets/{assetId}/original.{ext}`, `assets/{assetId}/{kind}.{ext}`, `exports/{exportId}.zip`; Storage RLS INSERT policy pins originals writes to the uploader's pending asset
- AR29: Orphan GC: daily worker job deletes storage prefixes AND pending rows for uploads still `pending` after 24 h; weekly diff-sweep of storage prefixes vs live asset ids
- AR30: Renditions in their own table; canonical kinds — image: thumb (webp ~400px) + preview (webp ~1600px); video: poster (jpg) + thumb (webp) + preview (faststart mp4 720p); audio/doc: none (type icon). Partial rendition failure = asset `failed` (all-or-nothing); failed jobs delete partial renditions; retry via `POST /api/assets/[assetId]/retry-processing`; worker runs 2 concurrent ffmpeg jobs; HEIC/HEVC conversion in transcoding only (ffmpeg 8.1+ for tiled HEIC)
- AR31: Video duration cap is advisory copy only (2 GB size is the enforced limit; no duration probe in MVP)
- AR32: Media URL pattern: JSON carries stable app URLs only — `/api/assets/[assetId]/file?kind=thumb|preview|original` → DAL access check → 302 to 60 s signed URL; thumb/preview 302s set `Cache-Control: private, max-age=300`; browser never mints read URLs

**Messaging & Delivery**

- AR33: Email via Brevo (EU): SMTP relay for Supabase Auth magic links (raise default 30/hr auth email limit), HTTP API + per-recipient webhooks for app sends; SMS via 46elks (Sweden): prepaid balance = provider-side hard cap, `whendelivered` webhooks; operational rules: stay on prepaid, note 200-day credit expiry, record 46elks as independent data controller; Twilio documented as fallback adapter only
- AR34: Channel adapters (`brevo.ts`, `elks.ts`) are the only modules touching provider APIs; independent per-channel dispatch with bounded timeouts (SMS failure never blocks email — NFR20); per-recipient `send_records`; send-suppression for inactive accounts enforced in the dispatch path; persisted binary SMS budget state (403 "Not enough credits" → flag, disable SMS pre-send until balance restored via `/me` polling); Brevo quota-exceeded maps to BUDGET_REACHED
- AR35: Webhooks `/api/webhooks/brevo` + `/api/webhooks/46elks`: verify signature/Basic-auth before parsing (unverified → 401 no detail); resolve by provider_message_id (UNIQUE); monotonic status lattice (never downgrade `delivered`); append raw payload; 200 for unknown ids (log via the error-logging seam)
- AR36: Auth email delivery tracking: Supabase Send-Email hook dispatches magic-link/invite emails through the app's Brevo adapter so every auth email gets a send_record + webhook tracking; bounced invites surface on the admin messages page (verify hook capability at implementation time; fallback: ingest unknown-id Brevo webhooks keyed by recipient + template class)
- AR37: SPF/DKIM/DMARC configuration against Stena's actual mail environment is a launch-checklist item (magic links are the only way in)

**Deletion, Erasure & Backups**

- AR38: One deletion path: `deleteAssets(assetIds, { mode: 'delete' | 'erasure' })` in `src/lib/deletion.ts` — `delete` removes originals/renditions/derived + rows, preserves usage/export event rows; `erasure` additionally purges event attributions, purges recipient PII in send_records, force-expires export zips referencing erased assets, sweeps the backup replica, triggers acceptance-record crypto-shred + tombstone. Delete-own and admin-delete = `delete`; offboarding bulk = `erasure`. Triage dismiss is `markTriaged()` — never sharing a code path with deletion
- AR39: Offboarding erasure protocol (ordered): (1) deactivate + global signOut; (2) `deleteAssets(mode: 'erasure')`; (3) `deleteAccount(profileId)` — auth user + profiles row deleted, task_recipients deleted, send_records PII nulled, acceptance crypto-shred + tombstone; (4) durable `erasure_records` row (executor, when, counts — no subject PII) so evidence survives audit expiry
- AR40: Generated-children hook is a code artifact from MVP: `getDeletionImpact(assetIds)` → `{count, generatedChildren: []}` runs before every ConsequenceDialog; MVP returns empty children; v1.1 fills from provenance edges
- AR41: Bulk-erasure execution: DB-row deletion synchronous (assets vanish immediately); storage fan-out inline for ≤ 50 objects, else via `maintenance_jobs`
- AR42: Backups: Supabase Pro daily DB backups with retention documented ≤ 30 days (erased data ages out within Art. 17 window); nightly worker job replicates `originals` bucket to a second EU bucket (RPO ≤ 24 h); erasure sweeps the replica; replica retention ≤ 30 days for deleted objects; tested restore exercise (DB + storage) is a named launch gate with a documented runbook including a re-apply-erasures step

**Audit & Background Jobs**

- AR43: Audit emission via single `audit.emit(tx, …)` in `src/shared` accepting only the closed `AUDIT_EVENTS` registry (dot-notation `entity.verb`, past tense; v1.1 types `asset.shared`/`asset.used_confirmed` in the taxonomy from day one); called inside the mutation transaction; triage verbs, delivery-status updates, and tag CRUD deliberately unaudited; storage-coupled mutations commit DB rows + audit first, storage ops after commit
- AR44: Job substrate: pgmq queues (`transcode_jobs`, `export_jobs`, `maintenance_jobs`), versioned Zod-validated payloads `{v: 1, …}`, idempotent handlers (status-column check, "already done" = success), max 3 receives → archive + mark failed (UI-retryable); pg_cron: audit-expiry SQL direct, `maintenance_jobs` enqueues (orphan-GC daily, chain-verify daily, export-zip cleanup, nightly originals replication)
- AR45: Async status propagation by polling (TanStack Query `refetchInterval`): processing 3 s, exports 5 s, delivery 15 s — all stop on terminal states; no websockets/SSE

**Export**

- AR46: Async multi-GB zip export: `POST /api/exports` (size estimate → export_record + `export_jobs`) → worker streams originals → zip in `exports` bucket → poll → "export ready" → 302 download; durable itemized export records (`export_records` + `export_items` — the FR43 v1.1 check-off seam)
- AR47: Export naming in runtime-neutral `src/shared/export-naming.ts` (worker + app import): slug = lowercase, NFC-normalize, å/ä→a, ö→o, non-alnum→hyphen; date = Europe/Stockholm calendar date of upload completion; `nn` = zero-padded sequence per (ambassador, date) within the export ordered by created_at; original extension preserved

**Triage Semantics**

- AR48: Queue predicate: `triaged_at IS NULL AND processing_status IN ('processing','ready')`, all origins, ordered `created_at ASC`; "new this week" is display copy — untriaged items persist until triaged
- AR49: Star route `POST/DELETE /api/assets/[assetId]/star`; star/tag endpoints set `triaged_at` server-side as side effect; library bulk-tags does NOT set `triaged_at` (bulk ops are not triage)
- AR50: Multi-admin model: last-write-wins on all triage verbs; `triaged_at` is a shared flag; Z-undo clears it regardless of who set it; queue position is per-admin client state; asset deleted while viewed advances the queue with a quiet notice (standard NOT_FOUND envelope)

**API, Errors & Frontend Conventions**

- AR51: API surface: server components for reads, route handlers for client-interactive mutations and webhooks, server actions only for simple non-interactive form posts (consent accept/decline, login email); no separate API tier, no versioning; lists always `{ items, nextCursor }` (opaque keyset cursor)
- AR52: Error envelope `{ error: { code, message, remedy? } }` with canonical code→HTTP map (incl. CONSENT_REQUIRED 409 with `next`, BUDGET_REACHED 429, LINK_EXPIRED 410, UPLOAD_INCOMPLETE 409); typed DomainError subclasses in DAL; global QueryCache onError routes SESSION_REVOKED → login and CONSENT_REQUIRED → consent (features never handle these locally); provider errors normalized at adapter boundary (FR36); unexpected errors go to the error-logging seam (`src/shared/logger.ts` — structured platform logs in MVP, Sentry post-MVP)
- AR53: Frontend stack: TanStack Query 5 (RSC prefetch + HydrationBoundary), nuqs for URL-canonical filter state, react-hook-form + Zod 4, TanStack Virtual for GalleryGrid; route groups `(ambassador)` (root URLs, `/` → `/tasks`) and `(admin)` (`/admin/*` URLs); optimistic-update verb table: OPTIMISTIC star/tag; SERVER-ACK dismiss/mark-done/sends/profile edits; NEVER optimistic uploads/processing/exports/consent/deletion/budget
- AR54: Project structure per architecture tree: `features/<feature>/{dal,queries,components,schemas,hooks}`, server-only DAL boundary (route handlers never import db client), runtime-neutral `src/shared` kernel (no next/React/server-only — worker imports it), worker imports only `src/db/schema` + `src/shared` + worker-local lib (eslint `no-restricted-imports` enforced); features never import each other's DAL; kebab-case files; `Row`-suffix type rule; timestamps rendered Europe/Stockholm via one Intl helper, wire stays UTC ISO
- AR55: Enforcement rules for AI agents (architecture "Enforcement Guidelines"): DAL-only table access with correct auth context; tx-threaded audit emission from the closed registry; limits/slugs/naming/queue schemas from `src/shared` only; never change 6 MB chunk size, bypass staging commit, add UPDATE paths or FKs to acceptance_records/audit_events, or let expiry cron touch other tables; co-located DAL tests + Playwright for journey changes; typecheck + lint + tests before completion

**Non-Code Launch Gates (tracked, not stories)**

- AR56: Non-code launch gates — **ALL RESOLVED 2026-07-08** (see `launch-decisions.md`): consent-text legal review + Art. 17 bundle (audit actor names, export-slug retention, user_id_snapshot basis) **approved**; erasure runbook **adopted by HR** (owner: HR Manager); **no Stena brand typeface/webfont exists → Inter (SIL OFL), self-hosted**; SMS cap **200 SEK/month** (46elks prepaid); **UI copy language = Swedish** (all user-facing surfaces); US-processor legal bar **accepted** (Supabase/Vercel/Railway US-owned, EU regions under SCC DPAs). Remaining pre-launch task: tested backup/restore drill (Story 7.6)
- AR57: Localization — **all user-facing copy is Swedish** (consent cards, email/SMS templates, buttons, empty states, errors, celebration copy); code/DB identifiers/audit-event strings/dev-docs stay English; date & number formatting uses `sv-SE` (timestamps still Europe/Stockholm); the `simple` GIN tsvector config already suits Swedish names (Architecture item 18)

### UX Design Requirements

**Design Tokens & Visual Foundation**

- UX-DR1: Implement Fleet Deck (direction 1) design tokens in Tailwind v4 CSS-first config: semantic color roles from the Stena brand palette only — `surface` White, `surface-panel` Beige, `surface-media` Black, `action-primary` Core Blue, `link` #3344dd, `focus-ring` #3344dd, `info/selected-bg` Light Blue, `destructive` Core Red, `caution-bg` Pink, `celebration` Core Blue on Light Blue, `star` Core Blue filled; no off-palette values; Green/Yellow brand-reserved and never used
- UX-DR2: Color usage rules enforced: blue leads, red = destructive/error only; Light Blue/Pink never leave the app (outbound email/SMS use Core Blue/white/black only); blue never stacks meanings (selection = Light Blue, star = only Core Blue mark on media, link-blue = text links and focus rings alone)
- UX-DR3: Typography: type scale (display 28/34 → caption 12/16, tabular numerals for counts) on **Inter (SIL OFL), self-hosted** (resolved 2026-07-08 — no Stena brand typeface exists; not loaded from Google Fonts CDN, GDPR); validate scale against Inter's metrics; 16 px mobile input minimum is non-negotiable; sentence case everywhere; **all copy in Swedish** (AR57)
- UX-DR4: Spacing & layout: 4 px base unit scale; ambassador surface single-column 16 px margins, bottom-anchored primary CTA, touch targets ≥ 44 px; admin surface 12-col grid, max 1440 px, 256 px filter rail, compact density (32 px rows); media grids square 1:1 thumbs; flat-first elevation, 8 px card / 6 px control radius
- UX-DR5: Derived values **APPROVED 2026-07-08** (see `launch-decisions.md`): blue-based success/celebration (Core Blue on Light Blue, not green); Core Blue filled star (not yellow); hover/pressed tints ±8–12% lightness — Fleet Deck token set now fully locked

**Signature Custom Components**

- UX-DR6: ConsentCardStack — progress dots, one beige card at a time (icon, h2, plain-language body, "full legal text" link opening a sheet), per-card "I agree" ≥ 44 px, final card adds quiet Decline; states: active/agreed/all-agreed/declined/re-accept variant (banner "Our terms have changed — here's what's new" with changed card highlighted); focus-trapped stepper, screen-reader position announcements; card text verbatim from consent-cards.md, never edited in the UI layer
- UX-DR7: UploadManager + ProgressStrip — selection review grid with per-file size check; persistent light-blue progress strip ("Uploading 3 of 12 — safe to switch apps, we'll resume", thin bar, per-file ticks); states: validating / partial-reject (grayed file + reason + remedy, others proceed) / uploading / retrying (visually identical to uploading) / paused-in-background / interrupted-recoverable (silent) / failed-final (soft-edge + auto-retry notice) / delivered; survives navigation and backgrounding with state restored; optional description fields never blocking; `aria-live="polite"` sentence-level milestones
- UX-DR8: TriageQueue — full-screen shell on `surface-media` black; large MediaPreview + context line (ambassador · task · date · size) + verb bar + "12 of 40" progress; keyboard verbs: T tag, S star, X dismiss (Z undoes), →/← navigate, space play/pause; all reversible, none confirm; auto-advance after dismiss only; ← revisits with verbs toggleable; processing items allow star/tag, playback waits; queue-clear celebration summary ("40 reviewed, 9 starred, 31 tagged") with Go-to-starred / Back-to-library exits; on-screen buttons mirror every key; keyboard legend until first use; abandoning mid-session restores position ("12 triaged · 28 left")
- UX-DR9: GalleryGrid — square thumbs, scrim'd meta line, star indicator, tag chip overflow, video duration + play glyph; selection = light-blue ring + black check; hover scrub + quick verbs on desktop, long-press selection on touch; shift-click range, ctrl/cmd toggle; virtualized for thousands of assets with roving tabindex, aria-rowcount, scroll-restore; variants: ambassador My-uploads (delete-own), admin library (full verbs), starred view; empty state with warm illustration + primary action; skeleton loading tiles
- UX-DR10: MediaPreview — black surround, aspect-fit rendition (never original except explicit request); video tap-play mobile / hover-scrub desktop, playback < 2 s; processing state ("Processing preview — ready soon" on light-blue placeholder with original filename); rendition-failed shows calm retry, never a broken-image icon; renders `<track>` caption elements when a stream exists (MVP does not generate captions); Esc closes with focus returned to origin tile
- UX-DR11: TaskCard — beige card with badge (New/Due/Completed), title, "From {admin} · {context}", single primary Add content button; states new / in-progress (delivered count) / completed / expired-quiet; the only CTA on ambassador home
- UX-DR12: TagPicker — type-ahead combobox over existing tags + "Create '{query}'" row; multi-assign; removable chips inline; same component in triage (keyboard-summoned) and library bulk-tag
- UX-DR13: SelectionBar — slides up when selection > 0: "{n} selected · {~size} · Tag · Export zip · Delete · Clear"; size estimate before export commit ("40 files · ~4.3 GB"); delete routes through ConsequenceDialog; sticky bottom on desktop library
- UX-DR14: ConsequenceDialog — destructive confirmations as consequence summaries: what, how many, permanence line ("This can't be undone — the audit log records it"), "already-exported copies are not recalled" note, v1.1 generated-children list slot; red confirm labeled verb + count ("Delete 34 assets"), never "OK"
- UX-DR15: CelebrationMoment — one-shot completion treatment (Core Blue + Light Blue, icon, specific context text) for delivered batches, cleared queues, (v1.1) usage notifications; static variant under `prefers-reduced-motion`; auto-dismisses, never gates

**Interaction & Consistency Patterns**

- UX-DR16: Button hierarchy: exactly one primary (Core Blue filled) per view, bottom-anchored on mobile; secondary bordered (white-filled on beige panels); tertiary link-blue text; destructive Core Red appears only inside ConsequenceDialog; labels verb + object, never OK/Submit; loading keeps label with inline spinner; disabled buttons explain via adjacent helper text
- UX-DR17: Soft-edge error pattern (mandatory structure): what happened → why → remedy as the primary button; pink caution-bg panel, black text, red icon; budget-cap message names the blocked action ("SMS budget reached — this message wasn't sent. Email still works.")
- UX-DR18: Feedback: inline state change first; CelebrationMoment only for loop completions; toasts reserved for background events finishing off-screen; ambient status (light-blue strips/placeholders in layout, never over it); no blocking spinners anywhere; `aria-live` polite for status, assertive only for failed-final
- UX-DR19: Form patterns: single column, labels above, "(optional)" marking (required is the exception), validate on blur + submit, errors never clear input; 16 px inputs, purpose-matched keyboards, autofocus only on single-field screens; admin compose pattern: recipient chips (individuals or "all active"), Email/SMS/Both toggle, SMS character counter with hard stop + send-count line ("1 SMS × 3 recipients"), preview showing personal sender framing; SMS budget-reached disables the option pre-send with friendly notice; inactive ambassadors unselectable with quiet "paused" note
- UX-DR20: Navigation: ambassador bottom tab bar (Tasks, Upload, My uploads, Profile) with blue active states and light-blue badge counts; admin top bar + left rail (views, tag folders, filter groups), no breadcrumbs; full-screen overlays entered from library, exited Esc/back/X with focus return, never stacked; browser back always works; filter combinations URL-encoded (bookmarkable/shareable)
- UX-DR21: Empty states are invitations (name why + next action, warm tone); skeletons only after 200 ms delay; layout space reserved (no reflow); filters compose as removable chips with clear-all, live results < 500 ms, active-filter state always visible; modals/sheets for decisions and compose only (never status), bottom sheets mobile / centered dialogs desktop; relative dates in dense views, absolute on hover/detail; full names everywhere (slug form only in export filenames)
- UX-DR22: Outbound email/SMS templates are designed surfaces: personal sender framing ("Hi Jonas — Petra needs…"), exactly one action per message, core palette only, every link has a friendly expired-state landing; login email designed like a screen

**Flows & Screen Requirements**

- UX-DR23: Flow 1 onboarding: invite email → link → consent cards → active + land on task list; expired/used link → friendly expiry screen → one-tap fresh link; decline → warm pause screen naming what happens (paused, nothing deleted, how to return); return re-presents cards
- UX-DR24: Flow 2 fulfillment: session-alive → task list with new task highlighted (3 taps to picker, one confirm to upload start, zero typing on the happy path); expired session → one-field email screen (the only typing in the product); pending terms change interposes consent cards then continues to original destination; partial rejection never blocks valid files; MVP completion copy promises nothing MVP can't deliver (no "we'll tell you when it's used" line until v1.1)
- UX-DR25: Flow A2 spontaneous upload: Upload tab opens the same picker in ≤ 2 taps; adds exactly one optional field ("What's this from?"); lands in the same triage queue with context line "ambassador · spontaneous · date"
- UX-DR26: Flow 4 find & export: filters compose → multi-select → size estimate → async zip build with visible progress, safe to navigate away, "export ready" notice; export history + statuses page (/admin/exports)
- UX-DR27: Flow 5 offboarding UI mirrors the HR runbook step-for-step (deactivate → filter by ambassador → review → bulk delete → consequence summary → audit evidence); bystander erasure enters via search instead of ambassador filter
- UX-DR28: Flow 5b ambassador withdrawal: Profile → "Your consent" panel shows accepted terms version + date with cards re-viewable; three actions: Withdraw consent (ConsequenceDialog → pause state), Delete my uploads (delete-own), Request full removal (pre-filled message to HR, "HR will confirm removal within 30 days")
- UX-DR29: Flow 6 request/message compose: title + ask written like a person; recipient chips; channel choice with counters; pre-send SMS-budget notice; per-recipient delivery status recorded and failures surfaced admin-visibly with retry/fix-contact actions

**Responsive & Accessibility**

- UX-DR30: Responsive: ambassador surface designed 360–430 px, scales up to centered 560 px column, no feature differences; admin designed ≥ 1280 px, adapts down (tablet: rail drawer, tap verbs; phone: check-in mode — browse/search/preview/star/single-item only, bulk ops desktop/tablet-only with gentle "works best on a bigger screen" note, never a dead button); standard Tailwind breakpoints
- UX-DR31: Accessibility (NFR18 implementation): contrast solved at token level (brand AA+ pairings only); text over media always on 40–60% black scrim; full keyboard operability (triage keystrokes, roving tabindex, focus-trap/return, skip-to-content on admin); focus ring 2 px #3344dd offset 2 px on :focus-visible, never removed; color never carries meaning alone; `prefers-reduced-motion` honored; semantic HTML first; renditions with srcset + explicit dimensions; real labels + autocomplete/inputmode + aria-describedby errors
- UX-DR32: A11y/UX testing: axe-core in CI per build; keyboard-only pass per critical flow pre-release; VoiceOver iOS Safari (consent + upload) and NVDA desktop Chrome (triage + export) spot checks; real-device matrix against the actual ambassador group; throttled-4G task-link→upload run; upload torture test (airplane-mode toggles, app-switching, lock-screen cycles mid-transfer)

### FR Coverage Map

FR1: Epic 1 — Magic-link login, no passwords
FR2: Epic 1 — Invitation email doubles as first login (activation mechanism; invite issuance in Epic 2, full activation on consent in Epic 3)
FR3: Epic 1 — Request a fresh login link on expiry/use
FR4: Epic 5 — Suppress task/message sends to inactive accounts (account state established in Epic 2, enforced at dispatch in Epic 5)
FR5: Epic 3 — Consent cards on first login; accept-all to activate
FR6: Epic 3 — Acceptance records (user + terms version + timestamp)
FR7: Epic 3 — Decline → inactive without deletion; self-service return
FR8: Epic 3 — Versioned terms; re-accept on change before continuing
FR9: Epic 4 — Batch upload from camera roll / file picker, no per-file forms
FR10: Epic 4 — Capture photo/video with device camera in same flow
FR11: Epic 4 — Client-side type/size validation with specific limit + remedy
FR12: Epic 4 — Auto-recover from connection interruptions
FR13: Epic 4 — Add descriptions to uploads
FR14: Epic 4 — View and delete own uploads anytime
FR15: Epic 5 — Uploads in task context auto-linked to that task
FR16: Epic 5 — Create content-request task to one or more ambassadors
FR17: Epic 5 — In-app task list (open + completed)
FR18: Epic 5 — Either side marks task done
FR19: Epic 5 — New-task notifications via email/SMS/both, admin-chosen
FR20: Epic 5 — Free-form email/SMS to one or all active ambassadors
FR21: Epic 6 — Browse one shared library across all origins
FR22: Epic 4 — Auto-derive content-type category from the file
FR23: Epic 4 — Generate renditions + thumbnails, preserve originals, processing state
FR24: Epic 6 — Filter (ambassador/type/date/tag) and search (description/tags)
FR25: Epic 6 — "New this week" triage queue with previews + single-action verbs
FR26: Epic 6 — Star/unstar (admin-shared, ambassador-invisible)
FR27: Epic 6 — Create/assign/remove tags incl. bulk; tags browsable as folders
FR28: Epic 6 — Upload brand assets into the same library (admin-origin)
FR29: Epic 7 — Delete any asset incl. bulk; permanent
FR30: Epic 7 — Multi-select zip export with human-readable filenames
FR31: Epic 2 — Invite / activate / deactivate / delete ambassador accounts
FR32: Epic 2 — Maintain contact details; see last-login/activity
FR33: Epic 7 — Filter by ambassador + bulk-delete their content (offboarding)
FR34: Epic 1 — Audit events (actor + timestamp) from day one (single emitter, cross-cutting)
FR35: Epic 7 — Auto-expire audit events > 6 months; acceptance records exempt
FR36: Epic 5 — "Budget reached" message naming the blocked action
FR37: Epic 8 — Generate content from prompt + source assets + output settings (v1.1)
FR38: Epic 8 — Generated-origin assets full-featured in the library (v1.1)
FR39: Epic 8 — Iterative re-prompt with revisitable version history (v1.1)
FR40: Epic 8 — Source family tree; delete-source warns of generated children (v1.1)
FR41: Epic 8 — "Used" credit propagates to source ambassadors (v1.1)
FR42: Epic 9 — Share to LinkedIn with caption; recorded as usage event (v1.1)
FR43: Epic 9 — Post-export check-off of which items were published (v1.1)
FR44: Epic 9 — Usage notifications + profile usage counter (v1.1)
FR45: Epic 9 — Campaigns linking tasks/assets/shares/usage (v1.1)
FR46: Epic 9 — Tokenized 1:1 magic links straight into upload/capture (v1.1)
FR47: Epic 9 — Top-5 leaderboard (all-time + rolling 3-month) (v1.1)
FR48: Epic 9 — Stats page + audit-trail viewer UI (v1.1)

## Epic List

### Epic 1: Platform Foundation & Passwordless Access
Establishes the EU-pinned application on its confirmed stack (scaffold from the `with-supabase` example, Supabase Stockholm, Vercel arn1, Railway worker shell, structured error-logging seam, CI/CD — Sentry deferred to post-MVP) and delivers the auth spine: any provisioned user logs in through one magic-link front door with no passwords, sessions revoke immediately on demand, and requests pass through the server-only DAL choke point with role separation, the account state machine, the closed audit-event emitter, and the RLS backstop. After this epic a seeded admin can sign in, the Fleet Deck design tokens and base interaction patterns exist, and every later mutation is auditable and role-scoped by construction.
**FRs covered:** FR1, FR2, FR3, FR34
**NFRs:** NFR6, NFR7, NFR8, NFR9, NFR15, NFR18 (foundation)
**Architecture:** AR1–AR6, AR9–AR12, AR18–AR24, AR43, AR51–AR55
**UX:** UX-DR1–UX-DR5, UX-DR16–UX-DR22, UX-DR23 (expiry screen), UX-DR31

### Epic 2: Ambassador Accounts & Lifecycle Management
Gives admins the roster cockpit: invite ambassadors by email (the invite doubles as their first-login link), maintain each ambassador's contact details, see last-login/activity, and activate / deactivate / delete accounts — with deactivation and deletion driving the account-state machine and immediate all-device session revocation. After this epic an admin can populate and manage the ambassador population, the precondition for onboarding; the KPI `invited_at` clock starts here.
**FRs covered:** FR31, FR32
**NFRs:** NFR14 (auth-invite delivery — foundation), NFR8
**Architecture:** AR14 (KPI columns), AR23 (state machine consumers), AR24, AR39 (deleteAccount seam)
**UX:** UX-DR19 (invite form), UX-DR20 (admin nav), and the ambassador-table/detail screens

### Epic 3: Ambassador Onboarding & Consent
Turns an invited ambassador into an active contributor through consent-as-comprehension: three plain-language cards (verbatim from the versioned source of truth), tamper-evident acceptance records via the HMAC chain, a warm decline→pause→self-service-return path, and re-accept-on-terms-change interposed before any further action. After this epic the compliance spine that makes every future asset provably usable is complete and self-serve.
**FRs covered:** FR5, FR6, FR7, FR8
**NFRs:** NFR10
**Architecture:** AR13 (HMAC + crypto-shred foundation), AR21 (pre-consent context), AR23 (state routing), AR25 (publish-terms script)
**UX:** UX-DR6 (ConsentCardStack), UX-DR23 (decline/re-accept flow)

### Epic 4: Ambassador Contribution — Upload & Media Processing
Delivers the product's make-or-break 90-second moment and the async media pipeline behind it: batch camera-roll upload and in-flow capture with no per-file forms, client-side validation with friendly limits, interruption-safe chunked TUS upload (staging→atomic commit so no partial ever enters the library), optional descriptions, view/delete-own, and the transcoding worker that auto-derives type and produces thumbnails/renditions while showing an honest processing state. Standalone via the spontaneous-upload path; enriched with task context in Epic 5.
**FRs covered:** FR9, FR10, FR11, FR12, FR13, FR14, FR22, FR23
**NFRs:** NFR1, NFR2 (rendition production), NFR3, NFR4, NFR12, NFR13
**Architecture:** AR26–AR32, AR38 (delete-own = `delete` mode), AR44 (transcode queue), AR45 (processing poll)
**UX:** UX-DR7 (UploadManager), UX-DR9 (GalleryGrid My-uploads variant), UX-DR10 (MediaPreview), UX-DR24, UX-DR25 (spontaneous A2), UX-DR30

### Epic 5: Content Requests & Messaging
Builds the engine that keeps the library filling — the task-as-trigger loop — plus all outbound communication: admins compose content-request tasks to one or many ambassadors, ambassadors see and fulfill them from an in-app task list (uploads auto-linked to the task), either side marks done, and notifications and free-form messages go out over email and SMS with per-recipient delivery tracking, send-suppression for inactive accounts, graceful provider-outage isolation, and friendly budget-cap handling. Completes NFR14 by wrapping auth emails in the same tracked adapter.
**FRs covered:** FR4, FR15, FR16, FR17, FR18, FR19, FR20, FR36
**NFRs:** NFR14 (completed), NFR19, NFR20
**Architecture:** AR15 (due_at), AR16 (task_id linkage), AR33–AR37, AR52 (budget errors)
**UX:** UX-DR11 (TaskCard), UX-DR19 (admin compose), UX-DR22 (outbound templates), UX-DR29 (Flow 6)

### Epic 6: Admin Library, Triage & Curation
Gives admins the curation cockpit: one shared library across all origins with fast composable filters and search, the conveyor-belt "new this week" triage queue (keyboard tag/star/dismiss, one motion per item), admin-private starring, tags-rendered-as-folders with bulk tagging, and admin brand-asset uploads into the same library. After this epic the library is navigable, searchable, and organized — the surface every export and governance action operates on.
**FRs covered:** FR21, FR24, FR25, FR26, FR27, FR28
**NFRs:** NFR2 (thumbnails consumed), NFR5
**Architecture:** AR17 (indexes + GIN search), AR30 (renditions consumed), AR32 (media URLs), AR48–AR50 (triage semantics)
**UX:** UX-DR8 (TriageQueue), UX-DR9 (GalleryGrid admin variant), UX-DR12 (TagPicker), UX-DR21 (filters/empty/loading)

### Epic 7: Export, Deletion & Governance
Closes the MVP loop and makes the program provably compliant: async multi-GB zip export with human-readable filenames, consequence-first permanent deletion, the offboarding/erasure runbook realized in the UI (deactivate → filter-by-ambassador → bulk delete → complete erasure across originals/renditions/derived/backups with tombstoned acceptance evidence), ambassador-initiated withdrawal, backup + tested-restore posture, storage-cost surfacing, and the 6-month audit-expiry job that leaves the audit trail as the compliance record. After this epic "need content → publish-ready export in under 10 minutes" and "calm 15-minute offboarding" both land.
**FRs covered:** FR29, FR30, FR33, FR35
**NFRs:** NFR11, NFR16, NFR17
**Architecture:** AR38–AR42 (deletion/erasure/backup), AR44 (export + maintenance jobs), AR46–AR47 (export), AR56 (launch gates)
**UX:** UX-DR13 (SelectionBar export), UX-DR14 (ConsequenceDialog), UX-DR15 (CelebrationMoment), UX-DR26 (Flow 4), UX-DR27 (Flow 5 offboarding), UX-DR28 (Flow 5b withdrawal), UX-DR32 (testing)

### Epic 8: AI Generation & Provenance (v1.1)
Exploits the filled library: admins generate new content from a prompt + selected source assets + output settings, generated-origin assets are full citizens of the library, iterative re-prompting keeps a revisitable version history, and every generated asset carries a source family tree that powers generated-children warnings on deletion and "used" credit propagation back to the source uploads' ambassadors. Detailed flow design is deferred to the v1.1 cycle; MVP already provisions the origin enum, provenance/version columns, durable event store, and delete-impact hook.
**FRs covered:** FR37, FR38, FR39, FR40, FR41
**NFRs:** NFR9 (v1.1 AI provider residency)
**Architecture:** AR11 (origin/provenance seams), AR40 (getDeletionImpact fills), AR44 (generation jobs reuse substrate)
**UX:** v1.1-cycle components — GenerationModal, VersionHistory, FamilyTree viewer

### Epic 9: Sharing, Usage Tracking, Campaigns & Program Insights (v1.1)
Turns the library into a provable production line: one-click LinkedIn sharing with caption, post-export publish check-offs, usage notifications and profile counters that finally close the "did my content matter?" loop, first-class campaigns linking tasks/assets/shares/usage, tokenized 1:1 magic links that land ambassadors straight in the upload flow, a top-5 leaderboard, and a stats page plus audit-trail viewer that serve as the stakeholder receipt. Builds on Epic 8's usage/provenance data; MVP already records durable usage/export events and the closed v1.1 audit taxonomy.
**FRs covered:** FR42, FR43, FR44, FR45, FR46, FR47, FR48
**NFRs:** —
**Architecture:** AR11 (campaign seams, purpose-scoped tokens), AR12 (durable usage/export events consumed), AR43 (v1.1 audit types emitted), AR46 (export-items check-off seam)
**UX:** v1.1-cycle components — Leaderboard, StatsPage, export check-off prompt, share/caption UI

---

## Epic 1: Platform Foundation & Passwordless Access

Establishes the EU-pinned application on its confirmed stack and the auth spine: one magic-link front door, no passwords, immediate session revocation, a server-only DAL choke point with role separation, the account-state machine, the closed audit emitter, and the RLS backstop — the foundation every later epic is built on.

### Story 1.1: Project scaffold & EU-pinned infrastructure

As the solo developer,
I want the project scaffolded from the mandated starter and wired to EU-region services,
So that all later work builds on the confirmed, compliant, AI-legible foundation with no rip-out.

**Acceptance Criteria:**

**Given** a clean machine,
**When** the project is initialized,
**Then** it is scaffolded via `npx create-next-app@latest stena-content-portal -e with-supabase` and `npx shadcn@latest init -b radix` (Radix explicitly, not the Base UI default),
**And** the five scaffold-time adaptations are applied: template password-auth swapped for `signInWithOtp` magic links, `middleware.ts` renamed to `proxy.ts`, root moved under `src/`, Fleet Deck token placeholders staged, and the Supabase project created in **eu-north-1 (Stockholm)** before any data exists.

**Given** the infrastructure must satisfy EU residency (NFR9) and no-media-through-Vercel (AR3),
**When** hosting is configured,
**Then** `vercel.json` pins functions to `arn1`, a Railway worker service shell (Docker, EU West/Amsterdam) exists and builds, and Supabase is the platform for Postgres, Auth, Storage (TUS), Queues (pgmq), and Cron. **Sentry is deferred to post-MVP — no Sentry org is created now; error observability is the `src/shared/logger.ts` seam (Story 1.7).**

**Given** environment configuration must be single-sourced,
**When** the repo is set up,
**Then** `.env.example` contains the full MVP env canon (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DATABASE_URL` on the transaction pooler 6543, `DATABASE_SESSION_URL`, `DIRECT_URL`, `ACCEPTANCE_HMAC_KEY`, `BREVO_*`, `ELKS_*`; `SENTRY_DSN` is post-MVP, not included in MVP),
**And** `noindex` headers are applied globally and no public pages exist beyond the login/link-consumption routes.

**Given** the US-owned-processor legal question is **resolved — accepted 2026-07-08** (AR56, `launch-decisions.md`: US-owned vendors hosting in EU regions under SCC/DPA are approved),
**When** the stack is committed,
**Then** the processor inventory (Supabase/Vercel/Railway/Brevo/46elks — all EU-region; Sentry added to the inventory only when introduced post-MVP) is recorded in project docs for the GDPR record, and the stack proceeds as specified with no EU-owned-only constraint.

### Story 1.2: Data-layer foundation, migrations & account schema

As the solo developer,
I want the Drizzle-based migration workflow and the core account schema in place,
So that every later story can add tables through one governed, reproducible path.

**Acceptance Criteria:**

**Given** the data-access conventions (AR9),
**When** the data layer is initialized,
**Then** Drizzle ORM (pinned exact versions) generates migrations into `supabase/migrations` (`prefix: 'supabase'`) applied via the Supabase CLI, `drizzle-kit push` is never used against prod, app connections use the transaction pooler (`prepare: false`), and migrations use a session/direct connection.

**Given** the account-state machine is consumed by auth, messaging, and admin UI (AR23),
**When** the schema is created,
**Then** a `profiles` table exists with the state column constrained to `invited|active|inactive_declined|inactive_withdrawn|deactivated` (text + CHECK, not pgEnum), contact fields (email, mobile), a server-settable-only admin flag home, and the durable KPI columns `invited_at / first_accepted_at / first_upload_at / last_login_at` (AR14),
**And** deletion of a profile is row removal — `deleted` is not a state value.

**Given** the runtime-neutral kernel rule (AR54),
**When** `src/shared` is established,
**Then** it holds `limits.ts`, `error-codes.ts`, and datetime (Europe/Stockholm) helpers with no `next/*`, React, or `server-only` imports, and eslint `no-restricted-imports` boundary rules are configured for the worker/shared/DAL boundaries.

### Story 1.3: Fleet Deck design tokens & themed component base

As the solo developer,
I want the Fleet Deck tokens and base interaction patterns implemented once,
So that every screen is visibly one Stena product and inherits accessibility and voice for free.

**Acceptance Criteria:**

**Given** the Stena brand palette is the only source of color (UX-DR1, UX-DR2),
**When** tokens are defined in Tailwind v4 CSS-first config,
**Then** the semantic roles resolve exactly: `surface` White, `surface-panel` Beige, `surface-media` Black, `action-primary` Core Blue `#034592`, `link`/`focus-ring` `#3344dd`, `info/selected-bg` Light Blue, `destructive` Core Red, `caution-bg` Pink, `celebration` Core-Blue-on-Light-Blue, `star` Core Blue filled,
**And** Green and Yellow are absent (brand-reserved), the color usage rules are enforced (blue leads / red = destructive only; Light Blue/Pink never leave the app), and the "blue never stacks meanings" rule is encoded (selection = Light Blue, star = only Core-Blue mark on media).

**Given** the spacing and responsive foundations (UX-DR4, UX-DR30),
**When** layout primitives are set,
**Then** the 4 px base scale, ambassador single-column phone-first layout (16 px margins, bottom-anchored CTA, ≥44 px targets) and admin 12-column/1440 px/256 px-rail compact layout are established, using standard Tailwind breakpoints with the admin surface adapting down to phone "check-in mode" (bulk ops desktop/tablet-only, never a dead button).

**Given** the resolved typography decision (UX-DR3, `launch-decisions.md` — no Stena brand typeface exists),
**When** typography is set,
**Then** **Inter (SIL OFL) is self-hosted** (woff2 bundled/served from our EU origin, never the Google Fonts CDN), the type scale is applied and validated against Inter's metrics, tabular numerals are enabled for counts, the 16 px mobile-input minimum is enforced, and sentence case is the default,
**And** all user-facing copy is authored in **Swedish** (AR57), while code/DB identifiers stay English.

**Given** the shared interaction and accessibility patterns (UX-DR16–UX-DR18, UX-DR21, UX-DR31),
**When** the primitive layer is themed,
**Then** button hierarchy (one Core-Blue primary per view, bottom-anchored on mobile; link-blue tertiary; destructive only inside dialogs), the soft-edge error structure (what → why → remedy-as-primary on `caution-bg`), ambient-status-not-spinners, skeleton-after-200 ms loading, and the token-level accessibility floor (brand AA+ pairings only, 2 px `#3344dd` focus ring on `:focus-visible`, `prefers-reduced-motion`, color-never-alone) are implemented as reusable patterns,
**And** the derived values are applied as **approved** (UX-DR5, `launch-decisions.md`): blue celebration (not green), Core Blue filled star (not yellow), hover/pressed tints ±8–12% — the token set is fully locked, no sign-off items remain.

### Story 1.4: Magic-link authentication & the single front door

As a user (ambassador or admin),
I want to log in by clicking a link sent to my email,
So that I never create or remember a password.

**Acceptance Criteria:**

**Given** magic-link-only auth (FR1, AR18),
**When** I submit my email at `/auth/login`,
**Then** `signInWithOtp` (PKCE) sends a single-use link (15 min, AR19/NFR7), and no password field or stored credential exists anywhere in the system.

**Given** every entry point resolves through one front door (AR18),
**When** I click any valid invite / task-notification / plain-login link,
**Then** `/auth/confirm` verifies the token_hash, creates the session, and continues to the allow-listed relative `next` destination.

**Given** an invited ambassador (FR2),
**When** they click the invitation link for the first time,
**Then** the same link consumption logs them in and routes them toward onboarding (full activation completes in Epic 3).

**Given** a link is expired or already used (FR3),
**When** I click it,
**Then** I land on `/auth/error` with a plain-language message and a one-tap "send me a fresh link" action (`LINK_EXPIRED` → 410 remedy), never a raw error.

### Story 1.5: DAL choke point, auth contexts, role separation & revocation

As the platform,
I want every authenticated request to pass through a server-only DAL that validates identity, role, and session validity,
So that role separation and immediate revocation are structural, not per-feature.

**Acceptance Criteria:**

**Given** the DAL is the single choke point (AR20–AR22),
**When** any app-tier data access occurs,
**Then** it goes through a role-scoped DAL module that calls `getUser()` (network-validated, not `getClaims()` alone) plus an account-state check, `proxy.ts` performs only cheap `getClaims()` routing, and route handlers/server components never import the db client directly.

**Given** the three enumerated auth contexts (AR21),
**When** guards are implemented,
**Then** `requireUser()` (user + state + consent gate), `requireAdmin()` (no consent gate), `requireUserPreConsent()` (consent DAL only), and `systemContext()` (webhooks/cron, actor `system`) exist, and admin provisioning runs via `scripts/create-admin.ts` (service role) with the first admin seeded manually (AR24).

**Given** role separation must be enforced server-side (NFR8),
**When** an ambassador session touches admin surfaces,
**Then** access is denied at the DAL, ambassador DAL modules physically contain no triage-signal joins, role-scoped wire types omit admin-only fields (leaks become type errors), and RLS policies exist as defense-in-depth on every table with private storage buckets.

**Given** immediate revocation is a hard requirement (AR19/AR20),
**When** an account is deactivated, deleted, or consent is withdrawn,
**Then** `auth.admin.signOut(userId)` invalidates all devices, the next request on any device lands on login or the paused screen, and a `deactivated` account reaches a paused screen where every DAL call returns `ACCOUNT_INACTIVE` → 403.

**Given** the canonical error contract (AR52),
**When** any DAL error surfaces,
**Then** it maps to the `{ error: { code, message, remedy? } }` envelope on the canonical code→status map, the global QueryCache routes `SESSION_REVOKED` → login and `CONSENT_REQUIRED` → consent centrally, and unexpected errors are recorded via the error-logging seam (`src/shared/logger.ts` — structured platform logs in MVP; Sentry post-MVP) while domain errors are product states.

### Story 1.6: Audit event emitter & registry

As the compliance owner,
I want every mutating operation to emit an immutable audit event through one emitter,
So that the audit trail is complete from day one and is the program's compliance evidence.

**Acceptance Criteria:**

**Given** audit logging from day one (FR34, AR43),
**When** the emitter is built,
**Then** `audit.emit(tx, …)` lives in runtime-neutral `src/shared`, accepts only types from the closed `AUDIT_EVENTS` registry (dot-notation `entity.verb`, past tense; v1.1 types `asset.shared`/`asset.used_confirmed` present in the taxonomy from day one), and is always called inside the mutation transaction with the tx handle.

**Given** the audit store is an INSERT-only expiring class (AR12),
**When** the `audit_events` table is created,
**Then** it has no UPDATE/DELETE grants, uses `occurred_at`, references entities by `entity_id` + `entity_snapshot` jsonb (never FK to live rows), and records actor id + name snapshot,
**And** reversible triage verbs (star/tag/dismiss), delivery-status updates, and tag CRUD are deliberately unaudited per the FR34 taxonomy.

**Given** storage-coupled mutations,
**When** a mutation also touches object storage,
**Then** DB rows + audit event commit first and storage operations run after commit (orphans swept later), and calling `audit.emit` with the global client instead of the tx handle is a lint-guarded violation.

### Story 1.7: CI/CD pipeline & error-logging seam

As the solo developer,
I want automated checks and a structured error-logging seam wired before feature work,
So that every change ships gated and every incident is visible in platform logs (with Sentry a clean post-MVP swap).

**Acceptance Criteria:**

**Given** the CI/CD design and testing strategy (AR6, AR7, UX-DR32),
**When** a PR is opened,
**Then** GitHub Actions runs typecheck → lint → Vitest → Playwright + axe-core against a local Supabase, and Vercel preview deploys are gated by these checks,
**And** the journey-level e2e specs (onboarding-consent, task-upload, triage, library-export, offboarding) with in-spec axe checks, the throttled-4G task-link→upload run, and the upload torture test (airplane-mode/app-switch/lock-screen mid-transfer) are established as the test plan (keyboard-only and screen-reader spot checks documented as pre-release manual passes).

**Given** deploys to main,
**When** checks pass,
**Then** `supabase db push` applies migrations, `railway up` deploys the worker container, and Vercel deploys the app via git integration.

**Given** MVP observability with Sentry deferred to post-MVP (AR5),
**When** the app and worker run,
**Then** a runtime-neutral error-logging seam (`src/shared/logger.ts`) is initialized in both (app via `instrumentation.ts`, worker via its init) and writes structured JSON errors/critical alerts to stdout, captured by Vercel + Railway platform logs (both EU),
**And** the seam is the single call site for unexpected-error capture so a post-MVP Sentry transport swaps in behind it without touching call sites; **no Sentry, `@sentry/nextjs`, `instrumentation-client.ts`, or `SENTRY_DSN` is wired in MVP.**

## Epic 2: Ambassador Accounts & Lifecycle Management

Gives admins the roster cockpit — invite, maintain contact data, see activity, and activate/deactivate/delete accounts with immediate revocation — the precondition for onboarding.

### Story 2.1: Ambassador roster & activity view

As an admin,
I want to see all ambassadors with their contact details and activity,
So that I can manage the program population at a glance.

**Acceptance Criteria:**

**Given** existing ambassador profiles,
**When** I open the ambassadors page,
**Then** I see a table of ambassadors with name, email, mobile, account state, and last-login/activity (FR32),
**And** each row links to a detail view that is also the offboarding entry point (offboarding actions arrive in Epic 7).

**Given** the admin surface conventions (UX-DR20),
**When** I view the roster on desktop,
**Then** it uses the admin top-bar + left-rail navigation with compact density, and remains browseable in phone check-in mode.

### Story 2.2: Invite ambassadors by email

As an admin,
I want to invite an ambassador by email,
So that they can activate with a single click and no password.

**Acceptance Criteria:**

**Given** an email address (FR31 invite, FR2),
**When** I submit an invite,
**Then** a `profiles` row is created in the `invited` state with `invited_at` set (AR14), and a Supabase invite email is sent whose link doubles as the ambassador's first login.

**Given** the invite form (UX-DR19),
**When** I compose it,
**Then** it is a single-column form with the ambassador's email and optional mobile, validated on blur and submit, with input never cleared on error.

**Given** invite-email deliverability is launch-critical (NFR14),
**When** an invite is sent,
**Then** its delivery is trackable (full failure surfacing completes with the messaging adapter in Epic 5), and a bounced invite is not silently lost.

### Story 2.3: Maintain ambassador contact details

As an admin,
I want to edit an ambassador's contact details,
So that notifications reach them since there is no HR-system integration.

**Acceptance Criteria:**

**Given** contact data is admin-owned (FR32, AR-integration),
**When** I edit an ambassador's email or mobile,
**Then** the change persists to their profile and is used by future sends,
**And** keeping contact data current is documented as an admin duty.

### Story 2.4: Activate / deactivate accounts with session revocation

As an admin,
I want to deactivate or reactivate an ambassador,
So that a departed or paused ambassador stops receiving sends immediately and cannot act on a stale session.

**Acceptance Criteria:**

**Given** an active ambassador (FR31, AR23),
**When** I deactivate them,
**Then** their state becomes `deactivated`, `auth.admin.signOut(userId)` revokes all active sessions immediately, and the next interaction on any device lands on the paused screen — a still-valid session on a departed employee's phone is treated as a compliance incident.

**Given** a deactivated ambassador,
**When** I reactivate them,
**Then** their state returns to `active` and they can log in and act again,
**And** an `account.deactivated` / `account.reactivated` audit event is emitted.

### Story 2.5: Delete ambassador account record

As an admin,
I want to delete an ambassador's account record,
So that their contact details are removed per HR's employee-data practice when they leave.

**Acceptance Criteria:**

**Given** an ambassador account (FR31, AR39 deleteAccount seam),
**When** I delete the account,
**Then** the auth user and `profiles` row are removed (row deletion, not a soft-delete state), and an `account.deleted` audit event is emitted.

**Given** acceptance records must outlive the account while content exists (AR12/AR13),
**When** the account row is deleted,
**Then** there is no FK cascade to acceptance records and they are retained,
**And** the ambassador's uploaded content is not removed by this action — full GDPR erasure of their content is the offboarding runbook in Epic 7.

## Epic 3: Ambassador Onboarding & Consent

Turns an invited ambassador into an active contributor through consent-as-comprehension, tamper-evident acceptance records, a warm decline/return path, and re-accept-on-change — completing the compliance spine.

### Story 3.1: Versioned terms & tamper-evident acceptance store

As the compliance owner,
I want versioned terms and an append-only, tamper-evident acceptance store,
So that every acceptance is provable and every terms change is a new version.

**Acceptance Criteria:**

**Given** versioned terms (FR8, AR25),
**When** the store is created,
**Then** a `terms_versions` table exists and `scripts/publish-terms.ts` publishes a new version through the consent DAL, emitting `terms.version_created`; the versioning machinery exists before external legal review completes.

**Given** acceptance records are the compliance spine (FR6, NFR10, AR13),
**When** the `acceptance_records` table is created,
**Then** it is INSERT-only (no UPDATE/DELETE grants, trigger-enforced), has no `updated_at` and no FK to users, stores denormalized identity snapshots, and each record carries `hmac` + `prev_hmac` forming a per-record chain keyed by `ACCEPTANCE_HMAC_KEY` (never in the DB).

**Given** GDPR erasure must be distinguishable from tampering (AR13),
**When** PII snapshot columns are stored,
**Then** they are encrypted per-user via a `consent_pii_keys` table (crypto-shredding), the scheduled `verify-acceptance-chain` worker job alerts via the error-logging seam on chain-integrity failure (critical structured log captured by Railway platform logs; Sentry alerting post-MVP), and the erasure-shred + signed-tombstone path is provided for Epic 7 to invoke.

### Story 3.2: First-login consent card flow

As an ambassador,
I want to accept three plain-language consent cards on first login,
So that my account activates and everything I upload is provably usable.

**Acceptance Criteria:**

**Given** first login (FR5, UX-DR6),
**When** I reach the consent step,
**Then** the ConsentCardStack shows three cards one at a time (progress dots, beige card with icon/h2/plain-language body/"full legal text" link opening a sheet), each with a ≥44 px "I agree", using text verbatim from `consent-cards.md` and never edited in the UI layer.

**Given** I accept all three cards (FR6),
**When** the final card is agreed,
**Then** an acceptance record (user + terms version + timestamp) is written via the `requireUserPreConsent` context, `first_accepted_at` is set, my account becomes `active`, a `consent.accepted` event is emitted, and I land on the task list.

**Given** the stepper is focus-trapped (UX-DR6),
**When** I navigate by keyboard/screen reader,
**Then** card position is announced, the legal link opens a sheet (not a new tab), and focus management follows the stepper.

### Story 3.3: Decline → pause → self-service return

As an ambassador,
I want declining to pause my account rather than end it,
So that I can take time and return without asking anyone.

**Acceptance Criteria:**

**Given** the consent cards (FR7, UX-DR23),
**When** I choose Decline on the final card,
**Then** my account becomes `inactive_declined` without deleting anything, a `consent.declined` event is emitted, and I see a warm pause screen naming exactly what happens (paused, nothing deleted, come back anytime).

**Given** a declined ambassador (FR4 tie-in),
**When** they are inactive,
**Then** task and message sends to them are suppressed (enforced at dispatch in Epic 5).

**Given** I return later (FR7),
**When** I log in again,
**Then** the consent cards are re-presented and accepting reactivates me with no admin intervention.

### Story 3.4: Re-accept on terms change

As the compliance owner,
I want outdated-terms users to re-accept before doing anything,
So that no content is ever contributed on stale consent.

**Acceptance Criteria:**

**Given** the consent-version gate (FR8, AR21),
**When** an authenticated ambassador request is made while their accepted terms version is outdated,
**Then** the DAL returns `CONSENT_REQUIRED` (409 with `next`), the consent cards interpose with a "our terms have changed — here's what's new" banner highlighting the changed card, and on acceptance the request continues to the original destination.

**Given** the re-accept prompt,
**When** the ambassador declines the new terms,
**Then** they route to the pause state (`inactive_declined`) exactly like a first-time decline, and no task can be fulfilled or upload made on outdated terms.

**Given** consent applies to ambassadors only (AR21),
**When** an admin makes a request,
**Then** `requireAdmin()` skips the consent gate entirely.

## Epic 4: Contribution — Upload & Media Processing

Delivers the make-or-break 90-second moment and the async media pipeline behind it: interruption-safe batch/capture upload with staged atomic commit, transcoding to renditions/thumbnails, and view/delete-own. Standalone via the spontaneous-upload path; task context arrives in Epic 5.

### Story 4.1: Upload staging & atomic commit protocol

As the platform,
I want a staging-then-commit upload protocol backed by private EU buckets,
So that no partial upload is ever visible in the library (NFR13).

**Acceptance Criteria:**

**Given** the asset model (AR11, AR27),
**When** the schema is created,
**Then** a single `assets` table exists with the three-value `origin` enum (`ambassador|admin|generated`, text + CHECK), a `processing_status` column (`pending|processing|ready|failed`), a nullable `task_id` FK seam (FR15, filled in Epic 5), an `uploader_id`, and provenance/version seam columns for v1.1.

**Given** the staging-commit contract (AR27, AR28),
**When** an upload begins,
**Then** `POST /api/uploads/init` (`{ filename, mime, declaredSize, taskId? }`) creates a library-invisible `pending` asset row and returns `{ assetId, objectKey }`, and three private buckets exist — `originals` (immutable), `renditions` (worker-written only), `exports` — with Storage RLS pinning `originals` writes to the uploader's own pending asset.

**Given** the commit gate (AR27, NFR13),
**When** `POST /api/uploads/[assetId]/commit` runs,
**Then** the server verifies via S3 HEAD (existence + size vs `declaredSize` + leading-byte type sniff) using TUS offset completion as the integrity gate (no checksum), flips status to `processing`, and enqueues `transcode_jobs` in the same transaction; a size/type mismatch deletes the staged object and returns `FILE_TOO_LARGE`/`UNSUPPORTED_FILE_TYPE`, a missing/incomplete object returns `UPLOAD_INCOMPLETE` (409) leaving the row `pending`, and commit is idempotent.

### Story 4.2: Batch camera-roll & capture upload

As an ambassador,
I want to select many photos/videos at once or capture one directly and send them in a single motion,
So that contributing feels like replying with photos, not filling in a system.

**Acceptance Criteria:**

**Given** batch upload without per-file forms (FR9, UX-DR7, AR26),
**When** I open the upload flow and multi-select from my camera roll,
**Then** the native picker opens in multi-select, the UploadManager shows a selection-review grid, and confirming starts a chunked Supabase TUS upload (Uppy 5, chunk size exactly 6 MB) with a persistent light-blue ProgressStrip — no per-file form and no fixed batch limit.

**Given** in-flow capture (FR10),
**When** I choose "Take photo/video",
**Then** `<input capture>` opens the device camera and the captured file enters the same upload flow.

**Given** spontaneous upload with no task (UX-DR25),
**When** I open the Upload tab (no task context),
**Then** the same picker opens in ≤ 2 taps, exactly one optional "What's this from?" field is added, the UploadManager behaves identically, and the asset lands in the admin triage queue with a context line reading "ambassador · spontaneous · date".

**Given** optional enrichment (FR13, UX-DR7),
**When** files are uploading,
**Then** optional per-file description fields sit below the strip and never block or gate the upload.

### Story 4.3: Client-side validation with friendly limits

As an ambassador,
I want oversized or wrong-type files rejected before any transfer,
So that I never waste minutes on an upload that dies at 80%.

**Acceptance Criteria:**

**Given** the shared caps (FR11, AR10),
**When** I select files,
**Then** per-type limits from `src/shared/limits.ts` (images ≤ 50 MB, video ≤ 2 GB, audio/docs ≤ 200 MB) are validated client-side before transfer starts, and the same config re-validates server-side at commit.

**Given** a partial rejection (UX-DR7),
**When** some selected files exceed limits,
**Then** each rejected file is grayed with the specific limit and remedy ("engine-tour.mp4 is 3.2 GB — videos can be up to 2 GB / ~5 min"), and the remaining valid files proceed unaffected.

**Given** the video duration cap is advisory (AR31),
**When** a long-but-under-2 GB video is selected,
**Then** it is accepted (size is the only enforced limit; the "~5 min" is copy only).

### Story 4.4: Interruption-safe resumable upload

As an ambassador on ship Wi-Fi,
I want uploads to survive drops and app-switches without error or loss,
So that I can walk away and trust nothing I do can break it.

**Acceptance Criteria:**

**Given** chunked auto-retry (FR12, NFR4, AR26),
**When** the connection drops mid-transfer,
**Then** the upload retries silently (`retryDelays [0,3s,5s,10s,20s]`), a max-size 2 GB video completes over an unstable connection with progress visible throughout, and a recovered drop surfaces no error.

**Given** the iOS Safari no-background-transfer constraint (UX-DR7, NFR1),
**When** I background the app or lock the phone,
**Then** the transfer pauses safely and resumes on foreground with zero lost chunks, Golden-Retriever-style state persists across navigation, and the strip states the truth ("3 of 12 delivered — safe to switch apps, we'll resume") via `aria-live="polite"` sentence milestones.

**Given** long uploads outliving a token (AR27 token seam),
**When** a chunk PATCH returns 401,
**Then** the TUS headers refresh the current session token dynamically and retry rather than failing terminally.

**Given** the MVP performance contract (NFR1, AR-OQ1),
**When** a task/notification link is followed on 4G,
**Then** the interactive task list is reachable in < 3 s (the literal upload-screen target activates with v1.1 tokenized links).

### Story 4.5: Transcoding worker — renditions, thumbnails & type derivation

As the platform,
I want an async worker that derives type and produces web-friendly renditions,
So that admins get instant previews while originals stay untouched.

**Acceptance Criteria:**

**Given** the async pipeline (FR22, FR23, AR30, AR44),
**When** a `transcode_jobs` message is processed,
**Then** the Railway worker (ffmpeg 8.1+ for tiled HEIC, sharp for stills) derives the content-type category from the file and writes renditions to their own table — image: `thumb` (webp ~400px) + `preview` (webp ~1600px); video: `poster` + `thumb` + `preview` (faststart mp4 720p); audio/doc: none — then sets `processing_status='ready'`.

**Given** originals are sacrosanct (NFR12),
**When** transcoding runs,
**Then** the original file is preserved bit-exact and never modified or replaced, HEIC/HEVC conversion happens only in this step, and renditions are separate objects.

**Given** processing performance (NFR2 production, NFR3),
**When** a max-size 2 GB video is uploaded,
**Then** renditions are available within 5 minutes per-asset under normal load (worker runs 2 concurrent ffmpeg jobs), and smaller files complete sooner.

**Given** failures and orphans (AR30, AR29),
**When** a rendition job fails,
**Then** partial renditions are deleted, the asset is marked `failed` (all-or-nothing), and `POST /api/assets/[assetId]/retry-processing` re-queues it; a daily orphan-GC job deletes storage prefixes and `pending` rows older than 24 h plus a weekly diff-sweep.

**Given** idempotent handlers (AR44),
**When** a job is redelivered,
**Then** the handler checks the status column first and treats "already done" as success, archiving after 3 receives and marking `failed` (UI-retryable).

### Story 4.6: View & delete own uploads

As an ambassador,
I want to see my uploads and delete any of them,
So that I stay in real control of my content.

**Acceptance Criteria:**

**Given** my uploads (FR14, UX-DR9, UX-DR10),
**When** I open "My uploads",
**Then** I see my own content in a GalleryGrid (delete-own variant) with pre-generated thumbnails, a calm processing placeholder for fresh uploads (never a broken image), and a MediaPreview lightbox on tap.

**Given** processing status propagation (AR45, UX-DR10),
**When** an upload is still transcoding,
**Then** the tile polls every 3 s and flips to the thumbnail when ready, showing "Processing preview — ready soon" with the original filename until then.

**Given** delete-own (FR14, AR38),
**When** I delete an upload,
**Then** it is removed immediately via `deleteAssets(ids, { mode: 'delete' })` (original + renditions gone, usage/export event rows preserved), an `asset.deleted` audit event is emitted, and there is no soft-delete/recycle bin.

**Given** I can enrich after the fact (FR13),
**When** I open one of my uploads,
**Then** I can add or edit its description.

## Epic 5: Content Requests & Messaging

Builds the task-as-trigger engine plus all outbound email/SMS with per-recipient delivery tracking, send-suppression, provider-outage isolation, and friendly budget handling — completing NFR14 by wrapping auth emails in the same tracked adapter.

### Story 5.1: Messaging channel adapters & delivery tracking

As the platform,
I want isolated email and SMS adapters with per-recipient delivery records,
So that an undelivered magic link becomes a visible admin problem, not a silent dead end.

**Acceptance Criteria:**

**Given** the channel adapters (AR33, AR34, NFR20),
**When** a send is dispatched,
**Then** a Brevo (EU) adapter and a 46elks (Sweden) adapter are the only modules touching provider APIs, each channel dispatches independently with bounded timeouts so an SMS-provider failure never blocks email or in-app functionality, and every recipient gets a `send_record`.

**Given** delivery webhooks (AR35, NFR14),
**When** a provider posts a status,
**Then** `/api/webhooks/brevo` and `/api/webhooks/46elks` verify signature/Basic-auth before parsing (unverified → 401 no detail), resolve by `provider_message_id` (UNIQUE), apply a monotonic status lattice (never downgrade `delivered`), append the raw payload, and return 200 for unknown ids (logged via the error-logging seam).

**Given** auth-email tracking (AR36, NFR14),
**When** Supabase Auth sends a magic-link or invite email,
**Then** the Send-Email hook routes it through the app's Brevo adapter so it gets a `send_record` + webhook tracking, and a bounced invite surfaces on the admin messages page (fallback: ingest unknown-id Brevo webhooks keyed by recipient + template class).

**Given** outbound messages are designed surfaces (UX-DR22),
**When** any notification or message email/SMS is composed,
**Then** it uses personal sender framing ("Hi Jonas — Petra needs…"), exactly one action per message, the core palette only (no Light Blue/Pink outside the app), and every link has a friendly expired-state landing.

**Given** durable delivery status (AR45),
**When** an admin views send outcomes,
**Then** delivery status polls at 15 s and stops on terminal states, and failures are first-class admin-visible states with a retry/fix-contact affordance.

### Story 5.2: SMS budget-cap handling

As an admin,
I want a clear "budget reached" state instead of a cryptic provider error,
So that spend stays capped and I always know what happened.

**Acceptance Criteria:**

**Given** provider-side caps (FR36, NFR19, AR34; initial cap **200 SEK/month** on the 46elks prepaid balance per `launch-decisions.md`),
**When** 46elks returns 403 "Not enough credits",
**Then** a persisted binary budget flag is set, SMS is disabled pre-send until balance is restored (polled via `/me`), and the app never surfaces the raw provider payload.

**Given** the soft-edge budget message (UX-DR17, AR52),
**When** SMS is unavailable at compose time,
**Then** the SMS option is disabled before send with "SMS budget reached — this message wasn't sent. Email still works." (`BUDGET_REACHED` → 429), naming the blocked action and offering the working channel.

**Given** the email cap position (NFR19, AR-OQ6),
**When** Brevo's plan-level daily quota is exceeded,
**Then** the Brevo adapter maps it to `BUDGET_REACHED` exactly like SMS.

### Story 5.3: Create & send content-request tasks

As an admin,
I want to create a content request addressed to one or many ambassadors and notify them,
So that I actively drive contribution instead of waiting for it.

**Acceptance Criteria:**

**Given** task creation (FR16, FR19, AR16, UX-DR29),
**When** I compose a request,
**Then** `tasks` and `task_recipients` tables back it, the compose form shows a personal ask, recipient chips (individuals or "all active"), and an Email/SMS/Both channel choice with a send-count line, and `tasks.created_at` starts the fulfillment KPI clock (AR14).

**Given** per-recipient notification (FR19, AR34),
**When** I send,
**Then** each selected ambassador receives the notification on the chosen channel(s) with a `send_record` per recipient, and the compose preview shows the message as the ambassador will receive it (personal sender framing).

**Given** the display-only due date (AR15),
**When** I optionally set a due date,
**Then** `tasks.due_at` drives the TaskCard "Due" badge and expired-quiet state only, with no enforcement, reminders, or KPI effect.

### Story 5.4: Ambassador task list & task-linked upload

As an ambassador,
I want to see my tasks and fulfill one directly,
So that I can knock out a request in the 90-second moment.

**Acceptance Criteria:**

**Given** the in-app task list (FR17, UX-DR11, UX-DR20),
**When** I open the app (root `/` → `/tasks`),
**Then** I see open and completed tasks as TaskCards (badge, title, "From {admin} · {context}", single "Add content" primary button) with the bottom tab bar (Tasks / Upload / My uploads / Profile), and a task arriving from a notification link is highlighted.

**Given** task-scoped upload (FR15, AR16),
**When** I tap "Add content" on a task and upload,
**Then** upload-init sets `assets.task_id` to that task (validated against an open task addressed to me), so the content is auto-linked without any typing.

**Given** the honest MVP completion copy (UX-DR24),
**When** my upload completes inside a task,
**Then** I see a celebration and an optional "mark task done", and the completion copy promises nothing MVP can't deliver (no "we'll tell you when it's used" line until v1.1).

### Story 5.5: Mark task done

As an ambassador or admin,
I want either side to mark a task done,
So that the loop closes and fulfillment is measured honestly.

**Acceptance Criteria:**

**Given** per-recipient completion (FR18, AR14),
**When** a recipient marks their task card done,
**Then** their `task_recipients.completed_at` is set, `tasks.fulfilled_at` is set to the first recipient completion (feeding the 7-day fulfillment KPI), and a `task.completed` event is emitted.

**Given** either side can complete (FR18),
**When** an admin marks a recipient's task done,
**Then** it is recorded the same way, and the completed task moves to the "Completed" state in the ambassador's list.

### Story 5.6: Free-form messaging & send-suppression

As an admin,
I want to message one or all active ambassadors,
So that I can communicate outside a formal request while never messaging paused accounts.

**Acceptance Criteria:**

**Given** free-form messaging (FR20, UX-DR19),
**When** I compose a message to a single ambassador or "all active",
**Then** it sends via email and/or SMS with the same compose pattern (recipient chips, channel toggle, SMS character counter with hard stop + send-count line) and per-recipient delivery tracking.

**Given** send-suppression for inactive accounts (FR4, AR34),
**When** an ambassador is inactive (declined/withdrawn/deactivated),
**Then** they are unselectable in compose with a quiet "paused" note and the dispatch path suppresses any send to them — enforced at the choke point, not just the UI.

## Epic 6: Admin Library, Triage & Curation

Gives admins the curation cockpit: one shared library with fast composable filter/search, the conveyor-belt triage queue, admin-private starring, tags-as-folders, and brand-asset uploads.

### Story 6.1: Shared library browse & media access

As an admin,
I want to browse every asset in one library regardless of origin,
So that ambassador uploads and brand assets live in one place.

**Acceptance Criteria:**

**Given** one shared library (FR21, UX-DR9),
**When** I open the library,
**Then** a virtualized GalleryGrid (roving tabindex, aria-rowcount, scroll-restore) shows all assets across origins with square thumbs, scrim'd meta lines, and star/tag indicators, paginated via `{ items, nextCursor }` keyset.

**Given** secure media access (AR32, NFR8),
**When** a thumbnail or preview loads,
**Then** the JSON carries only a stable app URL (`/api/assets/[assetId]/file?kind=thumb|preview|original`) that runs a DAL access check and 302-redirects to a 60 s signed URL with `Cache-Control: private, max-age=300` on thumb/preview — the browser never mints read URLs.

**Given** media viewing (UX-DR10),
**When** I open an asset,
**Then** the MediaPreview lightbox renders an aspect-fit rendition on a black surround (video playback < 2 s, hover-scrub desktop / tap-play mobile), a processing state when not ready, and a calm retry (never a broken-image icon) on rendition failure.

### Story 6.2: Filter & search

As an admin,
I want to filter and search the library and have results appear instantly,
So that I can find any asset in seconds without scrolling.

**Acceptance Criteria:**

**Given** composable filters (FR24, UX-DR21),
**When** I apply ambassador / type / date / tag-folder filters and a description/tag search,
**Then** filters compose (never replace) as removable chips with a one-tap clear-all, results update live with no Apply button, and the active-filter state is always visible.

**Given** the performance target (NFR5, AR17),
**When** filters/search run at thousands of assets,
**Then** results return in < 500 ms, backed by the named indexes and a GIN tsvector over description + tag names (`simple` config).

**Given** URL-canonical state (AR53),
**When** I set a filter combination,
**Then** it is encoded in the URL via nuqs so the view is bookmarkable and shareable, and the query cache derives from the parsed URL state.

### Story 6.3: Tags-as-folders with create, assign & bulk tagging

As an admin,
I want to tag assets and browse tags as folders,
So that I get familiar folder organization without folder machinery.

**Acceptance Criteria:**

**Given** the tag model (FR27, UX-DR12),
**When** tags are created and assigned,
**Then** `tags` and `asset_tags` tables back a TagPicker (type-ahead over existing tags + "Create '{query}'" row), single-asset and multi-select bulk tagging both work, and chips are removable inline.

**Given** tags-as-folders (FR27),
**When** I browse the left rail,
**Then** tags render as browsable folders,
**And** the campaign workaround (naming-convention tags like `campaign-summer-2026`) is supported until v1.1 campaigns.

**Given** optimistic tag verbs (AR53),
**When** I add/remove a tag,
**Then** the UI patches optimistically and reconciles on invalidate, and library bulk-tags do NOT set `triaged_at` (bulk ops are not triage).

### Story 6.4: Admin-private starring

As an admin,
I want to star quality assets without any ambassador ever seeing it,
So that triage signals stay private while praise stays public.

**Acceptance Criteria:**

**Given** the star signal (FR26, AR49),
**When** I star/unstar an asset via `POST/DELETE /api/assets/[assetId]/star`,
**Then** the star is shared across all admins, optimistically patched, and never present on any ambassador-facing surface.

**Given** structural signal separation (NFR8, AR22),
**When** an ambassador session serializes an asset,
**Then** the role-scoped wire type omits `starred`/`dismissed` entirely so a leak is a compile-time type error, not a runtime check.

### Story 6.5: Triage queue

As an admin,
I want to clear a week of new uploads in one keyboard-driven sitting,
So that curation feels like momentum, not a chore.

**Acceptance Criteria:**

**Given** the queue predicate (FR25, AR48, UX-DR8),
**When** I open the triage queue,
**Then** it shows `triaged_at IS NULL AND processing_status IN ('processing','ready')` items across all origins ordered `created_at ASC` on a full-screen black surround, one large MediaPreview at a time with a context line (ambassador · task · date · size) and a "12 of 40" progress bar, keyboard legend visible until first use.

**Given** the triage verbs (UX-DR8, AR49),
**When** I press T (tag) / S (star) / X (dismiss) / →/← (navigate) / space (play-pause),
**Then** every verb is reversible in place and confirmation-free, tag/star set `triaged_at` server-side and keep position for stacking, dismiss (`markTriaged()`, never sharing a code path with deletion) auto-advances with Z-undo, and ← revisits triaged items with verbs still toggleable.

**Given** multi-admin concurrency (AR50),
**When** two admins triage at once,
**Then** last-write-wins on the shared `triaged_at` flag, queue position is per-admin client state, and an asset deleted while viewed advances with a quiet `NOT_FOUND` notice.

**Given** processing and completion states (UX-DR8),
**When** an item is still transcoding,
**Then** tag/star still work while playback waits on the designed placeholder, and clearing the queue shows a celebration summary ("40 reviewed, 9 starred, 31 tagged") with Go-to-starred / Back-to-library exits; abandoning mid-session restores position ("12 triaged · 28 left").

### Story 6.6: Admin brand-asset uploads

As an admin,
I want to upload brand assets into the same library,
So that all content surfaces are served from one asset model.

**Acceptance Criteria:**

**Given** brand assets share the pipeline (FR28),
**When** I upload a brand asset from the admin library,
**Then** it reuses the Epic 4 upload/commit/transcode pipeline with `origin: admin` set from the session role, appears in the shared library, and supports tags/filters/starring/export like any asset with zero schema change.

## Epic 7: Export, Deletion & Governance

Closes the MVP loop and makes the program provably compliant: async zip export with human-readable filenames, consequence-first deletion, the offboarding/erasure runbook in the UI, ambassador-initiated withdrawal, backups + tested restore, storage-cost surfacing, and audit expiry.

### Story 7.1: Async zip export with human-readable filenames

As an admin,
I want to multi-select assets and export a zip with readable filenames,
So that I can hand a publish-ready package to the agency in under 10 minutes.

**Acceptance Criteria:**

**Given** async export (FR30, AR46, UX-DR13, UX-DR26),
**When** I multi-select assets and export,
**Then** the SelectionBar shows a size estimate first ("40 files · ~4.3 GB"), `POST /api/exports` creates `export_records` + `export_items` and enqueues `export_jobs`, the worker streams originals into a zip in the `exports` bucket, progress polls at 5 s, and I can navigate away and get an "export ready" notice.

**Given** the naming convention (FR30, AR47),
**When** the zip is built,
**Then** filenames follow `{ambassador-name}-{upload-date}-{nn}` from runtime-neutral `src/shared/export-naming.ts` (slug lowercased/NFC-normalized, å/ä→a, ö→o, non-alnum→hyphen; date = Europe/Stockholm calendar date of upload completion; `nn` zero-padded per ambassador+date within the export; original extension preserved).

**Given** durable export records (AR12, AR46),
**When** an export completes,
**Then** `export_records`/`export_items` persist without expiry (the FR43 v1.1 check-off seam), download is via the 302 signed-URL pattern, the zip expires after 7 days, an `export.created` audit event is emitted, and the export history page (`/admin/exports`) lists exports with statuses.

### Story 7.2: Consequence-first permanent deletion

As an admin,
I want permanent deletion to state its consequences clearly,
So that an irreversible action feels like a well-lit path, not a defused bomb.

**Acceptance Criteria:**

**Given** permanent deletion (FR29, AR38),
**When** I delete one or many assets via `POST /api/assets/bulk-delete` with `mode: 'delete'`,
**Then** `deleteAssets` removes originals/renditions/derived and the rows (DB deletion synchronous; storage fan-out inline for ≤ 50 objects, else via `maintenance_jobs`), preserves usage/export event rows, emits `asset.deleted`, and there is no soft-delete anywhere.

**Given** the ConsequenceDialog (UX-DR14, AR40),
**When** I confirm a delete,
**Then** `getDeletionImpact(assetIds)` runs first (MVP returns an empty `generatedChildren` array; v1.1 fills it), the dialog states scope + count + permanence ("This can't be undone — the audit log records it") and "already-exported copies are not recalled", and the red confirm is labeled verb + count ("Delete 34 assets"), never "OK".

### Story 7.3: Offboarding & complete erasure

As an admin (GDPR operator),
I want a step-for-step offboarding path that completely erases a departed ambassador's content,
So that I can serve Art. 17 within 30 days with the audit trail as evidence.

**Acceptance Criteria:**

**Given** the offboarding runbook mirrored in the UI (FR33, UX-DR27),
**When** I offboard an ambassador,
**Then** the flow follows the runbook step-for-step — deactivate (sends stop + sessions revoked, from Epic 2) → filter the library by that ambassador → review → select-all → bulk delete → consequence summary → confirm — and bystander erasure enters the same path via search instead of the ambassador filter.

**Given** complete erasure (NFR11, AR38, AR39),
**When** I bulk-delete in erasure mode,
**Then** `deleteAssets(mode: 'erasure')` removes originals/renditions/derived and the backup replica, purges usage/export attributions, force-expires export zips referencing erased assets, purges recipient PII in `send_records`, and triggers the acceptance-record crypto-shred + signed tombstone (chain stays intact).

**Given** durable erasure evidence (AR39),
**When** an erasure completes,
**Then** an `erasure_records` row (executor, when, counts — no subject PII) is written so evidence survives the 6-month audit expiry, and `account.deleted` + `asset.erased` events are emitted.

### Story 7.4: Ambassador-initiated withdrawal & removal request

As an ambassador,
I want to withdraw consent, delete my uploads, or request full removal from my profile,
So that "you stay in control" is real and self-serve.

**Acceptance Criteria:**

**Given** the "Your consent" panel (UX-DR28, Flow 5b),
**When** I open Profile → Your consent,
**Then** I see my accepted terms version and date with the cards re-viewable, plus three actions.

**Given** withdraw consent (FR7 parallel),
**When** I withdraw,
**Then** a ConsequenceDialog states exactly what happens (account pauses like a decline, sends stop, uploads remain until removed), my state becomes `inactive_withdrawn` with sessions revoked, a `consent.withdrawn` event is emitted, and re-entry works exactly like returning after a decline.

**Given** the other two actions,
**When** I choose "Delete my uploads" or "Request full removal",
**Then** delete-my-uploads reuses the self-service delete-own path, and request-full-removal pre-fills a message to HR and sets the expectation "HR will confirm removal within 30 days" (execution follows the offboarding runbook).

### Story 7.5: Audit expiry & retention enforcement

As the compliance owner,
I want audit events to auto-expire at 6 months while acceptance records persist,
So that retention policy is enforced by the system, not by memory.

**Acceptance Criteria:**

**Given** the retention classes (FR35, AR12, AR44),
**When** the expiry job runs,
**Then** a pg_cron job deletes `audit_events` older than 6 months scoped to that single table by name, and it never touches acceptance records, usage/export/send events, or content.

**Given** the four durable/expiring classes,
**When** any table is created across the project,
**Then** `acceptance_records` and `usage_events`/`export_records`/`export_items`/`send_records` are exempt from expiry, and the UX-spec sentence implying export records expire on the audit schedule is treated as superseded.

### Story 7.6: Backups, restore runbook & storage-cost surfacing

As the operator,
I want tested backups and a visible storage-cost line,
So that data loss is bounded and running cost is signed off.

**Acceptance Criteria:**

**Given** the backup posture (NFR16, AR42),
**When** backups run,
**Then** Supabase Pro daily DB backups are retained ≤ 30 days, a nightly worker job replicates the `originals` bucket to a second EU bucket (RPO ≤ 24 h, replica retention ≤ 30 days for deleted objects), and erasure sweeps the replica.

**Given** restore must be proven (NFR16),
**When** the launch checklist is executed,
**Then** a tested DB + storage restore exercise is a named launch gate with a documented runbook that includes a re-apply-erasures step.

**Given** storage cost surfacing (NFR17, AR8),
**When** stakeholders review running costs,
**Then** the ≈ $50–90/month envelope (incl. low-TB storage growth without re-architecture) is surfaced as a standing cost line for sign-off.

## Epic 8: AI Generation & Provenance (v1.1)

Exploits the filled library: generate from source assets with full provenance, version history, family-tree warnings, and used-credit propagation. Detailed flow design is deferred to the v1.1 cycle; MVP already provisions the origin enum, provenance/version columns, durable event store, and delete-impact hook.

> **v1.1 note:** These stories define scope and seams. Detailed UX (GenerationModal, VersionHistory, FamilyTree viewer) is designed in the v1.1 design cycle, and the EU-residency-or-transfer-mechanism AI provider is selected in v1.1 planning (NFR9).

### Story 8.1: Generation request & generated-origin assets

As an admin,
I want to generate content from a prompt and selected source assets,
So that I can produce publish-ready material without a production shoot.

**Acceptance Criteria:**

**Given** the generation request (FR37),
**When** I provide a prompt, select source assets, and choose output type and settings,
**Then** a generation job runs against the selected EU-compliant AI provider and produces a new asset.

**Given** generated-origin assets (FR38, AR11),
**When** a generated asset lands,
**Then** it appears in the shared library with `origin: 'generated'` (the enum value provisioned in MVP) and supports tags, filters, starring, and export exactly like any asset.

### Story 8.2: Iterative re-prompt & version history

As an admin,
I want to re-prompt a generated asset and keep every version,
So that I can iterate to the right result without losing prior tries.

**Acceptance Criteria:**

**Given** iterative re-prompting (FR39, AR11 version seams),
**When** I re-prompt a generated asset,
**Then** each iteration creates a new version in the version chain and all prior versions remain revisitable.

### Story 8.3: Source family tree & generated-children warnings

As an admin,
I want each generated asset to record its sources and warn me before I delete a source,
So that deletions never silently break derived content.

**Acceptance Criteria:**

**Given** provenance edges (FR40, AR40),
**When** a generated asset is created,
**Then** its source assets are recorded as a family tree.

**Given** the delete-impact hook (AR40),
**When** I delete a source asset,
**Then** `getDeletionImpact` now returns the affected generated children and the ConsequenceDialog lists them, so I can delete or regenerate each before confirming.

### Story 8.4: Used-credit propagation to source ambassadors

As an ambassador whose clip fed a generated asset,
I want to be credited when that generated asset is used,
So that my contribution is recognized even through AI derivation.

**Acceptance Criteria:**

**Given** used-credit propagation (FR41),
**When** a generated asset is marked used,
**Then** "used" credit propagates through the family tree to the source uploads' ambassadors via the durable usage-event store,
**And** ordinary deletion preserves historical counters while erasure removes the departed ambassador's attributions.

## Epic 9: Sharing, Usage Tracking, Campaigns & Program Insights (v1.1)

Turns the library into a provable production line: sharing, usage notifications, campaigns, tokenized links, leaderboard, and the stakeholder receipt. Builds on Epic 8's usage/provenance data; MVP already records durable usage/export events and the closed v1.1 audit taxonomy.

> **v1.1 note:** These stories define scope and seams. Detailed UX (Leaderboard, StatsPage, export check-off prompt, share/caption UI) is designed in the v1.1 design cycle. Start LinkedIn developer-app approval before the v1.1 cycle (lead time).

### Story 9.1: LinkedIn share with caption & share events

As an admin,
I want to share an asset to LinkedIn with a caption from the portal,
So that publishing and its usage record happen in one place.

**Acceptance Criteria:**

**Given** LinkedIn sharing (FR42),
**When** I share an asset with a caption,
**Then** it posts via the LinkedIn share API and the share is recorded as a usage event (`asset.shared` — a taxonomy type present from MVP day one).

### Story 9.2: Post-export publish check-offs

As an admin,
I want to confirm which exported items were actually published,
So that "used" counters stay honest.

**Acceptance Criteria:**

**Given** the export check-off seam (FR43, AR46),
**When** I revisit an export,
**Then** I can per-item check off which exported assets were published, marking them used against the durable `export_items` recorded in MVP.

### Story 9.3: Usage notifications & profile counters

As an ambassador,
I want to be told when my content is used and see it on my profile,
So that my contribution never disappears into a silent hole.

**Acceptance Criteria:**

**Given** the usage loop (FR44, UX-DR15),
**When** my content is marked used (via share or check-off),
**Then** I receive a usage notification rendered as a CelebrationMoment with specific context ("your photo — used in the summer recruiting campaign") and my profile usage counter ticks up,
**And** an `asset.used_confirmed` event is emitted.

### Story 9.4: Campaigns as first-class objects

As an admin,
I want first-class campaigns linking tasks, assets, shares, and usage,
So that I can organize and report a campaign end-to-end.

**Acceptance Criteria:**

**Given** campaigns (FR45, AR11 campaign seams),
**When** I create a campaign,
**Then** I can link tasks, assets, shares, and usage to it via the nullable campaign seams provisioned on task/event rows in MVP,
**And** a documented migration path promotes the MVP naming-convention tags (`campaign-*`) into campaigns.

### Story 9.5: Tokenized 1:1 deep-link tasks

As an admin,
I want to send a task link that opens straight into the upload flow,
So that a 1:1 request lands the ambassador at the point of action.

**Acceptance Criteria:**

**Given** purpose-scoped tokens (FR46, AR11),
**When** I send a tokenized 1:1 task link,
**Then** the link uses a new purpose value on the existing `/auth/confirm` front door (not a second auth system) and lands the ambassador directly in the upload/capture flow,
**And** the literal NFR1 "< 3 s to the upload screen" target now applies.

### Story 9.6: Leaderboard

As any user,
I want a top-5 ambassador leaderboard,
So that contribution is celebrated without shaming anyone.

**Acceptance Criteria:**

**Given** the leaderboard (FR47),
**When** I open it,
**Then** it shows the top 5 ambassadors for all-time and rolling 3-month windows ranked by uploads and used uploads, visible to ambassadors and admins, and never shows who is last (no guilt mechanics).

### Story 9.7: Stats page & audit-trail viewer

As an admin,
I want a stats page and an audit-trail viewer,
So that I can prove program value and answer governance questions on the spot.

**Acceptance Criteria:**

**Given** the stats page (FR48),
**When** I open it,
**Then** it shows uploads over time, % used, campaigns, and top content — computable from the durable MVP KPI columns and usage/export events — as the stakeholder receipt.

**Given** the audit-trail viewer (FR48),
**When** I browse the audit trail,
**Then** I can view audit events (within their 6-month retention) in a viewer UI, closing the "log exists in MVP, viewer arrives in v1.1" gap.
