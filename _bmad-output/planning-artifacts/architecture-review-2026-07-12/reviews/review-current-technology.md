# Current-Technology / Reality-Check Review

**Artifact:** `_bmad-output/planning-artifacts/architecture.md`
**Scope:** 2026-07-12 themes/campaign architecture amendment only
**Verdict:** **PASS WITH TECHNICAL CLARIFICATIONS**

## Technology freshness

The amendment introduces no new framework, service, package, provider capability, or version claim. It relies only on the already-selected PostgreSQL/Drizzle/DAL stack and changes the relational model and application invariants within it. Therefore no new web research is required for this edit, and none of the document's pre-existing named technology/version claims needs re-verification solely because of the themes/campaign change.

The search terminology is technically sound: PostgreSQL GIN indexing of a `tsvector` derived only from asset descriptions is appropriate for description full-text search, while theme filtering/browsing is a structured relational join and should not be included in that text-search vector. The reverse-order join indexes beginning with `theme_id` / `campaign_id` support the named filter/browse access paths.

## Findings

### 1. Theme deletion conflicts with the nullable campaign-theme foreign key unless its delete action is defined

**Severity:** High — internal schema/lifecycle contradiction for v2 data.

The binding schema declares `campaigns.theme_id NULL REFERENCES themes(id)`, while the theme lifecycle says hard delete checks only `asset_themes` and succeeds whenever there are zero asset connections. With PostgreSQL's default foreign-key action (`ON DELETE NO ACTION`), a campaign referencing the theme will still prevent deletion even when `asset_themes` is empty. That makes “succeeds only at zero connections” false after campaign writers exist.

Specify the intended foreign-key delete action now. `ON DELETE SET NULL` is the natural fit for an optional selected theme and preserves campaign rows; alternatively, broaden the guarded-delete rule to treat campaign references as blocking connections. This does not decide campaign delete-vs-archive semantics and therefore does not violate the Epic 10 deferral.

### 2. Archive rejection and guarded deletion need atomic concurrency semantics

**Severity:** Medium — implementation-level race can violate a stated invariant or produce the wrong conflict path.

The DAL rule “check `archived_at`, then insert” can race with a concurrent archive, and “check `asset_themes`, then delete” can race with a concurrent assignment. Plain application checks under PostgreSQL MVCC do not make either invariant atomic. The architecture should require these checks and mutations to execute in one transaction with an explicit locking/constraint strategy—for example, lock the theme row during assignment/archive/delete, retain foreign keys on both join columns, and translate the database conflict to the canonical `CONFLICT` response. A database trigger is another valid enforcement option, but a bare pre-check is insufficient.

### 3. Composite uniqueness is valid, but the index order should be made unambiguous in the schema contract

**Severity:** Low — clarity/performance hardening.

The named unique indexes `idx_asset_themes_theme_id_asset_id` and `idx_asset_campaigns_campaign_id_asset_id` correctly enforce pair uniqueness and efficiently serve theme/campaign-to-assets traversal. PostgreSQL does not automatically index referencing foreign-key columns, however, and those reverse-order indexes do not serve asset-to-themes/campaigns lookups by `asset_id` alone. Since the API exposes asset-theme reads/mutations, implementation should also provide an `asset_id`-leading access path—commonly a composite primary key or unique constraint on `(asset_id, theme_id)` / `(asset_id, campaign_id)`, plus the reverse non-unique indexes for browsing. If the named reverse unique indexes are intended as the sole composite-unique constraints, add separate `asset_id` indexes.

## Reality-check conclusion

The two-axis model, dormant campaign seam, description-only full-text search, and explicit DAL ownership all fit the existing stack without introducing new technology risk. Resolve the foreign-key delete action and concurrency enforcement before treating the lifecycle rules as implementation-complete; clarify join-index order to avoid an avoidable asset-side lookup gap.
