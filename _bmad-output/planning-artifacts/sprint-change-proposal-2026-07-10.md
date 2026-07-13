---
project_name: stena-content-portal
date: 2026-07-10
status: approved
mode: incremental
change_scope: moderate
approved_at: 2026-07-10
approved_by: Rasmus
---

# Sprint Change Proposal — Themes and Campaign Seams

## 1. Issue Summary

The MVP currently models manual organization as freeform tags presented as folders and treats campaigns as naming-convention tags until v1.1. The stakeholder direction replaces that taxonomy with two explicit axes:

- **Themes** are the only manual grouping axis exposed in MVP. They are curated, admin-managed, archivable, and connected to assets many-to-many.
- **Campaigns** are dormant v2 seams in MVP. They are time-boxed, calendar-driven, archivable, have a description and an optional selected theme, and connect to assets many-to-many. MVP provisions the tables and join table but no campaign/calendar UI.

Every asset-theme and asset-campaign connection is created only by an explicit admin action. Upload, `assets.task_id`, and other workflow context never infer or propagate either connection. The ambassador landing page remains the task list; the campaign calendar is admin-only in v2.

Evidence is the stakeholder change directive received on 2026-07-10. No implementation story has started; all stories remain in backlog and the repository contains no application code, so no rollback is required.

## 2. Impact Analysis

### Epic Impact

Affected existing epics are **1, 5, 6, 7, 8, and 9**. A new **Epic 10: Campaign Calendar (v2)** is proposed.

- **Epic 1 — Platform Foundation & Passwordless Access:** stays affected. Story 1.2 owns the MVP data foundation and must provision `themes`, `asset_themes`, `campaigns`, and `asset_campaigns`, including nullable `campaigns.theme_id`.
- **Epic 4 — Contribution: Upload & Media Processing:** no change. Upload/media behavior and requirements are unchanged.
- **Epic 5 — Content Requests & Messaging:** replaces Epic 4 in the impact list. FR15 and Story 5.4 must state that `assets.task_id` linkage never writes or propagates theme/campaign connections.
- **Epic 6 — Admin Library, Triage & Curation:** remains affected. Filter/search, theme management, triage assignment, generated/admin asset behavior, and the assignment control change from the freeform TagPicker to a curated ThemePicker.
- **Epic 7 — Export, Deletion & Governance:** added. UX-DR13/Story 7.1 changes the SelectionBar verb from “Tag” to “Theme”; UX-DR27/Story 7.3 changes the bystander-erasure search procedure.
- **Epic 8 — AI Generation & Provenance:** remains affected. Generated assets inherit theme capability terminology, not tags.
- **Epic 9 — Sharing, Usage Tracking & Program Insights:** remains affected. Campaign UI/reporting leaves v1.1, campaign-specific usage copy becomes generic, and campaign scope moves to v2.
- **Epic 10 — Campaign Calendar (v2), new:** admin-only campaign CRUD, archival, calendar views, optional single selected theme, and explicit asset connections.

No existing epic becomes invalid. Epic order through MVP remains unchanged. Campaign UI work is deferred from v1.1 to v2; only its schema seams move into Epic 1's MVP foundation.

### Story Impact

- Story 1.2: provision the four taxonomy-axis tables, constraints, indexes, and dormant campaign seam.
- Story 5.4: prohibit transitive assignment from `task_id`.
- Stories 6.2, 6.3, 6.5, and 6.6: theme filter/browse, theme lifecycle, ThemePicker, triage assignment, and brand-asset parity.
- Stories 7.1 and 7.3: SelectionBar wording and bystander-erasure discovery procedure.
- Story 8.1: generated assets use themes.
- Epic 9 stories: remove campaign calendar/reporting from v1.1 and use generic published-content context.
- New Epic 10 stories: campaign calendar and lifecycle in v2.

### Artifact Conflicts

The following active artifacts require synchronized edits:

- PRD
- Epics and stories
- Architecture
- UX design specification
- Sprint status
- Project context
- Offboarding and erasure runbook
- Test design artifacts
- README

The existing implementation-readiness report becomes a historical snapshot and should be regenerated after the source artifacts are updated. Historical brainstorming and validation reports are not implementation sources of truth.

### Technical Impact

- Replace `tags` / `asset_tags` with `themes` / `asset_themes`.
- Add dormant MVP tables `campaigns` / `asset_campaigns`.
- Define `campaigns.theme_id` as a nullable, single-value FK to `themes.id`.
- Do not place `campaign_id` on tasks or usage/event rows for this model.
- Theme and campaign asset connections are explicit insert/delete operations only; no upload-time, task-time, generated-content, or transitive assignment.
- Theme archive preserves existing connections, blocks new assignments, removes the theme from the assignment picker, and keeps it available in filters, browse views, and connected-upload views.
- Theme hard delete is guarded: allowed only when zero assets are connected; otherwise the operation must fail with a remedy directing the admin to archive it.
- Replace description-plus-tag search with description search plus explicit theme filtering/browsing. Theme names are curated organization labels, not a person-search field.

