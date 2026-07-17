# Epic 3 Context: Ambassador Onboarding & Consent

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Turn an invited ambassador into an active contributor through understandable, versioned consent while preserving evidence that every acceptance was current and provable. The flow must make declining reversible and respectful, and must prevent ambassadors with missing or outdated consent from using protected product capabilities.

## Stories

- Story 3.1: Versioned terms & tamper-evident acceptance store
- Story 3.2: First-login consent card flow
- Story 3.3: Decline → pause → self-service return
- Story 3.4: Re-accept on terms change

## Requirements & Constraints

- First-login ambassadors must acknowledge all three plain-language consent cards before activation. Each completed acceptance records the user identity snapshot, terms version, and timestamp; 100% of acceptances must remain traceable to the accepted version.
- The approved Swedish card text is the production source of truth and must be rendered verbatim; each card's full legal text remains accessible from the flow. Any card wording or underlying legal-text change creates a new terms version and requires ambassadors to re-accept before continuing.
- Declining does not delete the account, content, or evidence. It moves the ambassador into a paused state, suppresses task and message sends, and allows self-service return and later acceptance without admin intervention.
- Ambassadors whose accepted version is stale must be blocked from protected actions until they accept the current version. Declining changed terms uses the same paused state as first-login decline. Admin sessions are outside the ambassador consent gate.
- Acceptance evidence is append-only, tamper-evident, retained independently of the six-month audit-event lifecycle, and retained while the related account or content exists. It must not be cascaded away with an account row.
- Acceptance records and their backups must remain in EU regions. Recovery targets are RPO ≤ 24 hours and RTO ≤ 1 business day.
- User-facing copy is Swedish. The experience must meet WCAG 2.1 AA intent through semantic structure, keyboard operability, labeled controls, sufficient contrast, and visible focus.

## Technical Decisions

- Store terms in a versioned `terms_versions` model. New versions are published through the consent data-access layer by the publishing script and emit the closed-registry `terms.version_created` audit event.
- Keep `acceptance_records` in its own indefinite-retention lifecycle. Enforce INSERT-only behavior with grants and a trigger; provide no update/delete path, `updated_at`, or foreign key to profiles or auth users. Store denormalized identity snapshots.
- Each acceptance includes `hmac` and `prev_hmac` values in a chained record sequence. The `ACCEPTANCE_HMAC_KEY` lives only in application and worker environments. A scheduled `verify-acceptance-chain` job reports integrity failures through the runtime-neutral logging seam.
- Encrypt personal identity snapshots with a per-user key held in `consent_pii_keys`. GDPR erasure deletes that key and appends a signed tombstone so erased PII is unreadable while chain integrity and pseudonymous evidence remain.
- Use the account states `invited`, `active`, `inactive_declined`, `inactive_withdrawn`, and `deactivated`; deletion is row removal, not an account state. Accepting all current terms activates the profile and sets `first_accepted_at` when applicable.
- The server-only data-access layer is the authoritative consent boundary. `requireUser()` performs network-validated user, account-state, and current-terms checks on every protected ambassador request. `requireUserPreConsent()` is restricted to consent and own-state operations; `requireAdmin()` does not apply the consent-version gate.
- A stale-consent check returns the standard `CONSENT_REQUIRED` 409 error with a relative, allow-listed `next` destination. Global client handling redirects to the consent route, while server-rendered requests redirect from the guard. Successful re-acceptance resumes the original destination.
- Consent acceptance and decline are server-acknowledged, never optimistic. Emit `consent.accepted` or `consent.declined` inside the relevant mutation transaction.

## UX & Interaction Patterns

- Use a focus-trapped, one-card-at-a-time `ConsentCardStack`: progress dots, beige card, icon, heading, plain-language body, and a full-legal-text link that opens a sheet rather than a new tab. Each agreement control has a touch target of at least 44 px, and assistive technology announces card position.
- Keep Decline as a quiet secondary action on the final card. The resulting pause screen must state plainly that the account is paused, nothing was deleted, and the ambassador can return at any time; avoid guilt, finality, or legalistic error language.
- Re-acceptance uses the same card stack with a terms-changed banner and the changed card highlighted. Consent screens must accurately reflect server state while activation or pausing is being confirmed.
- Follow the mobile ambassador layout: single column, 16 px margins, bottom-anchored primary action, minimum 16 px input text, Inter self-hosted, sentence case, and Fleet Deck semantic colors.

## Cross-Story Dependencies

- The first-login, decline/return, and re-accept flows depend on the versioned terms store, pre-consent authorization context, acceptance-chain writer, and consent audit events established by Story 3.1.
- Epic 2 supplies invitation, magic-link confirmation, profile state, session revocation, and post-confirm routing. Epic 5 must enforce inactive-account suppression in its task and message dispatch path. Epic 7 invokes the consent PII crypto-shred and signed-tombstone seam during offboarding erasure.
