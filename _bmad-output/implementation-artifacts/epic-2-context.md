# Epic 2 Context: Ambassador Accounts & Lifecycle Management

<!-- Generated from the project planning artifacts. Keep this file focused on epic-level implementation context. -->

## Goal

Deliver the admin roster cockpit needed to establish and manage the ambassador population before onboarding. Admins can invite ambassadors, maintain their contact data, inspect last-login/activity, and activate, deactivate, reactivate, or delete accounts. Lifecycle changes must update the account-state machine and revoke all device sessions immediately where required. Inviting an ambassador starts the durable `invited_at` KPI clock.

## Stories

- **2.1 Ambassador roster & activity view** — Browse ambassadors, their contact details, account state, and recent activity, with access to an individual detail view.
- **2.2 Invite ambassadors by email** — Create an invited account and send the passwordless invitation that also serves as first login.
- **2.3 Maintain ambassador contact details** — Keep admin-owned email and mobile data current for future communications.
- **2.4 Activate / deactivate accounts with session revocation** — Pause or restore access while recording lifecycle events and revoking sessions on deactivation.
- **2.5 Delete ambassador account record** — Remove the auth identity and profile without deleting retained consent evidence or uploaded content.

## Requirements & Constraints

- The management surface is admin-only and must expose full name, email, mobile, account state, and last login. Contact data has no upstream HR integration and is explicitly maintained by admins.
- `profiles.full_name` is the authoritative display/export name. It is nullable for migrated/pre-existing rows, never inferred from email, required for new ambassador invitations, and maintained with email/mobile. Missing legacy values render as “Namn saknas” until corrected.
- Story 2.1's “last-login/activity” value is exactly the durable `profiles.last_login_at` KPI. Do not aggregate other KPI timestamps or introduce `last_activity_at`; render null as “Aldrig.”
- Account states are `invited`, `active`, `inactive_declined`, `inactive_withdrawn`, and `deactivated`; deletion is row removal, never another state or a soft delete.
- Invitations collect a nonblank full name plus email and optional mobile, create the profile in `invited` state, persist `invited_at`, and send a trackable Supabase invite email. A failed or bounced invitation must not disappear silently, although the complete messaging failure surface arrives in Epic 5.
- Deactivation and deletion must globally revoke active sessions. Every protected data operation must still reject a deactivated account even if a stale client session exists.
- Deactivated users reaching the authenticated entry flow see the paused state. Reactivation restores the account to `active` so passwordless login and authorized actions can resume.
- Account deletion removes the auth user and profile/contact data but must not cascade to acceptance records or ambassador assets. Full content erasure is a separate Epic 7 workflow.
- Durable KPI fields, including `invited_at` and `last_login_at`, are updated through the data-access layer and must not be derived from the expiring audit log.
- Emit only registered lifecycle audit events: `account.invited`, `account.deactivated`, `account.reactivated`, and `account.deleted` as applicable.
- Role enforcement belongs at the server data-access boundary with row-level security as a backstop; client-side hiding is insufficient authorization.

## Technical Decisions

- Supabase Auth owns identities and global session revocation; the `profiles` table owns `full_name`, contact data, lifecycle state, and durable KPI timestamps.
- Perform lifecycle mutations through the centralized data-access layer and thread profile/auth changes, KPI updates, and audit emission through consistent transactional boundaries where supported.
- Use `supabase.auth.admin.signOut(userId)` for global revocation on deactivation and deletion. The auth confirmation path checks `profiles.account_state`, while ordinary data operations return an inactive-account denial for deactivated users.
- Keep acceptance evidence independent of `profiles` and `auth.users`: it stores denormalized identity snapshots and has no cascading foreign key to the deleted account.
- Keep account deletion behind the shared `deleteAccount(profileId)` seam so later offboarding can compose it with asset erasure, recipient-PII cleanup, and retained erasure evidence without changing its core contract.

## UX & Interaction Patterns

- Use the desktop-first admin shell with top bar, left rail, compact rows, and shallow navigation. The roster remains browsable in phone check-in mode; single-item actions adapt to touch.
- Show relative `last_login_at` dates in dense rows and absolute values on hover or detail. Display ambassadors by `profiles.full_name`, using “Namn saknas” for a missing legacy value without deriving a name from email.
- Invite and contact forms are single-column with labels above fields, blur-and-submit validation, inline messages, and preserved input after errors.
- Loading rows use delayed skeletons to avoid flashing. Empty roster states should explain the state and offer the next action, such as inviting the first ambassador.
- Destructive actions use a consequence-first dialog that states scope and permanence. Lifecycle/error feedback follows “what happened, why, remedy,” with no raw provider errors.
- Preserve keyboard operation, semantic table/list structure, labeled controls, visible focus, and at least 32 px compact admin targets with spacing.

## Cross-Story Dependencies

- The roster and detail route provide the shared selection and entry surfaces for contact editing, lifecycle controls, account deletion, and Epic 7 offboarding.
- Invitation establishes both the profile state consumed by later lifecycle stories and the `invited_at` baseline used by activation metrics.
- Deactivation establishes the inactive-account behavior that Epic 5 messaging must honor through send suppression.
- Epic 3 converts invited ambassadors into active contributors after consent; Epic 7 composes deactivation and account deletion with complete content erasure.
