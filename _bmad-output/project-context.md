---
project_name: 'stena-content-portal'
user_name: 'Rasmus'
date: '2026-07-08'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 130
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

_Greenfield — no code exists yet. First story scaffolds via
`npx create-next-app@latest stena-content-portal -e with-supabase`, then `npx shadcn@latest init -b radix`.
Versions verified 2026-07-07. Full rationale: `_bmad-output/planning-artifacts/architecture.md`._

| Layer | Technology | Version | Critical constraint |
|---|---|---|---|
| Runtime | Node.js | ≥ 20.9 app / node:22 worker | Worker Docker image is `node:22` (Node 20 past EOL) |
| Framework | Next.js | 16.2.x App Router | `proxy.ts`, NOT `middleware.ts` (Next 16 rename). Dynamic-by-default; do NOT enable `cacheComponents`. `next build` no longer lints |
| UI | React | 19.2.x | |
| Language | TypeScript | strict | |
| Styling | Tailwind | v4 | CSS-first config (tokens in `globals.css`, no JS config file) |
| Components | shadcn/ui | CLI ≥ 4.13 | MUST init `-b radix` — Base UI became the shadcn default July 2026; this project is Radix per UX spec |
| Backend | Supabase (Postgres, Auth, Storage+TUS, Queues/pgmq, Cron/pg_cron) | — | Project region **eu-north-1 (Stockholm)** — immutable at creation; magic-link auth only, no passwords |
| Supabase↔Next | @supabase/ssr | current | Two-client pattern (browser + server factories) |
| ORM | drizzle-orm / drizzle-kit | 0.45.2 / 0.31.10 | Pre-1.0: pin EXACT versions, upgrade only in lockstep |
| Validation | Zod | 4.4.3 | Write v4 API, never v3: unified `error` param, top-level `z.email()`, `.issues` not `.errors`, two-arg `z.record()`, output-typed `.default()` |
| Server state | @tanstack/react-query | 5.101.2 | RSC prefetch + `HydrationBoundary` |
| URL state | nuqs | 2.9.0 | `NuqsAdapter` for App Router |
| Forms | react-hook-form / @hookform/resolvers | 7.81.0 / 5.4.0 | Zod 4 resolver |
| Virtualization | @tanstack/react-virtual | 3.14.5 | GalleryGrid |
| Uploads | @uppy/core / @uppy/tus | 5.2.0 / 5.1.1 | Uppy 5 breaking changes: subpath React components, `UppyContextProvider`, new CSS paths |
| Media (worker) | ffmpeg / sharp | 8.1.2 static / 0.35.3 | ffmpeg **8.1+ mandatory** (tiled HEIC decode — 8.0 cannot); prebuilt sharp excludes HEIC → HEIC stills route through ffmpeg |
| Observability | @sentry/nextjs | 10.63.0 | Sentry org region EU (Frankfurt) — immutable at org creation |
| Testing | Vitest / Playwright / @axe-core/playwright | 4.1.10 / 1.61.1 / 4.12.1 | |
| Lint | ESLint | 9 flat config | Runs as its own CI step, includes `no-restricted-imports` boundary rules |

**Hosting & providers (every slot EU-pinned — NFR9 gate):** Vercel Pro functions pinned `arn1` Stockholm (app) · Railway EU West Amsterdam (worker Docker) · Brevo (email + SMTP for Supabase Auth mail) · 46elks (SMS; prepaid balance IS the budget cap — never switch to invoice billing) · Sentry EU.

**Deploy shape:** one Next.js app (Vercel) + one Docker worker (Railway) + Supabase. Worker ↔ app communicate ONLY via Postgres (pgmq + status columns) and object storage — never HTTP. Media bytes never transit Vercel (TUS direct-to-storage up, 302-signed-URL down).

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