## 3. Recommended Approach

Use **Direct Adjustment** within the current plan.

- **Effort:** Medium; approximately 2–4 additional developer days for archival lifecycle, dormant campaign schema, guarded deletion, and tests compared with the former tag implementation.
- **Risk:** Low, because implementation has not begun and the affected contracts are still planning artifacts.
- **Timeline impact:** Small MVP increase; no v1.1 implementation increase because campaign UI moves to v2.
- **Rollback:** Not viable or necessary; there is no completed implementation to revert.
- **MVP review:** No reduction or fundamental redefinition is needed. Themes replace the old grouping feature, and campaigns remain schema-only.

## 4. Detailed Change Proposals

### PRD — FR15

**OLD**

> FR15: Uploads made in the context of a task are automatically linked to that task.

**NEW**

> FR15: Uploads made in the context of a task are automatically linked to that task through `assets.task_id`. This linkage never creates, infers, or propagates an asset-theme or asset-campaign connection.

**Rationale:** Task provenance remains intact without becoming an implicit grouping mechanism. Epic ownership is Epic 5, per the FR coverage map.

### PRD — FR24

**OLD**

> FR24: Admins can filter the library by ambassador, content type, upload date, and tag/folder, and search by description and tags.

**NEW**

> FR24: Admins can filter the library by ambassador, content type, upload date, and theme; search upload descriptions; and open a theme to browse all connected uploads. Theme names are curated organization labels and are not a person-search surface.

**Rationale:** Theme filtering and connected-upload browsing replace the former taxonomy. Freeform person-oriented search is intentionally limited to upload descriptions.

### PRD — FR25

**OLD**

> FR25: Admins can review new arrivals in a “new this week” triage queue with previews and single-action tagging/starring per item.

**NEW**

> FR25: Admins can review new arrivals in a “new this week” triage queue with previews and single-action theme assignment and starring per item. The theme assignment control uses the curated active-theme list and, for authorized admins, offers inline theme creation without leaving triage.

**Rationale:** Triage momentum is preserved while assignments remain curated and permissioned.

### PRD — FR27

**OLD**

> FR27: Admins can create tags and assign/remove them on assets, including multi-select bulk tagging; tags are browsable as folders.

**NEW**

> FR27: Admins can create, view, update, archive, restore, and—when unconnected—hard-delete curated themes; assign or remove themes on individual assets and multi-select batches; and open any theme to browse its connected uploads. Assets and themes have a many-to-many relationship. A theme may be hard-deleted only when it has zero connected assets. A connected theme must be archived instead: archiving preserves all existing connections, blocks new assignments until the theme is restored, removes it from the assignment picker, and keeps it filterable and viewable with its connected uploads. Theme connections are created only by explicit admin actions and are never inferred from upload or task context.

**Rationale:** Guarded deletion prevents accidental loss of organization while archival supports lifecycle management without hiding connected content.

### PRD — FR45 (v2)

**OLD**

> FR45: Admins can create campaigns and link tasks, assets, shares, and usage to them.

**NEW**

> FR45 (v2): Admins can create, view, update, archive/restore, and delete time-boxed campaigns in an admin-only calendar. A campaign has a description, start and end dates, and at most one selected theme through nullable `campaigns.theme_id`, allowing creation before a theme is chosen. Campaigns and assets have a many-to-many relationship through `asset_campaigns`. Asset connections are created only by explicit admin actions and are never inferred or propagated from `assets.task_id` or other workflow context. MVP provisions `campaigns` and `asset_campaigns` without campaign or calendar UI; the ambassador landing page remains the task list.

**Rationale:** The nullable single-value theme relationship supports incomplete campaign setup while preserving the intended selected-theme constraint.

### PRD — Journey 4

**OLD**

> Petra searches descriptions/tags, asks the uploading ambassador, deletes the matches and their generated children, and responds within the deadline.

**NEW**

> Petra searches upload descriptions and asks the uploading ambassador to identify any remaining matches, then deletes the confirmed assets and their generated children within the deadline. With freeform tags removed, bystander findability intentionally rests on upload descriptions plus human confirmation from the uploader. Curated theme names will not contain personal data and are not a person-search surface. This is an accepted, documented consequence of the curated theme model, not a regression to solve with another freeform taxonomy.

### Offboarding and Erasure Runbook — Process B

**OLD**

> Identify affected uploads — search descriptions and tags (FR24); ask the uploading ambassador(s) if needed.

**NEW**

> Identify affected uploads — search upload descriptions, then ask the uploading ambassador(s) to identify any remaining matches. Curated theme names do not contain personal data and must not be used as a person-search surface. The reduced freeform search surface is an accepted consequence of replacing tags with curated themes.

### UX — Theme Assignment Control (Epic 6)

**OLD**

