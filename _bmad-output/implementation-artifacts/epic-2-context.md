# Epic 2 Context: Ambassador Accounts & Lifecycle Management

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the admin roster cockpit that establishes and manages the ambassador population before onboarding. Admins can invite ambassadors, maintain authoritative contact data, see last-login activity, and activate, deactivate, reactivate, or delete accounts; lifecycle changes must feed one account-state model and revoke all-device sessions immediately where required. Each invitation also starts the durable `invited_at` KPI clock.

## Stories

- Story 2.1: Ambassador roster & activity view
- Story 2.2: Invite ambassadors by email
- Story 2.3: Maintain ambassador contact details
- Story 2.4: Activate / deactivate accounts with session revocation
- Story 2.5: Delete ambassador account record

## Requirements & Constraints

- The management surface is admin-only. The roster exposes authoritative full name, email, mobile, account state, and `last_login_at`, with each row linking to an ambassador detail view.
- Full name and contact data are admin-maintained because there is no HR-system integration. Full name is required for new invitations; legacy missing values remain explicit, render as “Namn saknas,” and must never be inferred from email. Future sends use the maintained contact details.
- Roster activity means `profiles.last_login_at` only. Do not introduce or calculate an aggregate `last_activity_at`; render a null login as “Aldrig.”
- Invitations require a nonblank full name and email, allow optional mobile, create the profile in `invited` state, set `invited_at`, and send a passwordless invitation whose link is also the first-login link.
- Invite delivery is launch-critical and must be trackable. Failures and bounces cannot disappear silently; the complete admin failure surface is completed by the messaging capability in Epic 5.
- The authoritative account states are `invited`, `active`, `inactive_declined`, `inactive_withdrawn`, and `deactivated`. Deletion removes rows and is never a state or soft delete.
- Deactivation immediately changes state, globally revokes every active session, and prevents further protected actions. A deactivated user reaching the authenticated flow sees a paused state. Reactivation restores `active` access.
- Account deletion removes the Supabase auth user and `profiles` row, globally revokes sessions, and emits its lifecycle audit event. It must not delete uploaded assets or cascade into acceptance records; full content erasure belongs to the Epic 7 offboarding workflow.
- Lifecycle operations emit the registered events `account.invited`, `account.deactivated`, `account.reactivated`, and `account.deleted` as applicable.
- Server-side role enforcement is mandatory, with row-level security as defense in depth. Personal and auth-delivery data must remain stored and processed in EU regions.

## Technical Decisions

- Supabase Auth owns passwordless identity and global session revocation. The `profiles` table owns authoritative display/contact data, account state, and durable KPI timestamps including `invited_at` and `last_login_at`.
- Use magic-link authentication with a single link-consumption front door. Invitations use the Supabase invite flow; auth email delivery is routed through the tracked email seam so delivery records and bounce webhooks can be associated with the recipient.
- All table access and lifecycle mutations pass through the server-only data-access layer; route handlers and server components do not access the database directly. Admin operations use the admin auth context, which checks identity, admin role, and account state but does not apply the ambassador consent gate.
- Deactivation and deletion call `supabase.auth.admin.signOut(userId)` globally. Because an issued access token can remain locally valid until expiry, every app-tier authenticated data request also performs a network-validated user lookup and account-state check. A deactivated account is denied with the canonical inactive-account response.
- Keep profile mutations behind the ambassador feature DAL and `deleteAccount(profileId)` seam. Mutations and audit emission share a database transaction where both affect database state; deletion remains the reusable account-removal step later composed by offboarding.
- Acceptance evidence has no cascading foreign key to the live account. Its denormalized identity evidence remains retained while relevant content exists, independent of profile deletion.
- Durable KPI columns are DAL-updated and never derived from the six-month audit log. Timestamps travel as UTC ISO values and render through the shared Europe/Stockholm formatter.
- Wire payloads use Zod schemas shared by client and server boundaries. Profile edits are server-acknowledged before cache invalidation; destructive deletion is never optimistic.

## UX & Interaction Patterns

- Use the desktop-first admin shell with top bar, left rail, and compact density; keep roster browsing and single-item actions usable in phone check-in mode. Compact admin targets are at least 32 px with 8 px spacing, and all icon actions require accessible labels.
- The invite form is single-column with labels above fields, full name and email plus mobile marked optional. Validate on blur and submit, show errors below the relevant field, and never clear entered values after an error.
- Dense roster dates may be relative, with absolute values on hover or detail. Loading rows use skeletons after a short delay and reserve layout space.
- Empty roster states should explain the state and offer the next action, such as inviting the first ambassador. Use warm, actionable language rather than a blank table.
- Deletion entry points stay quiet; the irreversible confirmation uses the consequence-first destructive-dialog pattern with explicit scope and a verb-plus-object confirm label. Paused-account messaging explains what happened without punitive language.

## Cross-Story Dependencies

- The roster and detail view provide the navigation and data context for contact edits, lifecycle actions, deletion, and Epic 7’s later offboarding entry point.
- Invitation creates the `invited` profile and KPI baseline consumed by Epic 3 onboarding and the later activation metric. The invitation link relies on the passwordless auth foundation from Epic 1.
- Deactivation establishes the account state later consumed by Epic 5 send suppression; tracked invitation delivery is completed by Epic 5’s messaging adapter and admin failure surface.
- Account deletion intentionally leaves assets and acceptance evidence in place. Epic 7 composes deactivation, content erasure, account deletion, recipient-PII cleanup, and durable erasure evidence into the complete offboarding protocol.
