---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation (skipped - no innovation signals)', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete', 'step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit']
completedAt: '2026-07-06'
date: '2026-07-12'
classification:
  projectType: web_app
  domain: general (internal HR/marketing content management, GDPR-sensitive)
  complexity: medium
  projectContext: greenfield
inputDocuments:
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-02-2012.md'
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 1
  projectDocs: 0
workflowType: 'prd'
workflow: 'edit'
lastEdited: '2026-07-12'
editHistory:
  - date: '2026-07-06'
    changes: 'Post-validation fixes: quantified NFR2/NFR3/NFR10/NFR16; tightened FR9/FR11/FR19/FR36 wording; fixed export filename collision (FR30 + scope item 6); added Journey 5 (v1.1 generate-publish-prove loop) closing traceability gaps; promoted consent cards and offboarding/erasure runbook to standalone versioned artifacts; rewrote References'
  - date: '2026-07-12'
    changes: 'Applied the approved Sprint Change Proposal 2026-07-10: replaced the freeform taxonomy with curated MVP themes; provisioned dormant campaign seams for an admin-only v2 calendar; preserved the independent v1.1 usage loop; synchronized journeys, requirements, scope, phasing, and terminology; and completed post-validation cleanup of FR/NFR implementation leakage and frontmatter metadata.'
---

# Product Requirements Document - stena-content-portal

**Author:** Rasmus
**Date:** 2026-07-06

## Executive Summary

The Stena Content Portal is an internal, mobile-first web platform that turns 10–20 employee ambassadors into a steady, consented source of authentic media content — and gives Stena's HR/marketing admins one fast library to request, organize, and publish from.

Today, authentic employee content dies in a silent hole: clips are scattered across personal phones, chat threads, and shared drives; nobody can prove what is cleared for use; contributors never learn whether their material mattered and stop contributing. The portal replaces this with a closed content-request loop: admins send a request (email/SMS), ambassadors fulfill it from their phone in a 90-second moment, admins triage new arrivals in an inbox-style queue, assign curated themes, star keepers, and export publish-ready assets with human-readable filenames — from "need content" to published asset in under 10 minutes.

The product ships in three deliberate stages. The MVP fills the library, establishes the request → upload → organize → export loop, exposes curated themes, and provisions campaign data seams without campaign UI. A fast-follow v1.1 exploits the filled library through AI content generation with full source provenance, one-click LinkedIn sharing, used-content tracking, program insights, and an ambassador leaderboard. An admin-only campaign calendar follows in v2. AI generation is deferred precisely because it needs a full library to be useful — preserving focused launch moments instead of one risky big bang.

### What Makes This Special

- **The task is the trigger.** This is not an upload dumping ground; it is a content-request loop. Contribution is dual-mode — admin-pulled (tasks via SMS/email) and spontaneous — but the pull loop is the engine that keeps the library filling on demand.
- **Consent is structural, not a checkbox.** Versioned terms, plain-language consent cards, stored acceptance records, re-accept-on-change, and a documented offboarding/erasure runbook mean every asset in the library is provably usable. This is the difference between "we have content" and "we can legally publish this" — with zero-incident GDPR traceability as an explicit success criterion.
- **One asset model, three origins.** Ambassador uploads, admin brand assets, and (v1.1) AI-generated content are a single Asset entity (`origin: ambassador | admin | generated`) sharing curated themes, auto-derived type categories, and full provenance. Assets and themes are many-to-many, and connections require explicit admin action; generated content carries a family tree back to its sources without inheriting organization from them.
- **Motivation runs on proof of use.** Ambassadors are notified when their content is used; leaderboards count "used in published content," not raw volume; admins get a stats page proving program value. Triage signals (stars, dismissals) stay admin-private — praise in public, triage in private.

## Project Classification

- **Project Type:** Web application (responsive, mobile-first; no native app)
- **Domain:** Internal HR/marketing content management — general domain with GDPR-sensitive obligations (employee personal data, likeness consent, EU data residency)
- **Complexity:** Medium — consent/GDPR governance, large-file media handling with transcoding pipeline, deferred-but-designed-for AI generation layer
- **Project Context:** Greenfield; internal-facing; ~10–20 ambassador users plus a small HR/marketing admin team

## Success Criteria

### User Success

**Ambassadors** (contribution must fit a 90-second phone moment):

- An ambassador can go from task notification (SMS/email) → logged in → content uploaded in under 2 minutes on a mobile device.
- Batch upload from camera roll works without per-file forms; uploads survive patchy connectivity via chunked auto-retry (no user-visible failure at 80%).
- Every ambassador whose content is used in published material is notified — no contribution disappears into a silent hole.
- Declining terms is a paused state, not a dead end: ambassadors can return and accept later without admin intervention.

**Admins** (the library must be faster than the old way):

- An admin can go from "need content" → exported, publish-ready asset in **under 10 minutes**.
- The "new this week" triage queue lets an admin review, assign curated themes, and star 40 new uploads in a single sitting with instant previews.
- Any asset is findable by ambassador, type, date, or theme in seconds; admins can open a theme to browse its connected uploads.

