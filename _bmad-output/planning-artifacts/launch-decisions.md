---
artifact: launch-decisions
version: 1.0.0
status: decided
owner: Rasmus
date: 2026-07-08
relatedDocs:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/consent-cards.md'
  - '_bmad-output/planning-artifacts/offboarding-erasure-runbook.md'
  - '_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-08.md'
---

# Stena Content Portal — Launch-Gate Decisions

Resolutions to the non-code launch gates carried in the PRD, Architecture (AR56), UX spec, and Epics. Recorded 2026-07-08. **This document is the source of truth for these decisions;** scattered "pending/unresolved" mentions in the other specs are superseded by the entries below.

| # | Gate | Decision | Owner | Status |
|---|------|----------|-------|--------|
| 1 | Consent text legal review | **Approved** by legal | Legal | ✅ Closed |
| 2 | US-owned processors (Supabase/Vercel/Railway, EU regions under SCC/DPA) | **Accepted** | Legal | ✅ Closed |
| 3 | Art. 17 vs 6-month audit actor-name retention | **Accepted** as-designed | Legal | ✅ Closed |
| 4 | HR adoption of offboarding/erasure runbook | **Adopted**; owner = **HR Manager** (by title) | HR | ✅ Closed |
| 5 | Accessibility formal-audit requirement | **Not required** — WCAG 2.1 AA as engineering discipline, no formal audit | Stakeholder | ✅ Closed |
| 6 | SMS spending cap amount | **200 SEK / month** (46elks prepaid) | Stakeholder | ✅ Closed |
| 7 | Running-cost envelope (~$50–90/mo) | **Approved** | Stakeholder | ✅ Closed |
| 8 | Brand typeface + webfont license | **None exists** → use free UI font: **Inter (SIL OFL), self-hosted** | Rasmus | ✅ Closed |
| 9 | Colour derived-values | **Approved as recommended:** blue celebration (not green), Core Blue star (not yellow), hover/pressed tints ±8–12% | Stakeholder | ✅ Closed |
| 10 | UI copy language (EN vs SV) | **Swedish** — all user-facing copy is always Swedish | Rasmus | ✅ Closed |
| 11 | Tested backup/restore exercise | **Confirmed** as a pre-go-live ops gate (Story 7.6) | Dev/Ops | 🟡 Pre-launch task (not pre-dev) |
| 12 | Sentry observability timing | **Deferred to post-MVP** — MVP uses a structured error-logging seam (`src/shared/logger.ts`) → Vercel + Railway platform logs | Rasmus | ✅ Closed |

## Detail & implementation impact

### 1–3. Legal (consent text, US processors, Art. 17 audit retention)
Legal has **approved the consent text** (the three cards and underlying terms in `consent-cards.md`), **accepted US-owned processors** hosting personal data in EU regions under Standard Contractual Clauses + signed DPAs (Supabase, Vercel, Railway), and **accepted** that audit events retaining the actor's name for their 6-month lifetime satisfies Art. 17 as designed. The pre-implementation "confirm US-owned-only bar" flag in Epic 1 Story 1.1 is **cleared** — proceed on the specified stack. Data still resides exclusively in EU regions (eu-north-1 Stockholm, EU-West Amsterdam, Frankfurt); the SCC/DPA route is the lawful basis for the US-owned *vendors*.

### 4. Erasure runbook adopted
HR has adopted the runbook; the responsible owner is the **HR Manager** (by title — no named individual required). `offboarding-erasure-runbook.md` status updated to adopted.

### 5. Accessibility
Confirmed: no internal Stena policy mandates a formal accessibility audit for internal tools. NFR18 stands as engineering discipline (semantic HTML, keyboard operability, AA contrast, focus states) with **no certification gate**. The UX-spec "flagged assumption" is resolved.

### 6. SMS budget
The 46elks prepaid balance is the provider-side hard cap (AR33). Initial cap = **200 SEK/month**. When exhausted, the app disables SMS pre-send and shows the `BUDGET_REACHED` soft-edge message (FR36, Story 5.2). Top up the prepaid balance monthly; note 46elks' 200-day credit expiry.

### 8. Typography — resolved
There is **no official Stena brand typeface and no webfont license**. Decision: use **Inter** (SIL Open Font License, free for commercial/web embedding) as the single UI typeface.
- **Self-host the font** (bundle the woff2 files in the app / serve from our EU origin). Do **not** load from the Google Fonts CDN — that leaks visitor IPs to Google and has been ruled a GDPR violation in the EU; self-hosting keeps us consistent with the project's EU-data posture.
- Inter covers Swedish glyphs (å ä ö) and supports **tabular numerals** (`font-feature-settings: "tnum"`) required for counters/badges.
- Keep the existing provisional type scale (display 28/34 → caption 12/16) and the **non-negotiable 16 px mobile input minimum**; re-validate scale against Inter's metrics during Story 1.3. A system-font fallback stack remains for load resilience.
- This closes the UX open dependency and Story 1.3 no longer builds against a "placeholder" font — Inter is the real choice.