**Type namespace rule (leak prevention):**
- Drizzle row types take the `Row` suffix: `type AssetRow = typeof assets.$inferSelect`. Zod-inferred
  wire types own the bare name (`Asset`). Components, route handlers, and TanStack caches carry wire
  types ONLY — the DAL is the single layer mapping Row → wire.
- Role-scoped wire types omit admin-only fields at the type level (`AmbassadorAsset` has no
  `starred`/`dismissed`/`triaged_at`) so a praise/triage leak is a compile error, not a code review find.

**Import boundaries (eslint `no-restricted-imports`-enforced — violations are bugs):**
- Every `features/*/dal/*.ts` module starts with `import "server-only"`.
- `src/shared/` is runtime-neutral: no `server-only`, no `next/*`, no React — the Railway worker imports it.
- `worker/` imports ONLY `src/db/schema`, `src/shared`, and its own `worker/lib/`. Never `src/lib`
  (app-only auth contexts) or `src/features`. Worker jobs pass `actor: 'system'` explicitly.
- Features never import each other's `dal/`. Cross-feature server logic lives in `src/lib`
  (deletion, auth) or `src/shared`; cross-feature UI in `src/components/shared/`.
- Code under `(ambassador)` never imports `features/*/dal/admin.ts` (build-level role separation).
- Route files under `app/` compose features — they contain no business logic.

**Error handling:**
- DAL throws typed `DomainError` subclasses (`code` + user-safe `message` + optional `remedy`) from
  `src/lib/errors.ts`. Route handlers map them to the envelope `{ error: { code, message, remedy? } }`
  with the canonical HTTP status — never 200-with-error, never a raw provider payload.
- Server actions never throw to the client — they return the same error object. Server actions are
  allowed ONLY for non-interactive form posts (consent accept/decline, login email); every other
  client-interactive mutation is a route handler consumed via `useMutation`.
- Sentry captures unexpected errors only — domain errors are product states, not incidents.

**Validation & serialization:**
- Zod 4 is the single validation layer, shared client + server: feature schemas in `features/*/schemas/`,
  queue payload schemas in `src/shared/queue-payloads.ts`. Validate at every boundary: forms, route
  handlers, webhook payloads (after signature verification), queue message consumption.
- Never inline limits/caps — import from `src/shared/limits.ts` (also owns `UPLOAD_CHUNK_SIZE`).
- Wire dates are ISO-8601 UTC strings; render timestamps ONLY via the Europe/Stockholm `Intl` helper
  in `src/shared/datetime.ts`. Nullable fields serialize as `null` (never omitted); IDs are UUID v4.

### Framework-Specific Rules

**Next.js 16:**
- `src/proxy.ts` (NOT `middleware.ts`) does cheap `getClaims()` route gating ONLY. The real security
  boundary is the DAL: every authenticated request calls `getUser()` (network-validated) + account-state
  + consent checks there. Reason: sign-out kills DB sessions but issued JWTs stay valid until expiry
  (10 min), and `getClaims()` validates locally only — middleware alone can NEVER satisfy the
  immediate-revocation requirement.
- Reads = server components (RSC prefetch + `HydrationBoundary`). Client-interactive mutations = route
  handlers via `useMutation`. No separate API tier, no API versioning (no external consumers).
- Route groups do NOT prefix URLs: `(ambassador)` owns the root namespace (`/` → redirect `/tasks`,
  `/upload`, `/my-uploads`, `/profile`); admin pages live under a real `/admin` segment inside `(admin)`.
- Auth namespace is fixed: `/auth/login`, `/auth/confirm` (route handler — the ONE front door for
  token_hash verification), `/auth/consent`, `/auth/error` (expired-link landing).
- The continuation param is `next` everywhere (login, consent gate, `emailRedirectTo`) — relative
  paths only, allow-listed. Global `noindex` headers.