### Business Success

First 6 months after MVP launch:

- ≥ 70% of invited ambassadors accept terms and upload at least once.
- ≥ 50% of content request tasks fulfilled within 7 days.
- ≥ 25% of uploads eventually marked "used" in published content.
- v1.1 (AI generation, LinkedIn share, used-content tracking, program insights, leaderboard) ships as a fast follow ~4–6 weeks after MVP, exploiting the filled library independently of campaigns.
- The stats page can prove the program's value to the stakeholder — uploads over time, % used, top content — as the "receipt" justifying continued investment.

### Technical Success

- **Zero consent/GDPR incidents**; every terms acceptance traceable to user + terms version + timestamp.
- All hosting, file storage, and processing in **EU regions** (employee personal data, GDPR).
- Original files preserved at full quality; every upload gets web-friendly preview renditions + thumbnails via the transcoding pipeline — previews load fast on mobile.
- File size limits enforced client-side before upload starts: images ≤ 50 MB, video ≤ 2 GB / ~5 min, audio/docs ≤ 200 MB.
- Audit events (deletes, uploads, exports, shares, used-confirmations) logged from day one.
- Third-party spend (SMS, later AI) capped provider-side; the app surfaces a friendly "budget reached" error instead of a cryptic failure.

### Measurable Outcomes

| Outcome | Target | Window |
|---|---|---|
| Ambassador activation (accepted terms + ≥1 upload) | ≥ 70% of invited | 6 months |
| Task fulfillment within 7 days | ≥ 50% of tasks | 6 months |
| Uploads marked "used" in published content | ≥ 25% | 6 months |
| Request → exported asset (admin) | < 10 minutes | continuous |
| Task link → upload complete (ambassador, mobile) | < 2 minutes | continuous |
| Consent/GDPR incidents | 0 | continuous |
| Acceptance records traceable to terms version | 100% | continuous |

*Note:* criteria involving the usage loop (usage notifications, "used" marking, stats-page receipt) activate with v1.1 (~4–6 weeks post-MVP); the 6-month measurement window accommodates this.

## Product Scope

### MVP - Minimum Viable Product

*"The library fills and content flows out."*

1. **Login + consent** — magic-link email login (no passwords), 3-card plain-language consent, versioned terms, acceptance records, re-accept-on-change
2. **Ambassador upload** — camera-roll-first batch upload + capture mode, descriptions, delete-own, per-type size limits, chunked auto-retry
3. **Content request tasks** — in-app task list, mark-done by either side, notification via plain email/SMS (no magic-link deep-links in MVP)
4. **Messaging** — email AND SMS, to one ambassador or all active ambassadors
5. **Admin library** — filters (ambassador/type/category/date/theme), theme browse views, transcoding + thumbnail pipeline, admin-private starring, "new this week" triage queue with curated theme assignment
6. **Themes + zip export** — admin-managed curated themes with create/view/update/archive/restore lifecycle, guarded hard-delete only at zero connected assets, explicit individual and bulk many-to-many asset assignment, and `{ambassador-name}-{upload-date}-{nn}` filenames in zip (sequence suffix disambiguates same-day batches)
7. **Ambassador management** — invite by email, activate/deactivate, delete, last-login/activity; contact data admin-owned
8. **Admin brand-asset uploads** — `origin: admin` on the shared asset model
9. **Audit event logging** — deletes/uploads/exports/shares logged from day one (viewer UI in v1.1)

*Organization seams:* MVP provisions `themes` and `asset_themes` for the exposed theme feature, plus dormant `campaigns` and `asset_campaigns`, including nullable `campaigns.theme_id`; it exposes no campaign or calendar UI. Campaign-asset and theme-asset connections require explicit admin action and are never inferred from `assets.task_id`, upload, generation, or other workflow context. The admin-only campaign calendar activates in v2; the ambassador landing page remains the task list.

### Growth Features (Post-MVP)

**v1.1 — fast follow (~4–6 weeks), the "wow" release:**

10. **AI generation suite** — prompt + source uploads + output type/settings modal, generated library, re-prompt version history, source family tree, used-credit propagation to source ambassadors
11. **Share-to-social (LinkedIn)** with caption + share events
12. **Tokenized 1:1 magic-link tasks** — SMS/email link straight into upload/capture
13. **Used-content tracking** — share events, export check-off prompts, ambassador usage notifications, and usage counters; this loop does not depend on campaigns
14. **Leaderboard** — all-time + rolling 3-month windows, visible to ambassadors and admins
15. **Stats/metrics page** + audit trail viewer

**v2 — campaign calendar:**

16. **Campaigns as first-class objects** — admin-only calendar, campaign lifecycle, optional selected theme, and explicit many-to-many asset connections; campaign reporting activates with this calendar

### Vision (Future)

17. **SSO** (stakeholder-agreed post-MVP)
18. Bulk per-recipient tokenized links, additional social channels beyond LinkedIn, advanced AI output types, further AI workflow iterations

## User Journeys

### Journey 1 — Jonas gets invited, consents, and fulfills his first task (primary happy path)