### 9. Colours — approved
The three derived-value decisions (UX-DR5) are approved as recommended:
- **Celebration/success = Core Blue on Light Blue** (not green — green stays brand-reserved for "Better Choice").
- **Star marker = Core Blue filled** (not yellow — yellow stays brand-reserved for Easter).
- **Hover/pressed states = programmatic tints/shades of Core Blue at ±8–12% lightness.**
The Fleet Deck token set is now fully locked; no further colour sign-offs outstanding.

### 10. Language — Swedish (significant, cross-cutting)
**All user-facing copy is Swedish**: consent cards, task/message email + SMS templates, buttons, empty states, error messages, celebration copy, dates/labels. Implementation notes:
- `consent-cards.md` now carries the **Swedish card text as the production source of truth** (English kept as the legally-approved reference). Story 3.2 renders the Swedish text verbatim.
- Outbound email/SMS templates (Story 5.1) are authored in Swedish with the personal-sender framing (e.g. "Hej Jonas — Petra behöver…").
- All UI microcopy in Epics 1–7 is Swedish; the warm/soft-edge copy register applies in Swedish.
- Locale/formatting: dates already render in Europe/Stockholm; use Swedish locale (`sv-SE`) for date/number formatting and relative-time strings.
- Code identifiers, comments, DB column names, audit-event type strings, and developer-facing docs stay in **English** — only human-visible surfaces are Swedish.
- The GIN search already uses the `simple` tsvector config (Architecture item 18) which suits Swedish names — no stemming change needed.

### 12. Sentry deferred to post-MVP (2026-07-08)
Sentry is **not** part of the MVP build. Rationale: keep MVP infrastructure lean; error visibility is adequately served by platform logs for a small internal tool.
- **MVP:** a runtime-neutral **error-logging seam** at `src/shared/logger.ts` (imported by both app and worker per the AR54 kernel rule) writes structured JSON errors and critical alerts to stdout, captured by **Vercel** (app) and **Railway** (worker) platform logs — both EU. It is the single call site for unexpected-error capture (webhooks unknown-ids, DAL unexpected errors, HMAC chain-verify failures, global error boundary).
- **Post-MVP:** add **Sentry EU (Frankfurt)** behind the same seam (`@sentry/nextjs`, org created EU-from-day-one — region immutable; `instrumentation-client.ts`, `SENTRY_DSN`, Sentry-wrapped `next.config.ts`), with no call-site changes. Add Sentry to the GDPR processor inventory at that point (EU event data, US control-plane metadata).
- Specs updated: AR5, AR13, AR35, AR52, Story 1.1, Story 1.5, Story 1.7 (renamed "CI/CD pipeline & error-logging seam"), Story 3.1, Story 5.1; architecture project tree and cost envelope (MVP ≈ $50–65/mo, Sentry $0 in MVP).

## Environment / infrastructure setup (not committed — secrets live in `.env.local`, git-ignored)

- **Supabase project created** (2026-07-08): project ref `lupjrbrqgacgmcbuzdsc`, project URL `https://lupjrbrqgacgmcbuzdsc.supabase.co`.
  - The **direct connection** string (port 5432, migrations/`DIRECT_URL`) was provided and stored in `.env.local` (git-ignored). **Do not commit credentials.**
  - **TODO at Story 1.1:** copy the exact **transaction-pooler** URL (port 6543 → `DATABASE_URL`) and **session-pooler** URL (→ `DATABASE_SESSION_URL`) from the Supabase dashboard "Connect" panel; fetch `SUPABASE_SECRET_KEY` and `NEXT_PUBLIC_SUPABASE_URL` there too; generate `ACCEPTANCE_HMAC_KEY`.
  - ⚠️ **Verify the project region is EU (eu-north-1 Stockholm)** — hard GDPR requirement (NFR9), immutable after creation. If it was created in a non-EU region, recreate before storing any data.
  - ⚠️ **Security:** the DB password was shared in plaintext chat; recommend resetting it (Supabase → Settings → Database → Reset database password) while the DB is empty, then update `.env.local`.

## Remaining pre-launch (non-blocking for development)
- **#11 Backup/restore drill** — execute the tested DB + storage restore exercise per Story 7.6 before go-live. *(Only remaining pre-launch item.)*
- ~~Legal confirmation of the Swedish consent wording~~ — **DONE 2026-07-08:** legal confirmed the Swedish plain-language cards convey the approved meaning; both language surfaces are approved.
