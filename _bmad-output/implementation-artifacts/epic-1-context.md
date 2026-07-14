# Epic 1 Context: Platform Foundation & Passwordless Access

<!-- Generated from the approved planning artifacts. Keep this file focused on shared Epic 1 implementation context. -->

## Goal

Establish the compliant platform spine that every later feature relies on: an EU-pinned Next.js/Supabase application, complete MVP data foundation, passwordless authentication, immediate session revocation, server-only role-scoped data access, immutable audit emission, shared design foundations, and gated delivery with runtime-neutral error logging.

## Stories

- **1.1 Project scaffold & EU-pinned infrastructure** — Create the mandated application and worker foundations, environment canon, hosting configuration, and processor inventory.
- **1.2 Data-layer, account & organization foundation** — Establish reproducible migrations, account state, themes, dormant campaign seams, shared primitives, and import boundaries.
- **1.3 Fleet Deck design tokens & themed component base** — Implement the shared visual, responsive, accessibility, loading, status, and error patterns.
- **1.4 Magic-link authentication & the single front door** — Deliver passwordless login, invite consumption, safe continuation routing, and expired-link recovery.
- **1.5 DAL choke point, auth contexts, role separation & revocation** — Make identity, account state, consent, role checks, and revocation structural for all data access.
- **1.6 Audit event emitter & registry** — Provide the closed, transaction-bound audit mechanism and immutable audit store.
- **1.7 CI/CD pipeline & error-logging seam** — Gate changes with automated checks and capture unexpected failures consistently in EU-hosted platform logs.

## Requirements & Constraints

- All production data and processing must remain in configured EU regions: Supabase in Stockholm, Vercel functions in Stockholm, and the Railway media worker in Amsterdam. Media bytes must travel directly between clients/workers and object storage, never through Vercel.
- Bootstrap from the official Supabase-enabled Next.js starter with the Radix variant of shadcn. Use a `src/` layout and Next.js `proxy.ts`; remove password authentication completely.
- Keep the application private and globally `noindex`; only login and link-consumption surfaces may be reachable without authentication.
- User-facing copy is Swedish. Code, schema identifiers, audit types, and developer documentation remain English. Render dates/numbers with `sv-SE` and timestamps in Europe/Stockholm.
- Enforce server-side role separation and private storage. Ambassadors may access only their own permitted data and must never receive admin-only triage fields. RLS is mandatory defense-in-depth, not the primary authorization layer.
- Account status is constrained to `invited`, `active`, `inactive_declined`, `inactive_withdrawn`, or `deactivated`; deletion removes the profile row. Admin authority exists only in server-controlled auth metadata.
- Authentication uses single-use 15-minute magic links, short access tokens, rotating refresh tokens, and global sign-out on deactivation, deletion, or consent withdrawal. Continuations must be relative and allow-listed.
- Audit events are insert-only, immutable during their six-month lifetime, and use actor/entity snapshots rather than foreign keys to mutable rows. Acceptance records and durable business events have separate retention lifecycles.
- The MVP must not include Sentry or its client/configuration. Unexpected errors and critical alerts go through one structured-JSON logger to Vercel and Railway stdout logs.

## Technical Decisions

- Use Supabase for Postgres, Auth, private Storage/TUS, queues, and cron. Use Vercel for the Next.js app and an EU Railway Docker worker for long-running media work.
- Use pinned Drizzle versions. Generate migrations into `supabase/migrations`, apply them through the Supabase CLI, and never push schema directly to production. Vercel uses transaction pooling with prepared statements disabled; workers and migrations use session/direct connections.
- Model controlled values as text columns with CHECK constraints. Provision `themes`/`asset_themes` for MVP and `campaigns`/`asset_campaigns` as dormant v2 foundations. Both joins are explicit-admin-action only; task/upload context must never infer theme or campaign connections. Campaign tables receive no MVP readers, routes, or UI.
- Keep runtime-neutral contracts and helpers in `src/shared` with no Next.js, React, or server-only imports. Enforce feature/DAL/shared/worker boundaries with lint rules; route handlers and server components must not import the database client directly.
- Use one link-consumption endpoint to verify token hashes, establish sessions, and continue safely. Expired or consumed links land on a recoverable error surface that can request a fresh link.
- Every authenticated data operation uses a role-scoped DAL and network-validates the user. Provide distinct guards for normal ambassadors, admins, pre-consent ambassadors, and trusted system jobs. The proxy performs cheap routing only.
- Normalize domain failures into a stable `{ error: { code, message, remedy? } }` contract. Central query handling owns revoked-session and consent-required redirects; feature code does not duplicate them.
- Emit mutations through `audit.emit(tx, ...)` using a closed, past-tense event registry and the active transaction handle. Commit database changes and audit records together before performing related storage work.
- CI runs typecheck, lint, unit tests, Playwright journeys, and axe checks. Main deploys apply database migrations and deploy the worker before the git-integrated application release proceeds.

## UX & Interaction Patterns

- Implement the Fleet Deck semantic palette in Tailwind CSS-first configuration. Blue leads; red is reserved for destructive/error states; green and yellow are not application-state colors. Selection, links/focus, and stars must remain visually distinct.
- Self-host Inter from the EU origin. Maintain 16px minimum mobile inputs, 44px minimum touch targets, visible 2px focus rings, semantic HTML, keyboard operation, reduced-motion support, and color-independent state communication.
- Ambassador layouts are phone-first, single-column, with 16px margins and a bottom-anchored primary action. Admin layouts use a compact responsive 12-column system, while narrow-screen “check-in” mode must omit unavailable bulk actions rather than show dead controls.
- Standardize one primary action per view, remedy-led soft error states, ambient status instead of unnecessary spinners, and skeleton loading only after 200ms.

## Cross-Story Dependencies

- Scaffold, EU service placement, environment names, project structure, and import rules must stabilize before schema, auth, CI, or worker integration is considered complete.
- The account-state schema and auth guards must evolve together; later messaging, consent, and admin flows depend on the same states and global-revocation behavior.
- Shared error codes/logger, DAL boundaries, and audit transaction contract must be available before later epics add mutations. CI must enforce these boundaries from the moment they exist.
- Design tokens and base interaction patterns are prerequisites for all later user-facing stories; do not introduce local palette, focus, loading, or error conventions downstream.