**Opening scene:** Jonas works frontline on a Stena vessel. HR invited him to the ambassador program; an email lands: *"You're invited — tap to get started."* No password to create — the link logs him in (magic-link auth). He has 90 seconds of downtime and a phone.

**Rising action:** First login shows three plain-language consent cards: *your content helps promote Stena* / *everyone in the shot said yes* / *you stay in control*. Full legal text linked beneath. He taps accept on each — his account activates, and the acceptance (user, terms version, timestamp) is stored. A week later his phone buzzes: SMS from HR — *"We need Midsummer deck photos for a recruiting campaign — can you help?"* He opens the portal, sees the task in his task list, hits upload, selects 12 photos from his camera roll in one motion — no per-file forms — and walks away while chunked upload runs in the background.

**Climax:** He marks the task done. Two weeks later a notification: *"Your photo was used in published content!"* His profile counter ticks up.

**Resolution:** Contributing costs Jonas nothing — no passwords, no forms, no wondering if it mattered. He keeps shooting.

**Reveals requirements for:** magic-link auth, invite flow, consent cards + versioned acceptance records, task list + notifications (SMS/email), camera-roll batch upload, background/chunked upload, mark-done, usage notifications, profile counters.

### Journey 2 — Jonas hits the limits: a huge video, ship Wi-Fi, and second thoughts (primary edge cases)

**Opening scene:** Jonas filmed a 4K engine-room tour — 3.2 GB. On ship Wi-Fi.

**Rising action:** Before the upload even starts, the portal validates client-side: *"Videos can be up to 2 GB / ~5 minutes — trim the clip and try again."* Clear, immediate, no wasted 40-minute upload that dies at 80%. He trims to 4 minutes and retries; the connection drops twice mid-transfer, but chunked auto-retry absorbs it silently — the upload completes without Jonas ever seeing an error. Later that month, new terms roll out (AI manipulation clause added). On next login the consent cards reappear; this time Jonas hesitates and declines.

**Climax:** No punishment, no dead end: his account goes inactive with a warm *"come back anytime."* Task sends and messages to him stop automatically. Three weeks later, after asking HR what the AI clause means, he returns — the cards are re-presented, he accepts, and he's active again. Separately, he deletes an old upload he regrets — gone immediately, logged in the audit trail.

**Resolution:** The system's edges are soft: limits explained before pain, failures invisible, decline reversible, control real.

**Reveals requirements for:** client-side size validation with per-type limits and friendly errors, chunked auto-retry resilience, terms re-accept-on-change, decline → inactive + self-service re-entry, message/task suppression for inactive accounts, delete-own-content, audit logging.

### Journey 3 — Petra's Monday: 40 new uploads, recruitment deadline, one triage session (admin happy path)

**Opening scene:** Petra (HR/marketing, small team) opens the portal Monday morning. A recruitment campaign ships Friday. The library shows *"New this week: 40."*

**Rising action:** She enters the triage queue — instant thumbnail previews from the transcoding pipeline, even for 2 GB videos. She rips through the queue: explicitly assigning the curated theme `Life on board`, starring the keepers, and skipping the rest — one motion per item, no page-hopping. Stars and dismissals are admin-only; no ambassador ever sees a rejection. Needing one more deck shot, she sends a task to three ambassadors via SMS in one send. Wednesday, Jonas's photos arrive linked to the task through `assets.task_id`, with no theme or campaign connection inferred from that context. Petra explicitly assigns `Life on board`, filters the library by starred + theme, multi-selects, and exports a zip.

**Climax:** The zip opens with human-readable filenames — `jonas-lindqvist-2026-06-24.jpg`, not `IMG_4417.MOV`. She hands it straight to the agency. Under 10 minutes from "need content" to publish-ready export.

**Resolution:** Later, the portal asks her to check off which exported items were actually published — feeding honest "used" counters and Jonas's notification. The library is her cockpit: request, triage, organize, export, confirm — one tool.

**Reveals requirements for:** triage queue, transcoding/thumbnail pipeline, admin-private starring, curated theme lifecycle and explicit assignment, filters (ambassador/type/date/theme), connected-upload theme browsing, task creation + bulk SMS/email messaging, multi-select zip export with naming convention, export check-off prompts, used-content tracking, admin brand-asset upload (same library), and no organization inferred from task context.

### Journey 4 — The departed ambassador: offboarding under GDPR (governance/operations)

**Opening scene:** An ambassador leaves Stena and asks HR to remove her content. GDPR clock: 30 days.

**Rising action:** Petra sets the account inactive — task sends and messages stop instantly. She filters the library by ambassador, reviews, and bulk-deletes. The deletion warning flags dependents: two AI-generated assets (v1.1) used her uploads as sources. She reviews the flagged items and deletes one, regenerates the other without the departed person's material.