- Media URLs: JSON payloads carry stable app URLs only — `/api/assets/[assetId]/file?kind=thumb|preview|original`
  → DAL access check → 302 to a 60 s signed URL (thumb/preview 302s get `Cache-Control: private, max-age=300`).
  NEVER embed signed URLs in list JSON — they expire inside the query cache and break the virtualized grid.

**Auth contexts (exactly four — from `src/lib/auth.ts`, never hand-roll):**
1. `requireUser()` — ambassador default: `getUser()` + account-state check + consent-version gate.
2. `requireAdmin()` — `getUser()` + `app_metadata.admin` flag + account-state. NO consent gate
   (consent cards apply to ambassadors only).
3. `requireUserPreConsent()` — consent gate skipped; allowed ONLY in getCurrentTerms / acceptTerms /
   declineTerms / withdrawConsent / getOwnAccountState.
4. `systemContext()` — no session; importable only from `app/api/webhooks/*` and cron entries.
   Audit actor: `actor_id: null`, `actor_name_snapshot: 'system'`. The worker uses its own
   worker-local context, passing `actor: 'system'`.

**Supabase:**
- Browser client is for Auth + TUS uploads ONLY. Client-side `.from()` table access is a violation —
  RLS is defense-in-depth backstop, never the API. All table access goes through DAL modules.
- Client factories only at `src/lib/supabase/{browser,server,admin}.ts`.
- Revocation on deactivate/delete/withdraw = `supabase.auth.admin.signOut(userId)` (global, all devices).
- Session policy: access JWT 10 min · rotating refresh tokens · ~30-day inactivity + ~180-day time-box ·
  magic links 15 min single-use. Supabase Auth emails go through custom SMTP (Brevo), not built-in.

**Drizzle:**
- Client configured `casing: 'snake_case'` — write TS camelCase, DB stores snake_case. Never mix.
- Enums are text columns with `{ enum: [...] }` + a DB CHECK constraint — NO `pgEnum`/`CREATE TYPE`
  (planned enum growth: `origin` gains `generated` in v1.1).
- Connections: app (Vercel) → Supavisor transaction pooler port 6543 with `postgres(url, { prepare: false })`
  (prepared statements unsupported); worker → `DATABASE_SESSION_URL`; migrations → `DIRECT_URL` only.
- Schema: one file per domain in `src/db/schema/*.ts`, re-exported from `index.ts`. `audit.ts` holds the
  expiring class ONLY; `usage.ts`/`exports.ts`/`messaging.ts` are the durable class.

**TanStack Query + client state (three-category doctrine):**
- Server state in TanStack Query. Filter/sort/search state is URL-canonical via nuqs (camelCase params;
  components read the URL, never `useState`; query keys derive from parsed URL state). Local UI state in
  components. NO global client store — single exception: the Uppy instance in a React context provider.
- Per-feature key factories (`assetKeys.list(filters)`); default `staleTime` 30 s; polling via
  `refetchInterval`: processing 3 s · exports 5 s · delivery status 15 s — all stop on terminal states.
  Constants live in `src/lib/query-config.ts`, never inline.
- Optimistic-update verb table (closed — new verbs default to server-ack):
  OPTIMISTIC (onMutate patch + rollback + invalidate on settle): star/unstar, tag/untag.
  SERVER-ACK then invalidate: dismiss/mark-triaged, task mark-done, sends, profile edits.
  NEVER optimistic (honest-state doctrine): uploads, processing, exports, consent, deletion, budget state.
- Global error handling: ONE `QueryCache`/`MutationCache` `onError` in the QueryClient factory —
  `SESSION_REVOKED` → sign out + `/auth/login?next={current}`; `CONSENT_REQUIRED` → `/auth/consent?next={current}`.
  Features NEVER handle these two codes locally. RSC equivalent: `redirect()` inside the auth guards.
- Loading UX: skeletons after a 200 ms delay, layout space reserved, no blocking spinners; use
  TanStack `isPending` naming.

