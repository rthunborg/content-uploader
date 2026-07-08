---
artifact: offboarding-erasure-runbook
version: 1.0.0
status: adopted — formally adopted by HR (2026-07-08)
owner: HR Manager (by title)
extractedFrom: '_bmad-output/brainstorming/brainstorming-session-2026-07-02-2012.md'
relatedPrd: '_bmad-output/planning-artifacts/prd.md'
relatedDecisions: '_bmad-output/planning-artifacts/launch-decisions.md'
lastUpdated: '2026-07-08'
---

# Stena Content Portal — Offboarding & Erasure Runbook

The documented HR process for (a) removing a departed ambassador's content and (b) serving erasure requests from people without accounts who appear in uploaded content. GDPR Art. 17 requests must be served within **30 days**. The portal's audit trail is the compliance evidence for every step — deletes are permanent by design (no recycle bin), so follow the review steps before deleting.

## Process A — Departed ambassador

1. **Deactivate the account** — admin sets the account to inactive; task and message sends stop immediately (PRD FR4, FR31).
2. **Locate the content** — filter the library by the ambassador (FR33), review the results.
3. **Bulk delete** — the deletion warning lists any generated assets that used these uploads as sources (FR40). Note the flagged items before confirming.
4. **Handle generated children** — for each flagged generated asset: delete it, or regenerate it without the departed person's material.
5. **Externally published content** — only on explicit request: remove from social channels manually (outside the portal).
6. **Evidence** — all deletions land in the audit trail (who, what, when) (FR34); no further documentation needed.

Expected effort: ~15 minutes for a typical ambassador.

## Process B — Bystander (non-account person) erasure request

1. **Identify affected uploads** — search descriptions and tags (FR24); ask the uploading ambassador(s) if needed.
2. **Delete matches and their generated children** — same warning flow as Process A steps 3–4.
3. **Respond to the requester** — within the 30-day GDPR deadline, confirming what was removed.

## Notes

- **Retention context:** content lives indefinitely by default; these processes are the deletion-on-request mechanism that covers GDPR obligations (PRD *Domain-Specific Requirements → Data retention*).
- **Contact data:** the departed ambassador's account record (contact details, acceptance records) is deleted with the account per HR's normal employee-data practice; acceptance records are retained as long as related content exists.
- **Adoption:** formally adopted by HR on 2026-07-08; owner is the **HR Manager** (by title). Review it whenever delete/warning flows change in the product.