**Climax:** Every deletion lands in the audit trail — who, what, when. That trail *is* the compliance evidence if anyone asks. A month later a different request arrives: a person with no account appears in someone else's upload and wants out. Petra searches upload descriptions and asks the uploading ambassador to identify any remaining matches, then deletes the confirmed assets and their generated children within the deadline. With the former freeform taxonomy removed, bystander findability intentionally rests on upload descriptions plus human confirmation from the uploader. Curated theme names will not contain personal data and are not a person-search surface. This is an accepted, documented consequence of the curated theme model, not a regression to solve with another freeform taxonomy.

**Resolution:** Offboarding is a calm 15-minute runbook, not a panic. Nothing lingers that shouldn't; everything that happened is provable.

**Reveals requirements for:** activate/deactivate with send-suppression, filter-by-ambassador + bulk delete, generated-children warnings on delete (family tree), audit trail as compliance record, upload-description search plus uploader confirmation, themes excluded from person search, documented manual erasure runbook, ambassador management (contact data admin-owned, last-login/activity).

### Journey 5 — Petra generates, publishes, and proves it (v1.1 value loop)

**Opening scene:** Six months in, the library is full. Marketing wants a recruiting clip for LinkedIn, there's no budget for a production shoot, and the stakeholder review — "is this program worth it?" — is Thursday.

**Rising action:** Petra opens the generation modal: a prompt (*"45-second recruiting cut — life on deck, warm tone"*), four starred source clips selected from the library, output type and settings. The first result drags in the middle; she re-prompts — each iteration lands as a new version with prior versions still revisitable. Version three is right. The generated asset sits in the library like any other (`origin: generated`), carrying its family tree: every source clip, every prompt, every version.

**Climax:** She shares it to LinkedIn with a caption straight from the portal. The share is recorded as a usage event, and "used" credit propagates to the four source clips' ambassadors — Jonas's phone buzzes: *"Your clip was used in published content!"* Thursday morning she opens the stats page in the stakeholder meeting: uploads over time, % used, top content — the receipt. These v1.1 insights and notifications work without campaign objects; campaign reporting activates later with the v2 calendar. When a question about a deleted asset comes up, she answers it on the spot from the audit-trail viewer.

**Resolution:** The library stops being an archive and becomes a production line: source content in, published content out, credit flowing back to the people who filmed it, and the program's value provable in one screen.

**Reveals requirements for:** AI generation modal (prompt + source assets + output type/settings), re-prompt version history, generated-origin assets in the shared library, source family tree, LinkedIn share with caption + share events, used-credit propagation, usage notifications, campaign-independent stats page, audit-trail viewer.

### Journey Requirements Summary

| Capability area | Revealed by | Scope |
|---|---|---|
| Auth & onboarding (magic link, invite, consent cards, versioned terms, re-accept) | J1, J2 | MVP |
| Upload pipeline (camera-roll batch, capture, size validation, chunked retry, delete-own) | J1, J2 | MVP |
| Tasks & messaging (task list, mark-done, SMS/email individual + bulk) | J1, J3 | MVP |
| Admin library (triage queue, previews/transcoding, stars, theme assignment/filtering/browsing) | J3 | MVP |
| Export & usage loop (zip + naming, export check-offs, usage notifications, counters) | J1, J3 | MVP core; check-offs/counters v1.1 |
| Ambassador management & governance (activate/deactivate, bulk delete, audit trail, erasure runbook) | J2, J4 | MVP |
| Provenance & AI family tree (source links, generated-children warnings, credit propagation) | J3, J4, J5 | v1.1 |
| AI generation, publishing & program reporting (generation modal, version history, LinkedIn share, stats page, audit viewer) | J5 | v1.1 |

No API-consumer journey: the portal is internal-facing with no external API surface in MVP or v1.1.

## Domain-Specific Requirements

### Compliance & Regulatory

- **GDPR applies in full** — the platform processes employee personal data (names, contact details, likenesses in media) with EU data subjects. All hosting, file storage, and processing must be in **EU regions**.
- **Consent must be provable, versioned, and current.** Acceptance records store user + terms version + timestamp. Changed terms trigger a re-accept flow on next login; until re-accepted, the account is inactive for sends. Consent text must explicitly cover **AI-assisted editing and AI-generated derivatives** of uploaded material (**approved by legal 2026-07-08**; see `launch-decisions.md`).
- **Third-party (bystander) consent is delegated, not verified:** the day-one blanket agreement makes the uploading ambassador responsible for ensuring everyone in the shot has agreed (Card 2). This is an accepted trade-off — no per-upload consent confirmation in MVP.
- **Erasure requests (Art. 17) served within 30 days** via documented manual runbooks: departed-ambassador offboarding (deactivate → filter → bulk delete → handle generated children) and bystander erasure (search → delete → respond). The audit trail is the compliance evidence.
- **Marketing publication rights:** consent explicitly grants use for internal *and external* marketing (social media included), so content leaving the portal (zip export, LinkedIn share) is covered by the same acceptance record.
- **Data retention:** content and records live indefinitely by default — the user base is small, and ambassadors/admins can delete on demand; deletion-on-request runbooks cover GDPR obligations. Exception: **audit log events older than 6 months may be automatically deleted**. Terms-acceptance records are consent evidence, not audit log events — they are retained for as long as the related account/content exists.

