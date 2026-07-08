---
artifact: consent-cards
version: 1.0.0
status: approved — legal review complete (2026-07-08); UI language = Swedish
owner: 'HR (content); Legal (approved)'
extractedFrom: '_bmad-output/brainstorming/brainstorming-session-2026-07-02-2012.md'
relatedPrd: '_bmad-output/planning-artifacts/prd.md'
relatedDecisions: '_bmad-output/planning-artifacts/launch-decisions.md'
lastUpdated: '2026-07-08'
---

# Stena Content Portal — Consent Cards

The three plain-language consent cards presented to every ambassador on first login (and re-presented whenever the terms version changes). Full legal text is linked beneath each card in the product. Accepting all three cards activates the account (PRD FR5); declining sets the account inactive without deleting anything, and the ambassador can return and accept later (FR7).

**This document is the source of truth for the consent text.** Any change to card wording or the underlying legal text is a new terms version and triggers the re-accept flow on next login (FR8).

**Language:** all user-facing copy is **Swedish** (launch decision 2026-07-08). The Swedish cards below are the production text rendered verbatim by the ConsentCardStack (Story 3.2). The English text is retained as the legally-approved reference — the Swedish conveys the same approved meaning; legal to confirm the Swedish wording before launch (content unchanged, language surface only).

## Production text (Swedish — rendered in the UI)

### Kort 1 — "Ditt innehåll hjälper till att marknadsföra Stena"

Genom att ladda upp ger du Stena tillåtelse att använda, redigera, bearbeta och publicera ditt innehåll för marknadsföring och employer branding — både internt och externt (t.ex. sociala medier). Detta inkluderar AI-assisterad redigering och AI-genererat innehåll som skapas utifrån dina uppladdningar.

### Kort 2 — "Alla i bilden har sagt ja"

Ladda bara upp foton, videor eller ljud där varje synlig eller identifierbar person har gått med på att medverka och på att Stena använder materialet. Om någon inte har gett sitt samtycke — ladda inte upp det.

### Kort 3 — "Du har kontrollen"

Du kan radera dina egna uppladdningar när som helst. Om du lämnar ambassadörsprogrammet eller företaget, kontakta HR så tar de bort ditt innehåll på begäran. Att tacka nej till dessa villkor innebär bara att ditt konto förblir inaktivt — du kan komma tillbaka och acceptera senare.

## Approved reference text (English — legal reference, not shown in UI)

### Card 1 — "Your content helps promote Stena"

By uploading, you give Stena permission to use, edit, adapt, and publish your content for marketing and employer branding — internally and externally (e.g., social media). This includes AI-assisted editing and AI-generated content created from your uploads.

### Card 2 — "Everyone in the shot said yes"

Only upload photos, videos, or audio where every visible or identifiable person has agreed to appear and to Stena using the material. If someone hasn't agreed — don't upload it.

### Card 3 — "You stay in control"

You can delete your own uploads at any time. If you leave the ambassador program or the company, contact HR and they will remove your content on request. Declining these terms just means your account stays inactive — you can return and accept later.

## Acceptance mechanics

- Each acceptance is stored as a record: **user + terms version + timestamp** (FR6). Records are append-only and tamper-evident (NFR10) and retained for as long as the related account/content exists — they are consent evidence, not audit-log events, and are exempt from the 6-month audit-log expiry (FR35).
- Terms changes increment the version in this document's frontmatter and trigger re-accept on next login; until re-accepted, the account is inactive for task and message sends (FR4, FR8).
- Card 2 implements the delegated third-party (bystander) consent model: the uploading ambassador is responsible for everyone in the shot — an accepted trade-off documented in the PRD (no per-upload consent confirmation in MVP).

## Review checklist (external legal — completed 2026-07-08)

- [x] AI-assisted editing and AI-generated derivatives adequately covered (Card 1)
- [x] Internal **and external** marketing publication rights (social media included) adequately covered (Card 1)
- [x] Delegated bystander consent defensible under GDPR (Card 2)
- [x] Erasure and withdrawal language consistent with Art. 17 obligations (Card 3)
- [x] Full legal text drafted and linked from each card
- [ ] Confirm Swedish plain-language wording matches the approved English meaning (pre-launch, content-neutral)
