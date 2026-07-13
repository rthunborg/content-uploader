# Architecture Rubric Review — Themes and Campaign Seams

**Reviewed:** 2026-07-12
**Target:** `_bmad-output/planning-artifacts/architecture.md`
**Inputs:** approved `sprint-change-proposal-2026-07-10.md` and amended `prd.md`
**Lens:** BMad good-spine rubric adapted to the existing comprehensive architecture document

## Verdict

**Conditional pass — the requested change is substantively present, with one high-severity active contradiction and two medium-severity divergence seams to close before implementation.**

No critical requirement is absent. The architecture correctly replaces tags with curated themes, provisions the corrected campaign schema including `campaigns.name`, confines campaign connections to `asset_campaigns`, keeps campaigns dormant in MVP, prohibits inferred joins, amends AR17 to description-only full-text search, updates optimistic verbs, preserves the bulk-theme/`triaged_at` distinction, leaves theme CRUD unaudited, and records the campaign lifecycle deferral.

## Findings

### [HIGH] The global “no soft delete anywhere” law still contradicts the new `archived_at` doctrine

**Evidence:** Architecture line 67 says “No soft delete anywhere” and instructs implementers not to reintroduce it. Line 210 later says `archived_at` on themes/campaigns is a lifecycle status flag, not soft delete, and describes the older law as a “no-soft-delete personal-data rule.” The latter qualification is not present in the actual global constraint.

**Why this matters:** Both sentences are active guidance. One implementer can obey line 67 and reject or remove `archived_at`; another can obey line 210 and retain it. The later rationale is sound, but merely relabeling archival does not resolve the scope contradiction in the earlier binding rule.

**Recommended resolution (autofix):** Amend line 67 so the invariant explicitly forbids soft deletion for personal/content data while allowing lifecycle status flags for non-personal organizational metadata (`themes`, `campaigns`). Preserve the permanent-delete requirement for assets, accounts, and personal data. This makes the rationale at line 210 a direct application of the constraint instead of an exception that silently rewrites it.

### [MEDIUM] Theme deletion is behaviorally specified but not made concurrency-safe or structurally enforceable

**Evidence:** Lines 208–210 require composite uniqueness and say deletion checks `asset_themes` first, succeeding only at zero connections. The document does not pin join-table FK delete actions or state that the zero-connection guard and delete occur atomically. The authoritative asset deletion path at line 353 also does not say whether it explicitly deletes join rows or relies on cascade behavior.

**Why this matters:** A check-then-delete implementation can race with a concurrent assignment. Independently built migrations can also choose incompatible FK actions (`RESTRICT`, `CASCADE`, or defaults), causing theme deletion or `deleteAssets()` to behave differently. This is a real one-level-down divergence point and weakens the guarded-delete rule’s enforceability.

**Recommended resolution (discuss/autofix):** Pin only the MVP-relevant integrity behavior: theme-side deletion is DB-restricted while connections exist; the guarded delete runs transactionally and maps the FK/connection conflict to the canonical `CONFLICT` + archive remedy; asset deletion removes `asset_themes` deterministically (explicitly or by a named cascade choice). Keep campaign delete/archive FK behavior deferred with the rest of Epic 10 semantics.

### [MEDIUM] Archived-theme exclusion from the assignment picker is implied, not bound

**Evidence:** The proposal and amended PRD FR27 explicitly require archived themes to be absent from the assignment picker. Architecture line 210 binds filter/browse visibility and server-side rejection of new joins, while the route tree at line 473 only comments `GET active/all for browse/filter`. No active rule explicitly assigns the active-only query to `ThemePicker`.

**Why this matters:** A UI implementer can legitimately populate `ThemePicker` from the “all” result, exposing archived choices that then fail at insertion. The server guard protects integrity but not the approved UX contract.

**Recommended resolution (autofix):** Add one sentence to the theme lifecycle or frontend rule: `ThemePicker` consumes active themes only; archived themes are excluded from assignment surfaces while remaining present in filter/browse/connected-upload queries.

## Requested-Change Coverage

| Requested invariant | Result | Architecture evidence |
|---|---|---|
| Two orthogonal axes: themes MVP, campaigns v2 | Covered | Lines 207, 403 |
| Remove `tags` / `asset_tags` from active guidance | Covered | Lines 207, 279; remaining tag wording is explicitly historical/superseded |
| Exact four-table schema plus `campaigns.name` | Covered | Line 208 |
| Composite-unique join tables | Covered | Lines 208, 618 |
| Campaign tables dormant: no readers/routes/UI | Covered | Lines 209, 403, 505, 555 |
| Explicit admin-only join mutations; no inferred propagation | Covered | Lines 209, 403, 606 |
| No campaign FK on tasks/events; connections only in `asset_campaigns` | Covered | Lines 44, 206, 403 |
| `archived_at` is status, not soft delete, with rationale | Covered but contradicted | Line 210 versus line 67 |
| Guarded theme delete with conflict/archive remedy | Covered but enforcement seam remains | Line 210 |
| Archived theme queryability and insert rejection | Covered | Line 210 |
| AR17 description-only GIN; theme is structured join filter | Covered | Lines 211, 403, 618 |
| Optimistic assign/unassign; bulk does not triage | Covered | Lines 235, 343, 606 |
| Theme CRUD deliberately unaudited | Covered | Lines 230, 340 |
| Campaign delete-vs-archive semantics deferred to Epic 10/v2 | Covered | Lines 198, 211, 403 |

## Rubric Notes

- **Requirements coverage:** Strong. The amended FR15, FR24, FR25, FR27, and FR45 architecture consequences are represented, subject to the picker finding above.
- **Contradictory active guidance:** One direct contradiction remains: the global no-soft-delete law versus archival status flags.
- **Enforceability:** Join ownership and search behavior are clear. Theme deletion needs a DB/transaction rule to prevent race-dependent interpretations.
- **Deferred scope:** Campaign lifecycle semantics are appropriately and consciously deferred; the deferral does not undermine MVP because the campaign tables have no readers or writers exposed in MVP.
- **Silent divergence risk:** Low after the three findings are resolved. No remaining active task/event campaign seam or tag-based taxonomy guidance was found.