### Technical Constraints

- **Data residency:** EU-region hosting for app, database, file storage, and any processing (transcoding, later AI). Provider selection must respect this — including the v1.1 AI provider.
- **Audit trail from day one:** deletions, uploads, exports, shares, and used-confirmations logged immutably (viewer UI may lag to v1.1, but events must not). Events auto-expire after 6 months per the retention policy.
- **No soft delete:** deletes are permanent by design; the audit trail — not a recycle bin — provides accountability. Delete flows must warn about generated children before executing.
- **Access control:** two roles only (ambassador, admin). Ambassadors see only their own uploads and positive signals; triage signals (stars, dismissals) are admin-only. Admin workspace is shared/team-wide.
- **Authentication floor:** magic-link email login, short-lived single-use tokens; no passwords stored. Session length/renewal policy deferred to architecture. Bulk send-outs link to login, not tokenized deep-links (MVP).
- **Media handling:** originals preserved untouched; renditions generated per upload; per-type size caps enforced client-side before transfer starts.

### Integration Requirements

- **SMS provider** (Twilio or 46elks — Swedish provider, good domestic rates): must support provider-side spending caps. App must surface a friendly "budget reached" error when the cap is hit.
- **Email delivery** for magic links, invitations, task notifications, and messaging.
- **v1.1:** AI generation provider (EU processing or acceptable transfer mechanism — selection deferred to v1.1 planning) and LinkedIn share API.
- **No SSO, no HR-system integration in MVP** — ambassador contact data is entered and maintained manually by admins (documented admin duty).

### Risk Mitigations

| Risk | Mitigation | Owner |
|---|---|---|
| Stale/unprovable consent | Versioned terms + acceptance records + re-accept-on-change | Product (built-in) |
| Departed employee's content lingers | Offboarding runbook + filter-by-ambassador bulk delete + audit trail | HR (manual, documented) |
| Bystander in content objects | Erasure runbook, 30-day response | HR (manual, documented) |
| AI misrepresents a real colleague (v1.1) | Human admin review before any use — no automated gate | Admin (accepted risk) |
| Runaway SMS/AI spend | Provider-side caps + graceful in-app budget errors | Stakeholder sets amounts |
| Irreversible bulk deletion mistakes | Audit trail (no undo by design); delete warnings list affected generated children | Product (built-in) |
| Outdated ambassador contact data | Admin-owned contact records; keeping them current is an admin duty | HR |

## Web Application Specific Requirements

### Project-Type Overview

Responsive web application, mobile-first for ambassadors and desktop-first for admins — one app, two optimized experiences. No native app: the camera integration ambassadors need (capture + camera-roll access) is achievable through standard web capabilities (`<input capture>`, file pickers). Internal-facing; not indexed, not public.

### Technical Architecture Considerations

- **SPA-style app** (or SPA-per-area) — the admin library/triage experience demands instant, no-reload interactions (previews, keystroke theme assignment, multi-select), and the ambassador flow needs an app-like feel on mobile. Framework choice deferred to architecture.
- **Uploads are the make-or-break subsystem:** chunked, resumable-under-the-hood, background-tolerant uploads (Uppy/tus/S3-multipart style) with client-side validation before transfer starts. Everything else is standard CRUD.
- **Transcoding pipeline runs async server-side:** upload completes fast; previews/thumbnails appear when ready. The UI must handle the "processing" state gracefully.
- **Magic-link auth shapes routing:** every entry point (invite, task notification, plain login) resolves through one link-consumption flow; sessions must be long-lived enough that ambassadors aren't re-authenticating every visit (policy set during architecture).
- **No offline mode:** connectivity-resilience is handled at the upload layer (auto-retry), not with an offline-first architecture — deliberate simplicity for MVP.

### Browser & Device Matrix

- **Mobile (primary for ambassadors):** iOS Safari and Android Chrome, current and previous major version. Camera capture and multi-select from camera roll must work on both.
- **Desktop (primary for admins):** Chrome, Edge, Firefox, Safari — current evergreen versions.
- **No legacy support:** no IE, no outdated enterprise browser accommodation (internal tool, small known user base — devices can be verified against the actual ambassador group).

### Responsive Design

- **Ambassador surface:** designed phone-first (the 90-second moment); tablet/desktop functional but not optimized.
- **Admin surface:** designed desktop-first (triage is a keyboard-and-big-screen workflow); must remain usable on tablet/phone for on-the-go checks, but bulk operations may be desktop-only.
- Touch targets, one-handed reachability, and thumb-driven flows govern the ambassador UI.

### Performance Targets

- Ambassador task-link → interactive upload screen: **< 3 s on 4G**.
- Library/triage previews: thumbnails render **instantly** (pre-generated renditions, lazy loading); video preview playback starts **< 2 s**.
- Upload start is immediate after selection — validation client-side, no pre-upload round-trips.
- These targets serve the two headline metrics: < 2 min task-to-upload, < 10 min request-to-export.

### SEO Strategy