**Uppy → Supabase TUS:**
- Endpoint `https://{projectId}.storage.supabase.co/storage/v1/upload/resumable`; chunk size EXACTLY
  6 MB (Supabase-mandated — never change); `retryDelays [0, 3000, 5000, 10000, 20000]`.
- Auth headers supplied DYNAMICALLY (function-form / `onBeforeRequest`) pulling the current session
  token from supabase-js — a 401 on a chunk PATCH means refresh-and-retry, never terminal failure
  (multi-GB uploads outlive the 10-min JWT).
- Golden-Retriever-style state persistence for interruption safety; TUS metadata =
  `{ bucketName, objectName, contentType, cacheControl }`.

### Testing Rules

- **Stack:** Vitest (unit/integration, co-located `*.test.ts(x)` next to source) · Playwright in `e2e/`
  (page objects in `e2e/pages/`, fixtures in `e2e/fixtures/`) · @axe-core/playwright for accessibility.
- **DAL tests are non-negotiable:** every DAL function gets a co-located test — the DAL carries the
  compliance spine (auth context, role scoping, audit emission), so its tests are the compliance tests.
- **Journey-level changes require Playwright coverage** in the five critical-flow specs:
  `onboarding-consent`, `task-upload`, `triage`, `library-export`, `offboarding`. Each spec embeds
  axe checks — AA is the floor (NFR18); an axe violation is a test failure, not a warning.
- **E2E runs against the local Supabase stack** (`supabase start`), not mocks of Supabase.
- **Named hard cases that must stay covered** (from architecture validation):
  - Long-upload token rollover: session JWT refresh mid-TUS-upload; 401 on chunk PATCH → refresh-and-retry.
  - Throttled-4G check: notification link → interactive task list < 3 s (the pinned NFR1 contract).
