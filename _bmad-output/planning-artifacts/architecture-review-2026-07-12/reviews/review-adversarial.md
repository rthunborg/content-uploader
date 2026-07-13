# Adversarial Architecture Review — Themes and Campaign Seams

**Reviewed:** `_bmad-output/planning-artifacts/architecture.md` against `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-10.md` and the approved correction adding `campaigns.name`.

**Verdict:** **CHANGES REQUIRED.** The document incorporates the approved doctrine and schema names, but it is not yet a complete consistency contract. Independently built DAL, migration, library, triage, and future campaign units can still make incompatible choices at concurrency, foreign-key, lifecycle, and query boundaries.

- **[HIGH] Archive-vs-assign is specified as a check, not an atomic invariant (architecture lines 209–210, 606).** One implementation can read an active theme and insert `asset_themes` while another archives the same theme; both DAL operations satisfy their local preconditions, yet the final state violates “archived themes reject new join inserts.” Pin an enforcement mechanism that serializes archive/restore and assignment (for example, a row lock in one transaction or a database trigger). App-layer validation alone cannot guarantee the approved rule.

- **[HIGH] Guarded theme deletion has the same check-then-act race (architecture line 210).** “Check `asset_themes`, then delete at zero” permits a concurrent assignment between the count and delete. The architecture must bind delete and join insert to a single concurrency rule and specify how an FK violation/race maps to canonical `CONFLICT` with archive as the remedy. Otherwise one unit can return 500/constraint failure while another silently retries or deletes.

- **[HIGH] Required foreign-key delete actions are missing (architecture lines 208, 279, 353).** Asset deletion must dispose of `asset_themes` and `asset_campaigns`, while theme deletion must be guarded, and future campaign deletion is deferred. The schema does not say `ON DELETE CASCADE`, `RESTRICT`, or `SET NULL` for any join FK or for `campaigns.theme_id`. Independently authored migrations can therefore make the central `deleteAssets()` path fail, erase organization links unexpectedly, or pre-decide the deferred campaign lifecycle. Pin the MVP FK actions explicitly.

- **[HIGH] Theme deletion checks only `asset_themes`, but `campaigns.theme_id` also references themes (architecture lines 208, 210–211).** Once campaign rows exist, a theme with zero asset connections may still be referenced by a campaign. The stated delete contract says it succeeds, while a default/restrict FK says it fails. `SET NULL` would make it succeed but is an unrecorded lifecycle decision. Define the interaction or explicitly state the temporary MVP invariant that no campaign rows can exist and require Epic 10 to settle it before any campaign writer ships.

- **[HIGH] Triage side effects contradict across authoritative sections (architecture lines 343, 353, 606).** The optimistic verb table and Validation Decision 11 say bulk theme operations do not set `triaged_at`, while the Process Pattern says “any verb sets `triaged_at`.” A library DAL can reasonably follow the latter and mark bulk-curated assets triaged. Replace “any verb” with the exact single-asset triage-context verbs, and state whether the same single-asset theme endpoint behaves differently when called from library versus triage; route origin is not a safe domain signal.

- **[MEDIUM] The exact schema still omits nullability/default and value constraints needed for convergence (architecture line 208).** `campaigns.name` is called required, but the binding schema does not explicitly mark it `NOT NULL`; the same ambiguity affects `themes.name`, `description`, dates, timestamps, and join timestamps. Nor is `starts_at <= ends_at` fixed for a “time-boxed” campaign. Two migrations can reproduce the listed columns yet accept incompatible data. State required/nullable columns, timestamp defaults, and the date-order check.

- **[MEDIUM] Curated-name identity is unresolved.** The ThemePicker and filter/browse model depend on human-readable theme names, but the architecture does not decide whether theme names are unique, case-insensitively unique, normalized, or allowed to duplicate. Separate units can create `Summer`, `summer`, and duplicate `Summer` rows, making assignment and URLs ambiguous. Bind the identity rule and its database index, or explicitly accept duplicates and require ID-disambiguated display.

- **[MEDIUM] “Structured indexed filter” does not fully specify the indexed access path (architecture lines 211, 618).** The named unique index begins `(theme_id, asset_id)`, which supports assets-by-theme, but there is no index or comparison contract for resolving theme names in ThemePicker/filter UI. Saying theme names are “resolved through the indexed `asset_themes` join” conflates label lookup with membership lookup. Pin filter wire identity (`themeId` or multiple IDs), match semantics for picker lookup, and any required `themes.name` index; retain description-only `tsvector` as already decided.

- **[MEDIUM] Archived-theme visibility is a policy statement without a query contract (architecture lines 210, 473).** `GET active/all` leaves different units free to hide archived themes from normal filter options, return them only through an undocumented flag, or include them everywhere. The approved proposal requires archived themes to remain available in filters, browse, and connected-upload views while disappearing from assignment. Define separate DAL queries/wire flags for assignable themes versus browse/filter themes, including how an already-selected archived theme is serialized.