Not applicable — internal tool. Explicitly: `noindex`, no public pages beyond the login/magic-link entry, no social preview metadata needed.

### Accessibility Level

- **Baseline: WCAG 2.1 AA intent** — semantic HTML, keyboard operability (triage queue keystrokes double as an accessibility feature), sufficient contrast, focus states, alt/labels on controls.
- No formal certification/audit requirement (internal tool, no procurement mandate) — treated as engineering discipline, not a compliance gate. *Confirmed 2026-07-08: Stena mandates no formal accessibility level for internal tools; AA-as-discipline accepted (see `launch-decisions.md`).*

### Implementation Considerations

- Media-heavy UI: lazy loading, virtualized lists for the library as it grows, renditions-not-originals everywhere except export.
- Web capture quirks (iOS Safari file input behavior, HEIC/HEVC formats from iPhones) must be handled in the upload pipeline — HEIC conversion happens in the transcoding step, originals kept as-is.
- Email/SMS deliverability is a launch-critical dependency (magic links are the *only* way in) — link expiry UX needs a friendly "request a new link" path.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP — the MVP must fully solve the core operational problem (scattered, unprovable, unusable employee content) end-to-end, not demo a concept. The complete loop — request → upload → triage → organize → export — ships working and reliable, while everything that *exploits* a filled library (AI, sharing, leaderboards, stats) waits for v1.1. Sequencing rationale: AI generation needs source content and a leaderboard needs history; launching them into an empty library would waste both launch moments.

**Validation logic:** the MVP validates the riskiest assumption — *will ambassadors actually contribute?* — with the smallest build. If activation (≥70%) or task fulfillment (≥50%) fails, v1.1 investment is reconsidered before it's spent.

**Resource Requirements:** small development team (1–3 developers), MVP in a small number of weeks, v1.1 as a ~4–6 week fast follow. External dependencies: legal review of consent text (before launch), SMS provider account with spending cap, EU-region hosting. *Assumption to confirm — team size and timeline were not stakeholder-agreed.*

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:** Journey 1 (invite → consent → task → upload), Journey 2 (limits, retries, decline/re-entry, delete-own), Journey 3 (triage → theme assignment/star → export; check-off prompts deferred), Journey 4 (offboarding/erasure — manual runbook over MVP features).

**Must-Have Capabilities:** the nine MVP items in *Product Scope → MVP* (items 1–9).

**Deliberately manual or dormant in MVP:** offboarding/erasure uses a runbook; campaign schema exists without campaign/calendar UI until v2; usage confirmation remains informal until v1.1 check-offs; audit events are logged while the viewer UI waits for v1.1. Campaign and theme connections are never inferred from tasks, uploads, generation, or other workflow context.

### Post-MVP Features

**Phase 2 (v1.1, ~4–6 weeks post-MVP):** items 10–15 in *Product Scope → Growth Features*. Theme: exploit the filled library through AI generation, sharing, usage tracking, engagement, and program insights; the usage loop remains independent of campaigns.

**Phase 3 (v2):** item 16 in *Product Scope → Growth Features*. The admin-only campaign calendar activates over the dormant MVP schema, including campaign reporting and explicit asset connections.

**Phase 4 (Expansion):** items 17–18 in *Product Scope → Vision*.

### Risk Mitigation Strategy

**Technical Risks:** The two hard subsystems are the upload pipeline (chunked/retry on hostile connectivity) and transcoding (formats incl. HEIC/HEVC, async states). Mitigation: build both on proven components (Uppy/tus/S3-multipart; established transcoding services), and build them *first* — they sit under every journey. AI integration risk is pushed entirely out of MVP.

**Market/Adoption Risks:** The product fails if ambassadors don't contribute, not if a feature is missing. Mitigation: every friction-reducer is MVP-mandatory (magic links, camera-roll batch, no forms); activation and fulfillment metrics are watched from week one; the task/request loop gives admins an active lever to *drive* contribution rather than wait for it.

**Resource Risks:** If capacity shrinks, the cut order is: (1) defer SMS to email-only messaging, (2) defer the triage queue (filters still work), (3) defer brand-asset uploads. The upload pipeline, consent mechanics, library, and export are never cut — without them there is no product. v1.1 is genuinely optional-until-validated: MVP delivers standalone value.

## Functional Requirements

### Authentication & Access (MVP)

- FR1: Users (ambassadors and admins) can log in via a short-lived, single-use magic link sent to their email; no passwords exist in the system
- FR2: Ambassadors can activate their account through an invitation email that doubles as their first login
- FR3: Users can request a fresh login link when a link has expired or been used
- FR4: The system suppresses all task and message sends to inactive accounts

### Consent & Terms (MVP)

- FR5: Ambassadors are presented with plain-language consent cards (with full legal text accessible) on first login and must accept all terms before their account activates
- FR6: The system stores an acceptance record (user, terms version, timestamp) for every acceptance
- FR7: Ambassadors can decline terms, which sets their account inactive without deleting anything; they can return and accept later without admin intervention
- FR8: The system maintains versioned terms; when terms change, users must re-accept on next login before continuing

### Content Contribution (MVP)