> UX-DR12: TagPicker — type-ahead combobox over existing tags + “Create '{query}'” row; multi-assign; removable chips inline.

**NEW**

> UX-DR12: ThemePicker — a type-ahead combobox over active curated themes with multi-assign and removable selections. Authorized admins receive an inline “Create theme” affordance so triage remains uninterrupted when a needed theme does not exist. Archived themes are absent from this assignment picker and reject new assignments, but remain available in filters, theme browse views, and connected-upload views until restored. This control replaces the freeform TagPicker rather than renaming it.

### UX — SelectionBar (Epic 7)

**OLD**

> UX-DR13: “{n} selected · {~size} · Tag · Export zip · Delete · Clear”

**NEW**

> UX-DR13: “{n} selected · {~size} · Theme · Export zip · Delete · Clear”

**Rationale:** The Epic 7 bulk-action surface must use the new MVP grouping axis.

### Architecture — Data Model and Assignment Rules

**OLD**

> `tags`, `asset_tags`, task/event campaign seams, and a tags-to-campaign migration path.

**NEW**

> `themes(id, name, archived_at, created_at, updated_at)`, `asset_themes(asset_id, theme_id, created_at)`, `campaigns(id, description, starts_at, ends_at, theme_id NULL REFERENCES themes(id), archived_at, created_at, updated_at)`, and `asset_campaigns(asset_id, campaign_id, created_at)`. Both join tables use composite uniqueness. No campaign FK is added to tasks or usage/event rows. DAL mutations require explicit admin intent; `assets.task_id` and upload context cannot write either join table.

Theme deletion checks `asset_themes` first and succeeds only at zero connections. Connected themes return a conflict with archive as the remedy. Archived themes remain queryable for filters/browse and reject new join inserts until restored.

### Epics and Sprint Status

- Rename Story 6.3 to theme lifecycle, assignment, and browse behavior.
- Move the FR15 non-propagation acceptance criterion to Story 5.4.
- Add Story 7.1 SelectionBar terminology and Story 7.3 erasure-search consequences.
- Remove campaign UI/reporting from Epic 9.
- Add Epic 10 and its v2 campaign-calendar stories as backlog entries.
- Update `sprint-status.yaml` identifiers only after proposal approval.

### Testing and Documentation

Add coverage for:

- theme many-to-many assignment and removal;
- inline permissioned theme creation from triage;
- archived theme excluded from assignment but retained in filter/browse results;
- guarded delete success at zero connections and conflict-with-archive remedy when connected;
- no theme/campaign joins created by upload or `task_id` linkage;
- nullable `campaigns.theme_id` and campaign creation without a selected theme;
- bystander-erasure workflow relying on descriptions plus uploader confirmation.

Update project context, test plans, README, and active source documents to remove taxonomy-related tag/folder terminology. Regenerate implementation readiness after the source artifacts are synchronized.

## 5. Implementation Handoff

**Scope classification:** Moderate.

**Handoff recipients:** Product Owner / Developer, with architecture review for the revised schema constraints.

- Product Owner: approve PRD/phasing and backlog reorganization.
- Architect: synchronize the data model, API contracts, indexing/search rules, and project context.
- UX: replace TagPicker with ThemePicker and apply archive visibility rules across picker/filter/browse surfaces.
- Developer: implement schema, DAL, UI, migrations, and tests from the approved artifacts.

### Success Criteria

- No active taxonomy requirement or UI calls the grouping model tags or folders.
- Themes are the only manual grouping axis exposed in MVP.
- Connected themes cannot be hard-deleted and remain browsable when archived.
- Archived themes cannot receive new asset assignments and do not appear in ThemePicker.
- Campaign tables and the asset join table exist in MVP with nullable `campaigns.theme_id`, but no campaign/calendar UI exists.
- Neither upload nor task linkage creates theme/campaign connections.
- Ambassador home remains the task list; the campaign calendar is admin-only in v2.
- The runbook explicitly records the accepted bystander-findability consequence.

## Approval

Approved by Rasmus on 2026-07-10 for implementation and handoff.

## Workflow Execution Log

- **Change trigger:** Replace the MVP freeform tag/folder taxonomy with curated themes and dormant v2 campaign seams.
- **Mode:** Incremental.
- **Approval:** Explicit “yes” received from Rasmus on 2026-07-10.
- **Scope classification:** Moderate.
- **Artifacts modified by this workflow:** This finalized Sprint Change Proposal.
- **Routed to:** Product Owner / Developer, with architecture and UX synchronization responsibilities defined in the handoff above.
- **Backlog synchronization:** Action required during handoff. Update `epics.md` and `sprint-status.yaml` atomically after applying the approved story changes, including the new Epic 10 entries; do not update sprint tracking ahead of its source epic definitions.
- **Required implementation outputs:** Synchronized PRD, epics/stories, architecture, UX, project context, runbook, test plans, README, and sprint status; implementation and verification of the approved schema and behavior.