- **[MEDIUM] Single-asset assignment/removal has no pinned request or idempotency contract (architecture lines 289, 467, 606).** `POST/DELETE /api/assets/[assetId]/themes` names verbs but not payload shape, whether multiple IDs are allowed, duplicate-assign behavior, absent-unassign behavior, or conflict behavior for archived themes. The composite unique constraint alone can surface provider-specific errors. Pin the wire shape and make assign/unassign idempotency and archived-theme `CONFLICT` behavior explicit so optimistic clients reconcile consistently.

- **[MEDIUM] The no-personal-data rationale is asserted but not protected (architecture line 210).** Theme names are curated, but `campaigns.description` is free text and nothing in the architecture prevents admins from entering personal data. Because “not soft delete” is justified by themes/campaigns holding no personal data, the content policy is load-bearing. Record a no-personal-data validation/governance rule for both theme names and campaign fields, or weaken the deletion rationale and revisit erasure behavior before campaign writers are enabled.

- **[LOW] The validation narrative is stale after moving FR45 to v2 (architecture Requirements Coverage section around line 584).** It still claims “all 12 v1.1 FRs have named MVP seams,” while the amended context correctly counts 11 v1.1 requirements plus one v2 requirement. This can send planning agents back toward the superseded v1.1 campaign scope. Update the validation statement and make clear that the campaign tables are the sole MVP provision for v2 FR45.

- **[LOW] Campaign dormancy is stated strongly but not made a testable build boundary (architecture lines 209, 289, 403, 503, 555).** “No readers, routes, or UI” is clear prose, yet the implementation sequence provisions the tables and the generic DAL ownership rule mentions campaign mutations. A developer can plausibly scaffold a campaign repository or admin mutation “for completeness.” State that MVP code may contain schema definitions and migration tests only—no campaign DAL module, query, seed data, route, or feature—and make Epic 10 the activation gate.

## Confirmed alignments

- The old tag/folder doctrine and `tags`/`asset_tags` are removed from active architecture contracts.
- The four requested tables and corrected `campaigns.name` are present, with composite uniqueness called out for both joins.
- Campaign linkage is limited to `asset_campaigns`; `campaign_id` on tasks and usage/event rows is explicitly forbidden.
- Description-only GIN full-text search and structured theme filtering are recorded in AR17 and its concrete index section.
- Theme archive/restore, guarded delete intent, optimistic assign/unassign terminology, unaudited theme CRUD, bulk-theme no-triage intent, and the Epic 10 campaign lifecycle deferral are all present.

## Follow-up Verification — 2026-07-12

**Verdict:** **ONE BLOCKER REMAINS.** Four of the five top findings are resolved; the triage-side-effect contract is only partially resolved.

- **Resolved — archive/assign and guarded-delete concurrency:** theme archive/restore, join insertion, and guarded deletion now lock the theme row with `SELECT … FOR UPDATE` in one transaction, preventing both reported races. The guarded delete still maps connected themes to canonical `CONFLICT` with archive as the remedy.

- **Resolved — foreign-key actions:** the architecture now pins asset-side join cascades, `asset_themes.theme_id` restriction, dormant `asset_campaigns.campaign_id` restriction, and explicitly records the Epic 10 revisit condition.

- **Resolved — campaign references during theme deletion:** `campaigns.theme_id` now uses `ON DELETE SET NULL`, so the guarded theme-delete contract is not contradicted by a dormant campaign reference.

- **Remaining blocker — single-asset theme mutation still has no deterministic triage-context contract (architecture lines 354 and 607).** The contradiction with bulk operations is removed, but the document says the shared `POST/DELETE /api/assets/[assetId]/themes` mutation sets `triaged_at` when invoked “from the triage surface.” Neither the route nor request body carries a pinned server-visible intent, so DAL implementations cannot safely distinguish the same single-asset action initiated from triage versus library. A client route/referrer is not a domain invariant. Pin one implementation contract: separate triage-specific mutation routes/DAL verbs, or an explicit validated intent field whose allowed value controls the transactional `triaged_at` side effect. Until then, independently built UI and DAL units can still disagree and prematurely remove library-curated assets from the triage queue.

- **Resolved — schema constraints:** required/nullable columns, timestamp defaults, update ownership, join uniqueness and reverse indexes, and `ends_at >= starts_at` are now explicit.

## Final Blocker Verification — 2026-07-12

**Verdict:** **PASS. No remaining blocker.**

- The route namespace is now the deterministic server-side intent boundary: `/api/triage/[assetId]/themes` performs assignment/removal and sets `triaged_at` atomically, while `/api/assets/[assetId]/themes` and `/api/assets/bulk-themes` perform library curation without changing `triaged_at`. The contract explicitly forbids a client-supplied source flag and is consistent across join ownership, process patterns, directory structure, and Validation Decision 11. This closes the final divergence identified in the follow-up review.