- FR9: Ambassadors can batch-upload photos/videos (two or more in one action) from their device (camera roll or file picker) without per-file forms; no fixed batch limit — bounded only by per-file size caps
- FR10: Ambassadors can capture a photo or video directly with the device camera and upload it in the same flow
- FR11: The system validates file type and size limits (per-type caps) before an upload begins and explains any rejection by stating the specific limit and remedy (e.g., "Videos can be up to 2 GB / ~5 min — trim the clip and try again")
- FR12: Uploads automatically recover from connection interruptions without user intervention or visible failure
- FR13: Ambassadors can add descriptions to their uploads
- FR14: Ambassadors can view their own uploads and delete any of them at any time
- FR15: Uploads made in the context of a task are automatically linked to that task. This linkage never creates, infers, or propagates a theme or campaign connection for the asset.

### Content Requests & Messaging (MVP)

- FR16: Admins can create a content request task addressed to one or more ambassadors
- FR17: Ambassadors can view their open and completed tasks in an in-app task list
- FR18: Either the ambassador or an admin can mark a task as done
- FR19: The system notifies ambassadors of new tasks via email, SMS, or both — the admin chooses the channel(s) per send
- FR20: Admins can send free-form messages via email and SMS to a single ambassador or to all active ambassadors

### Content Library & Organization (MVP)

- FR21: Admins can browse all assets in one shared library regardless of origin (ambassador upload or admin brand asset)
- FR22: The system auto-derives each asset's content-type category from the file itself; no manual categorization
- FR23: The system generates web-friendly preview renditions and thumbnails for every asset, preserving originals untouched, and shows a processing state until ready
- FR24: Admins can filter the library by ambassador, content type, upload date, and theme; search upload descriptions; and open a theme to browse all connected uploads. Theme names are curated organization labels and are not a person-search surface.
- FR25: Admins can review new arrivals in a "new this week" triage queue with previews and single-action theme assignment and starring per item. The theme assignment control uses the curated active-theme list and, for authorized admins, offers inline theme creation without leaving triage.
- FR26: Admins can star/unstar assets as a quality signal; stars are shared across all admins and never visible to ambassadors
- FR27: Admins can create, view, update, archive, restore, and—when unconnected—hard-delete curated themes; assign or remove themes on individual assets and multi-select batches; and open any theme to browse its connected uploads. Assets and themes have a many-to-many relationship. A theme may be hard-deleted only when it has zero connected assets. A connected theme must be archived instead: archiving preserves all existing connections, blocks new assignments until the theme is restored, removes it from the assignment picker, and keeps it filterable and viewable with its connected uploads. Theme connections are created only by explicit admin actions and are never inferred from upload or task context.
- FR28: Admins can upload brand assets into the same library, marked as admin-origin
- FR29: Admins can delete any asset, including multi-select bulk deletion; deletes are permanent

### Export (MVP)

- FR30: Admins can multi-select assets and export them as a zip with human-readable filenames (`{ambassador-name}-{upload-date}-{nn}`, where the sequence suffix disambiguates multiple files from the same ambassador and date)

### Ambassador Management (MVP)

- FR31: Admins can invite ambassadors by email, and can activate, deactivate, or delete ambassador accounts
- FR32: Admins can view and maintain each ambassador's contact details (email, mobile) and see last-login/activity
- FR33: Admins can filter the library by a specific ambassador and bulk-delete their content (offboarding support)

### Audit & Governance (MVP)

- FR34: The system logs audit events — uploads, deletions, exports, shares, used-confirmations — with actor and timestamp, from day one
- FR35: The system automatically deletes audit events older than 6 months; terms-acceptance records are exempt and retained
- FR36: The system surfaces a clear "budget reached" message naming the blocked action — never a raw provider error — when a provider spending cap (SMS, later AI) blocks an action

### AI Content Generation (v1.1)

- FR37: Admins can generate new content by providing a prompt, selecting source assets, and choosing output type and settings
- FR38: Generated assets appear in the library as generated-origin, with theme assignment, theme filtering and browsing, starring, and export working as for any asset. Theme connections require an explicit admin action and are never inferred from generation sources or other workflow context.
- FR39: Admins can iteratively re-prompt a generated asset; each iteration creates a new version with prior versions revisitable
- FR40: The system records each generated asset's source assets (family tree); deleting a source warns about affected generated children
- FR41: When a generated asset is used, "used" credit propagates to the source uploads' ambassadors

### Social Sharing & Usage Tracking (v1.1)

- FR42: Admins can share an asset to LinkedIn with a caption directly from the portal; shares are recorded as usage events
- FR43: The system prompts admins after zip exports to confirm which exported items were published (per-item check-off)
- FR44: Ambassadors are notified when their content is used in published material, and their profile shows a usage counter

### Campaign Calendar (v2)

- FR45 (v2): Admins can create, view, update, archive/restore, and delete time-boxed campaigns in an admin-only calendar. A campaign has a name, a description, start and end dates, and at most one selected theme; it can be created before a theme is chosen. Campaigns and assets have a many-to-many relationship. Asset connections are created only by explicit admin actions and are never inferred or propagated from task linkage or other workflow context. MVP provisions campaign and campaign-asset data foundations without campaign or calendar UI; the ambassador landing page remains the task list.