- **Queue handlers are tested for idempotency:** re-delivering an already-completed job's message is a
  no-op success (handler checks the entity's status column first).
- **Webhook handler tests cover the security contract:** unverified signature → 401 with no detail;
  unknown `provider_message_id` → 200 + Sentry log; the status lattice never downgrades `delivered`.
- **Definition of done for every story:** typecheck + lint + Vitest green locally before completion;
  Playwright specs updated for journey-level changes.
- **No coverage-percentage gate exists — do not invent one.** The gates are the rules above.

### Code Quality & Style Rules

**Naming (one system, no exceptions):**
- Files: kebab-case ALWAYS (`triage-queue.tsx` exports `TriageQueue`); hooks `use-*.ts`;
  components/types PascalCase; functions/variables camelCase; true constants SCREAMING_SNAKE.
- DB: tables snake_case plural; columns snake_case; PK `id uuid DEFAULT gen_random_uuid()`;
  FKs `<singular>_id`; timestamps `created_at`/`updated_at` (timestamptz); indexes `idx_<table>_<cols>`;
  enum values snake_case. Two tables deliberately break the generic rules — `acceptance_records` and
  `audit_events` (see Critical Don't-Miss Rules).
- API: kebab-case plural resource paths (`/api/assets/[assetId]/tags`); camelCase dynamic/query params
  and JSON wire; pgmq queues snake_case (`transcode_jobs`, `export_jobs`, `maintenance_jobs`);
  audit event types dot-notation past tense (`asset.uploaded`).

**Project structure (fixed — do not reorganize):**
- Features: `upload, triage, library, consent, tasks, messaging, ambassadors, export` under
  `src/features/<feature>/{dal, queries, components, schemas, hooks}`. The ambassador-management
  feature is named `ambassadors`, NOT `admin` (avoids collision with the `(admin)` route group and
  the `dal/admin.ts` role convention).
- Where a feature serves both roles, split `dal/ambassador.ts` / `dal/admin.ts` — the ambassador file
  physically contains no triage-signal joins.
- shadcn components in `src/components/ui/` are owned code and may be edited — any deviation from
  stock gets `// customized: <reason>` at the top (so a future `shadcn add` overwrite is caught in
  diff). Feature-specific behavior goes in feature wrappers, never in `ui/`.

**API response format:**
- Lists are ALWAYS `{ items: T[], nextCursor: string | null }` — opaque keyset cursor; no offset
  pagination, no bare arrays.
- Canonical error-code → HTTP status map (single source: `src/shared/error-codes.ts`):
  `AUTH_REQUIRED`/`SESSION_REVOKED` → 401 · `FORBIDDEN`/`ACCOUNT_INACTIVE` → 403 · `NOT_FOUND` → 404 ·
  `CONSENT_REQUIRED` → 409 (carries `next`) · `CONFLICT`/`UPLOAD_INCOMPLETE` → 409 · `LINK_EXPIRED` → 410
  (remedy: request new link) · `FILE_TOO_LARGE` → 413 · `UNSUPPORTED_FILE_TYPE` → 415 ·
  `VALIDATION_FAILED` → 422 (field details) · `BUDGET_REACHED` → 429 ·
  `RENDITION_FAILED`/`EXPORT_FAILED` → 500-class + retryable flag.

**UI style law (Fleet Deck — from the UX spec):**
- Brand palette ONLY, no off-palette values. Tokens: `surface` white #ffffff · `surface-panel` beige
  #eae3d2 (bounded things: cards/panels/input groups; page backgrounds stay white; never nest
  beige-on-beige) · `surface-media` black #1a1a1a (triage queue, lightbox) · `action-primary` Core Blue
  #034592 · `link`/`focus-ring` #3344dd · `info`/`selected-bg` Light Blue #cbe1f6 · `destructive`
  Core Red #e41f1f · `caution-bg` Pink #fbd4cd.
- Red means destructive/error ONLY. Green (#1c5e38) and yellow (#feca3a) are brand-reserved — never
  used in the portal. Celebration/success is blue-family, not green. The star mark is Core Blue filled,
  not yellow. Blue never stacks meanings: selection is always Light Blue; if Core Blue would carry two
  meanings at once, one moves to Light Blue or black.
- AA contrast floor everywhere: white text on dark, black text on light, no exceptions. Text over
  photos/video always sits on a scrim (black 40–60%, white text). Color never carries meaning alone
  (icon + text/state). Visible 2 px focus ring on every interactive element. `prefers-reduced-motion`
  respected — celebration moments have a static variant.
- Type & layout: 16 px minimum body on mobile (non-negotiable — prevents iOS zoom); sentence case
  everywhere (no all-caps except tiny badges); tabular numerals for counts; 4 px spacing base
  (4/8/12/16/24/32/48/64); touch targets ≥ 44 px; ambassador surface single-column with bottom-anchored
  primary CTA; admin content max-width 1440 px, left filter rail 256 px.
- Copy register: warm, soft-edge — errors state *what happened / why / the remedy*; never blame the
  user; never surface raw provider text. UI copy language (English vs Swedish) is an OPEN stakeholder
  question — keep user-facing copy centralized and swappable, don't scatter literals.
- Font family is PENDING the brand typeface: use the placeholder system grotesque stack
  (`-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`); do not commit to a webfont.

### Development Workflow Rules

**Local development:**
- `supabase start` (local stack) → `npm run dev` (app, Turbopack) + `npm run worker` (tsx watch;
  ffmpeg installed locally or via the worker Docker image). Seed: `supabase/seed.sql` (terms v1 + dev admin).
- package.json script canon: `dev, build, worker, test, e2e, db:generate, db:push`.

**Migrations (single schema source of truth = `supabase/migrations/`):**
- Flow: edit Drizzle schema → `npm run db:generate` (drizzle-kit generate, `out: './supabase/migrations'`,
  `migrations.prefix: 'supabase'`) → apply via Supabase CLI: `supabase migration up` locally,
  `supabase db push` in CI.
- NEVER `drizzle-kit push` against production. NEVER hand-apply SQL to the remote DB.
- pg_cron definitions are versioned migrations too (`NNNN_cron_jobs.sql`): the audit-expiry SQL and
  the scheduled `maintenance_jobs` enqueues.

**CI/CD (GitHub Actions):**
- PR pipeline: typecheck → lint → Vitest → Playwright + axe (against local Supabase). Nothing merges red.
- main pipeline: same checks → `supabase db push` → Railway worker deploy
  (`ghcr.io/railwayapp/cli` container + project-token `railway up`). Vercel deploys via git
  integration (preview per PR, production on main), gated by the same checks.
- Branch-naming and commit-message conventions are NOT mandated by the docs — don't invent gates;
  the CI checks are the gate.

**Environment variables (canon lives in `.env.example` — keep it complete):**
`NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SECRET_KEY` ·
`DATABASE_URL` (transaction pooler :6543, app) · `DATABASE_SESSION_URL` (worker) ·
`DIRECT_URL` (migrations) · `ACCEPTANCE_HMAC_KEY` (app + worker env — NEVER stored in the DB) ·
`BREVO_API_KEY` · `BREVO_WEBHOOK_SECRET` · `ELKS_API_USERNAME` · `ELKS_API_PASSWORD` · `SENTRY_DSN`.

**Operational scripts (deliberately not UI features):**
- `scripts/create-admin.ts` — admin provisioning via service role (sets `app_metadata.admin`,
  creates the profile row); first admin seeded manually at setup. There is NO admin-signup UI — don't build one.
- `scripts/publish-terms.ts` — publishes a new terms version through the consent DAL
  (emits `terms.version_created`).

**Build order & governance:**
- Implementation sequence: scaffold → data model/migrations → auth spine (the DAL first — it's the
  choke point every feature hangs off) → upload + transcode pipeline → library/triage/export →
  messaging → cron/CI hardening.
- Patterns change ONLY by editing `_bmad-output/planning-artifacts/architecture.md` (noting why),
  then syncing this file. Within that document, later sections govern — the amendments and
  validation decisions 1–24 are authoritative over earlier prose.
- Right-sizing guardrails are decisions, not oversights: NO CDN, NO search engine, NO HA/multi-AZ,
  NO HLS packaging, NO storage lifecycle tiering, polling over realtime/websockets. Do not add
  infrastructure the architecture explicitly declined.

### Critical Don't-Miss Rules

**Deletion & retention law:**
- NO SOFT DELETE anywhere. Deletes are permanent, evidenced by audit events. Never reintroduce
  soft delete "for safety" — a soft-deleted row is lingering personal data. Account deletion is row
  removal; `deleted` is NOT an account_state value.
- Triage dismiss is `markTriaged()` — a queue-membership flag (`triaged_at`). It NEVER shares a code
  path with deletion.
- ONE delete path: `deleteAssets(assetIds, { mode: 'delete' | 'erasure' })` in `src/lib/deletion.ts`,
  used by all three surfaces (ambassador delete-own, admin delete, offboarding bulk). `delete` removes
  originals + renditions + derived data + rows but PRESERVES usage/export event rows (id + snapshot refs).
  `erasure` additionally purges actor attributions in usage/export events, purges recipient PII in
  `send_records` (contact fields nulled, `raw_events` scrubbed), force-expires exports-bucket zips
  referencing erased assets, sweeps the backup replica, and crypto-shreds acceptance-record PII
  (delete per-user key + signed tombstone). The audit event records which mode ran.
- Run `getDeletionImpact(assetIds)` before every ConsequenceDialog (returns `{count, generatedChildren: []}`;
  MVP children always empty — v1.1 fills it from provenance edges).
- Offboarding erasure ORDER is fixed: (1) deactivate + `auth.admin.signOut(userId)` → (2) `deleteAssets(…,
  {mode:'erasure'})` → (3) `deleteAccount(profileId)` → (4) write a durable `erasure_records` row
  (executor, when, counts — no subject PII) so erasure evidence survives audit expiry.
- Four retention classes are table law: content (live until deleted, then completely gone) ·
  `audit_events` (immutable, 6-month pg_cron expiry — the expiry job is scoped to that ONE table by name) ·
  `usage_events`/`export_records`/`export_items`/`send_records` (durable, NO expiry — mutable only for
  erasure attribution purges) · `acceptance_records` (append-only, indefinite, exempt from everything).

**Consent & audit spine:**
- `acceptance_records`: INSERT-only (DB grants + trigger), no `updated_at`, NO FK to profiles/auth.users —
  denormalized identity snapshots (`user_id_snapshot`, `user_email_snapshot`, `user_name_snapshot`).
  PII snapshot columns encrypted per-user (`consent_pii_keys` table). `hmac` + `prev_hmac` chain per
  record; key = `ACCEPTANCE_HMAC_KEY` env, NEVER in the DB. Chain verified on schedule by the worker
  (`verify-acceptance-chain`); tombstoned users' records count as valid.
- `audit_events`: INSERT-only, no `updated_at`, `occurred_at` not `created_at`; references entities by
  `entity_id` + `entity_snapshot` jsonb — NEVER an FK to live rows. Never modified by erasure.
- The audit registry is CLOSED: `audit.emit()` accepts only the union in `src/shared/audit-events.ts`.
  Deliberately NOT audited: star/tag/dismiss triage verbs, delivery-status lattice updates, tag CRUD.
  Don't add event types ad hoc; don't skip emission where a registry type exists.
- THE transaction shape — every mutating DAL function:
  `db.transaction(async (tx) => { …mutation…; await audit.emit(tx, …); await jobs.enqueue(tx, …); })`.
  Passing the global client instead of `tx` is a violation (ghost audit events on rollback).
  Storage-coupled mutations: DB rows + audit commit FIRST, storage operations after commit; orphaned
  storage objects are the orphan-GC job's problem, not a rollback's.
- KPI columns are durable and DAL-updated — NEVER derive KPIs from the expiring audit log:
  `profiles.invited_at/first_accepted_at/first_upload_at/last_login_at`, `tasks.created_at/fulfilled_at`,
  `task_recipients.completed_at`. Task completion is PER-RECIPIENT; `tasks.fulfilled_at` = first
  recipient completion (feeds the 7-day fulfillment KPI).

**Upload pipeline invariants (NFR13 — the make-or-break subsystem):**
- Staging is a DB state, not a bucket: init creates the asset row `processing_status='pending'`
  (library-INVISIBLE) and returns `{assetId, objectKey}`; client TUS-uploads direct to storage;
  `POST /api/uploads/[assetId]/commit` verifies via S3 HEAD (existence + size vs declaredSize +
  type-sniff of leading bytes), flips to `'processing'`, and enqueues `transcode_jobs` — verification
  and enqueue in ONE transaction. No partial upload is ever library-visible.
- Commit is IDEMPOTENT: already `processing`/`ready` → 200 no-op. Failure semantics: size/type
  mismatch → delete staged object immediately + `FILE_TOO_LARGE`/`UNSUPPORTED_FILE_TYPE`; object
  missing/incomplete → `UPLOAD_INCOMPLETE` (409), row stays `pending` for retry-or-GC.
- There is deliberately NO checksum step — TUS offset completion + size match IS the commit gate.
- Buckets (ALL private): `originals` (immutable, written once at commit) · `renditions` (regenerable,
  written ONLY by the worker) · `exports` (regenerable zips, 7-day TTL). Keys:
  `assets/{assetId}/original.{ext}`, `assets/{assetId}/{kind}.{ext}`, `exports/{exportId}.zip`.
  Storage RLS: originals INSERT requires matching pending row + `uploader_id = auth.uid()`;
  renditions/exports have NO client-write policies.
- Originals stay bit-exact forever; HEIC/HEVC conversion happens in transcoding ONLY; renditions are
  pre-generated at upload — never on demand. Closed rendition set: image `thumb` (webp ~400px) +
  `preview` (webp ~1600px); video `poster` (jpg) + `thumb` + `preview` (faststart mp4 720p);
  audio/docs none (type icon). Partial rendition failure = asset `failed`, partial renditions deleted
  first (all-or-nothing); retry via `POST /api/assets/[assetId]/retry-processing`.
- Video duration (~5 min) is ADVISORY COPY only — 2 GB size is the enforced limit. Per-type caps:
  images ≤ 50 MB, video ≤ 2 GB, audio/docs ≤ 200 MB — validated client-side AND re-enforced server-side,
  both from `src/shared/limits.ts`.

**Messaging & webhooks:**
- Verify Brevo signature / 46elks Basic-auth BEFORE parsing the body; unverified → 401, no detail.
- Resolve deliveries by `provider_message_id` (UNIQUE per provider); statuses move through a MONOTONIC
  lattice — never downgrade `delivered`; append raw payloads to `raw_events`; unknown ids → 200 + Sentry log.
- Send-suppression for inactive accounts lives in the dispatch path (not in callers). Channels are
  isolated: SMS failure never blocks email — independent per-channel dispatch with bounded timeouts.
- SMS budget is a persisted BINARY state from the last 46elks response (403 "Not enough credits" →
  flag set, SMS disabled pre-send until `/me` shows balance). Brevo quota-exceeded maps to
  `BUDGET_REACHED` exactly like SMS. Never build projected-spend math.
- Provider adapters (`features/messaging/adapters/{brevo,elks}.ts`) are the ONLY modules touching
  provider APIs; error normalization + budget state live inside them.

**Queues & worker:**
- Handlers are IDEMPOTENT: check the entity's status column first; "already done" = success.
  Payloads are versioned `{ v: 1, … }` and Zod-validated on consume. Max 3 receives → archive +
  mark entity `failed` (UI-retryable). Temp-file hygiene per job.

**Concurrency & triage:**
- Queue predicate: `triaged_at IS NULL AND processing_status IN ('processing','ready')`, ordered
  `created_at ASC`. Star/tag endpoints set `triaged_at` server-side as a side effect; library
  BULK-tags does NOT set `triaged_at` (bulk ops are not triage).
- Multi-admin model is last-write-wins; `triaged_at` is a shared flag (Z-undo clears it regardless of
  who set it); queue position is per-admin CLIENT state; asset deleted while another admin views it →
  advance with a quiet standard `NOT_FOUND` envelope.

**v1.1 seams (build the seams, NOT the features):**
- `origin` enum is three-valued from day one: `ambassador | admin | generated` — even though nothing
  writes `generated` in MVP. Asset identity anticipates version chains + provenance edges.
- Tasks/events carry nullable campaign seams; `/auth/confirm` token handling anticipates a `purpose`
  param; `assets.task_id` (nullable FK) is set at upload-init when the flow enters from a task,
  validated against an open task addressed to the session user.
- `tasks.due_at` is nullable and DISPLAY-ONLY (badge + expired-quiet state) — no enforcement, no
  reminders, no effect on the fulfillment KPI.
- Search is GIN tsvector over description + tag names with the `simple` config (Swedish names don't
  stem well) — no search engine.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- When this file and `_bmad-output/planning-artifacts/architecture.md` disagree, the architecture
  document governs (its amendments and validation decisions 1–24 over earlier prose) — then fix this file

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when the technology stack or patterns change (change the architecture document first, then sync here)
- Review periodically for outdated rules; remove rules that become obvious once code exists
- Open items awaiting stakeholder/legal input: UI copy language (EN vs SV), brand typeface + webfont
  license, US-processor legal bar, SMS cap amounts

Last Updated: 2026-07-08
