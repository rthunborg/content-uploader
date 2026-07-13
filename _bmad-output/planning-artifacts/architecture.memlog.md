---
scope: Update architecture.md for approved themes and campaign seams proposal
purpose: Keep the implementation architecture aligned with the amended PRD
altitude: system architecture
updated: 2026-07-12T11:30
---

- (constraint by user) The approved sprint change proposal dated 2026-07-10 is authoritative; PRD is already amended.
- (decision by user) Replace the one-taxonomy tags-as-folders doctrine with two orthogonal axes: curated themes are live in MVP; campaigns are dormant schema seams for v2 with no MVP readers or UI. This binds taxonomy ownership and prevents tags and campaigns from being conflated.
- (decision by user) Adopt themes(id, name, archived_at, created_at, updated_at), asset_themes(asset_id, theme_id, created_at), campaigns(id, name, description, starts_at, ends_at, theme_id nullable FK themes.id, archived_at, created_at, updated_at), asset_campaigns(asset_id, campaign_id, created_at); both joins composite-unique. Campaign name corrects the proposal sketch and is required for calendar display.
- (decision by user) Both joins are created or removed only by explicit admin DAL mutations; upload context and assets.task_id never infer, propagate, or write either join. No campaign_id exists on tasks or usage/event rows; campaign connections exist only in asset_campaigns. This supersedes the former AR11 nullable campaign seam.
- (decision by user) archived_at on themes and campaigns is a lifecycle status flag, not soft delete: these rows hold no personal data and must retain stable identity and existing organization links. Archived themes remain queryable in filters, browse, and connected-upload views but reject new joins until restored. Theme hard delete is allowed only with zero asset_themes connections; otherwise return CONFLICT with archive as remedy.
- (decision by user) AR17 full-text search is description-only; theme names use a structured indexed join filter. Optimistic verbs are theme assign/unassign; bulk theme operations do not set triaged_at; theme CRUD remains deliberately unaudited.
- (direction by user) Campaign delete-versus-archive semantics are deferred to Epic 10 v2 planning.
- (decision) Reviewer-gate fix: campaigns.theme_id uses ON DELETE SET NULL; asset joins use asset-first composite uniqueness plus reverse browse indexes; new table nullability/default/date constraints and protective FK actions are pinned without deciding v2 campaign lifecycle semantics.
- (decision) Reviewer-gate fix: theme archive/restore, assignment insert, and guarded delete lock the theme row inside one transaction; archived themes are explicitly excluded from ThemePicker.
- (decision) Reviewer-gate fix: triaged_at is set only by single-asset star/theme/dismiss actions from triage; library bulk-theme mutations never set it.
- (event) Architecture update entered reviewer-gate verification.
- (decision) Reviewer-gate fix: route namespace encodes theme mutation intent. /api/triage/[assetId]/themes mutates the join and triaged_at atomically; /api/assets/[assetId]/themes and bulk-themes are library curation and never set triaged_at; no client source flag is accepted.
- (event) Architecture update finalized; reviewer gate passed with no remaining blocker.