### Engagement & Program Insights (v1.1; campaign reporting v2)

- FR46: Admins can send task links that open directly into the upload/capture flow via tokenized 1:1 magic links
- FR47: All users can view a top-5 ambassador leaderboard with all-time and rolling 3-month windows, ranked by uploads and used uploads
- FR48: Admins can view a stats page showing uploads over time, percentage used, and top content, and can browse the audit trail in a viewer UI. Campaign reporting activates with the v2 campaign calendar.

## Non-Functional Requirements

### Performance

- NFR1: Task link → interactive upload screen in **< 3 s on a 4G mobile connection**; the full task-to-upload journey completes in < 2 min
- NFR2: Library and triage thumbnails render in **< 200 ms** of entering the viewport; video previews start playback in **< 2 s**
- NFR3: Preview renditions and thumbnails are available within **5 minutes of upload completion for a max-size (2 GB) video**, sooner for smaller files; the UI shows a processing state, never a broken preview
- NFR4: Upload of a max-size file (2 GB video) succeeds on an unstable connection, with progress visible throughout and automatic recovery from interruptions without user action
- NFR5: Library interactions (filter, search, theme assignment, star) respond in **< 500 ms** at expected library sizes (thousands of assets over years)

### Security & Privacy

- NFR6: All data encrypted in transit (TLS) and at rest, including original media files
- NFR7: Magic-link tokens are single-use and short-lived (exact expiry set during architecture); consumed or expired links cannot authenticate; no credentials stored anywhere
- NFR8: Role separation enforced server-side: ambassadors can only access their own uploads and profile; admin capabilities (library, triage signals, management, messaging) are inaccessible to ambassador sessions
- NFR9: All personal data (contact details, media, acceptance records, audit events) is stored and processed exclusively in **EU regions**, including third-party processors (transcoding, SMS, later AI)
- NFR10: Terms-acceptance records are append-only and tamper-evident — any modification is detectable (mechanism selected during architecture) — and retained as long as the related account/content exists; audit events are immutable during their 6-month lifetime
- NFR11: Erasure operations (offboarding runbook) achieve complete removal — originals, renditions, and derived data — supporting the 30-day GDPR response window

### Reliability & Data Integrity

- NFR12: Original files are preserved bit-exact as uploaded; transcoding never modifies or replaces originals
- NFR13: No partial uploads enter the library — an upload either completes and appears, or fails cleanly and invisibly to admins
- NFR14: Magic-link and notification email/SMS delivery is launch-critical: delivery failures are logged and surfaced to admins (a message that silently never arrives = an ambassador who can never log in)
- NFR15: Availability matches internal-tool expectations — business-hours reliability; brief maintenance windows acceptable; no formal HA/uptime SLA required
- NFR16: Data loss tolerance for originals and acceptance records: **RPO ≤ 24 hours, RTO ≤ 1 business day** — backups with tested restore required (targets adjustable during architecture)

### Storage & Capacity

- NFR17: Storage must handle indefinite retention of original-format media (estimate: 20 ambassadors × regular video uploads = hundreds of GB → low TB over the first years) without architectural change; storage cost is surfaced as a running-cost line for stakeholder sign-off

### Accessibility

- NFR18: WCAG 2.1 AA intent as engineering discipline: semantic HTML, full keyboard operability, sufficient contrast, visible focus states, labeled controls; no formal audit/certification gate

### Integration Quality

- NFR19: SMS and email providers must support provider-side spending caps; when a cap blocks an action, the user sees a clear "budget reached" message, never a raw provider error
- NFR20: Provider outages degrade gracefully: an SMS-provider failure must not block email notification paths or any in-app functionality

## References

Two operational artifacts are maintained as standalone, versioned documents alongside this PRD:

- **Consent cards** (`_bmad-output/planning-artifacts/consent-cards.md`, v1.0.0) — the three-card plain-language consent text and acceptance-record mechanics; explicitly covers AI-assisted editing and AI-generated derivatives. **Approved by legal 2026-07-08; production text is Swedish** (English retained as approved reference).
- **Offboarding & erasure runbook** (`_bmad-output/planning-artifacts/offboarding-erasure-runbook.md`, v1.0.0) — the HR process for departed-ambassador offboarding and bystander erasure requests. **Adopted by HR 2026-07-08** (owner: HR Manager).
- **Launch decisions** (`_bmad-output/planning-artifacts/launch-decisions.md`, v1.0.0) — authoritative record of all resolved non-code launch gates (legal, US-processors, typeface = Inter, SMS cap = 200 SEK/mo, colours, **Swedish UI language**, accessibility).

Both originate from the brainstorming session (`_bmad-output/brainstorming/brainstorming-session-2026-07-02-2012.md`); the standalone documents above are now the source of truth and are versioned independently — a consent-text change is a new terms version and triggers the re-accept flow (FR8).
