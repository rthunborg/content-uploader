---
title: 'Story 3.1: Versioned terms & tamper-evident acceptance store'
type: 'feature'
created: '2026-07-16'
status: ready-for-dev
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/consent-cards.md'
warnings:
  - oversized
---

<intent-contract>

## Intent

**Problem:** The consent gate currently fails closed because the project has no versioned terms store or durable acceptance evidence. Compliance requires append-only records whose modification is detectable while legitimate erasure makes identity snapshots unreadable without resembling tampering.

**Approach:** Add the consent schema, publication and acceptance DAL seams, HMAC-chain verification, per-user PII crypto-shredding with signed tombstones, and the scheduled worker verification path. Story 3.1 supplies infrastructure only; the first-login UI and account activation mutation remain Story 3.2.

## Boundaries & Constraints

**Always:** Keep `acceptance_records` INSERT-only through grants and an owner-effective trigger, with no `updated_at` or FK to live identity rows. Store denormalized identity snapshots, keep `ACCEPTANCE_HMAC_KEY` and `CONSENT_PII_KEK` outside Postgres, preserve acceptance evidence indefinitely, emit `terms.version_created` transactionally, use `requireUserPreConsent()` for consent operations, and report integrity failures through the runtime-neutral critical logging seam without secrets, ciphertext, or key material. Use one globally ordered acceptance/tombstone chain, serialized inside the append transaction by a transaction-scoped Postgres advisory lock plus the locked singleton chain-head row.

**Block If:** A production terms publication is attempted without a complete approved manifest containing the exact Swedish card copy and non-empty full legal text for all three cards, or if either cryptographic environment key is absent or malformed. Fail closed; implementation and tests may use clearly synthetic fixtures, but must not invent or seed production legal text.

**Never:** Add consent UI, activate profiles, implement decline/re-accept flows, invent legal text, add acceptance UPDATE/DELETE or audit-expiry paths, store either environment key or an unwrapped per-user key in the database, log sensitive cryptographic material, or broaden unrelated environment/config drift.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Publish terms | A schema-v1 JSON manifest with semantic version, `sv-SE` locale, the three stable card IDs in canonical order, exact title/body copy, and non-empty `legalTextMarkdown` per card | One immutable terms version, canonical payload SHA-256, and `terms.version_created` audit event commit atomically | Duplicate/invalid/incomplete manifest leaves neither row nor audit event; no production seed is created from the incomplete planning artifact |
| Append acceptance | Pre-consent user and current published version | Identity snapshot is encrypted and one chained acceptance record commits | Missing current terms, invalid identity, or failed crypto produces no partial record |
| Concurrent append | Two valid acceptance/tombstone appends race | The global advisory lock and locked chain-head row assign contiguous `chain_position` values and exactly one predecessor to each record | One transaction waits or fails cleanly; no fork, duplicate position, or partial head update |
| Verify chain | Untouched globally ordered records, a valid signed chain-head state, and valid erasure tombstones | Verification succeeds without a critical log | Changed, missing, reordered, forked, tail-truncated, or invalidly tombstoned evidence emits one sanitized critical event |
| Crypto-shred | Existing records for an erased user | Per-user decryptability is destroyed and a signed tombstone preserves valid evidence | Idempotent retry does not corrupt or fork the chain |
| Consent currency | User has current, stale, absent, or tombstoned-only acceptance | Only a current valid acceptance satisfies the consent provider | Fail closed on malformed evidence or store errors |

</intent-contract>

## Code Map

- `src/db/schema/consent.ts` -- new terms, acceptance, and per-user PII-key schema.
- `supabase/migrations/*_story_3_1_consent_store.sql` -- constraints, grants, mutation trigger, and scheduled verification enqueue.
- `src/features/consent/dal/consent-status.ts` -- replace the documented fail-closed Story 3.1 seam with current-version evidence lookup.
- `src/features/consent/dal/pre-consent.ts` -- expose current-terms and acceptance operations through the established pre-consent boundary.
- `src/features/consent/dal/terms.ts` -- version publication and immutable current-terms reads.
- `src/features/consent/dal/acceptance.ts` -- acceptance append and Epic 7 crypto-shred/tombstone seam.
- `src/features/consent/crypto.ts` -- the resolved canonical HMAC, AES-256-GCM envelope encryption, decryption, and verification primitives.
- `scripts/publish-terms.ts` -- operational terms publisher using the consent DAL.
- `worker/jobs/verify-acceptance-chain.ts` -- scheduled integrity verifier and sanitized critical reporting.
- `worker/index.ts` -- maintenance-job dispatch integration.
- `src/shared/logger.ts` -- existing runtime-neutral critical logging contract; use without broadening its responsibilities.
- `.env.example` -- add empty `CONSENT_PII_KEK` alongside `ACCEPTANCE_HMAC_KEY`; never add real values.

## Tasks & Acceptance

**Execution:**
- `src/db/schema/consent.ts`, `src/db/schema/index.ts`, and `supabase/migrations/*_story_3_1_consent_store.sql` -- define and migrate the immutable consent store, indexes, DB protections, and maintenance enqueue.
- `src/features/consent/crypto.ts` and co-located tests -- implement the resolved versioned-array canonicalization, signed chain-head verification, AES-256-GCM envelope, and crypto-shred behavior.
- `src/features/consent/dal/terms.ts` and co-located tests -- publish/read immutable terms and atomically emit `terms.version_created`.
- `src/features/consent/dal/acceptance.ts` and co-located tests -- append serialized acceptance evidence safely under concurrency and provide the idempotent Epic 7 shred/tombstone seam.
- `src/features/consent/dal/consent-status.ts`, `src/features/consent/dal/pre-consent.ts`, and tests -- replace the fail-closed placeholder and expose only allow-listed pre-consent operations.
- `scripts/publish-terms.ts` and tests -- validate and publish a supplied schema-v1 manifest without embedding or inventing absent legal bodies.
- `worker/jobs/verify-acceptance-chain.ts`, minimal worker database/maintenance dispatch files, and tests -- consume the scheduled job, verify all evidence, and emit sanitized critical failures.
- `supabase/seed.sql` -- do not seed a production terms version while the approved artifact lacks the actual full legal-text bodies; synthetic test fixtures must be unmistakably non-production.

**Acceptance Criteria:**
- Given versioned terms, when the publishing script receives a valid schema-v1 manifest, then an immutable `terms_versions` row containing the exact structured payload plus its canonical SHA-256 and a `terms.version_created` audit event commit together; missing or blank legal text is rejected.
- Given acceptance evidence, when the database store is inspected and mutation attempts are executed, then records have no live-user FK or `updated_at`, INSERT is allowed only to the intended server role, and UPDATE/DELETE fail even for the normal application owner path.
- Given a pre-consent user and current published terms, when acceptance is appended, then encrypted denormalized identity, terms version, terms payload SHA-256, server timestamp, `chain_position`, `prev_hmac`, and `hmac` form exactly one transactionally consistent entry in the globally serialized chain.
- Given concurrent acceptance or tombstone appends, when transactions race, then the advisory lock and chain-head row produce contiguous positions and one predecessor per record, and the HMAC-signed head is updated atomically with the append.
- Given an acceptance or tombstone record, when its HMAC is calculated, then UTF-8 `JSON.stringify` of the fixed-order array `["acceptance-record-v1", chainPositionDecimal, recordId, recordType, userIdSnapshot, termsVersionIdOrNull, termsPayloadSha256OrNull, occurredAtUtcIso, prevHmacHex]` is the only canonical record payload. UUIDs and hex are lowercase, timestamps are UTC ISO-8601 with milliseconds, and encrypted PII fields, nonces, authentication tags, and wrapped-key fields are excluded from the HMAC chain.
- Given the singleton chain head, when it is created or advanced, then its HMAC uses the fixed-order array `["acceptance-chain-head-v1", chainPositionDecimal, headHmacHex]`; the verifier requires a valid head signature matching the final record so tail truncation is detectable.
- Given identity snapshot PII, when it is stored, then `{ email, fullName }` is encrypted with a random per-user 32-byte data-encryption key using AES-256-GCM with a random 12-byte nonce, 16-byte tag, and record/user-bound additional authenticated data. The data key is itself AES-256-GCM-wrapped by the base64-decoded 32-byte `CONSENT_PII_KEK`, with user-bound additional authenticated data, and only wrapped key material is stored in `consent_pii_keys`.
- Given current, stale, missing, malformed, or tombstoned-only evidence, when the outer auth consent provider checks currency, then only a valid acceptance of the current published version returns satisfied.
- Given a user erasure request, when the Epic 7 seam is invoked repeatedly, then PII becomes undecryptable, one valid signed tombstone represents the shred, and the remaining evidence verifies without treating erasure as tampering.
- Given scheduled verification, when pg_cron enqueues `verify-acceptance-chain`, then the worker consumes that named maintenance job; valid evidence is silent and any modification, deletion, reordering, fork, or invalid tombstone emits one sanitized critical structured log.

## Spec Change Log

- 2026-07-16 — Autonomous escalation resolution self-approved the recommended secure defaults: one global serialized chain with a signed head, fixed-order JSON-array HMAC payloads excluding encrypted PII, AES-256-GCM per-user envelope encryption under `CONSENT_PII_KEK`, and manifest-only terms publication with no fabricated production seed.

## Review Triage Log

## Design Notes

The escalation is resolved with these binding implementation contracts:

1. **Chain scope and concurrency:** one global chain covers both acceptance and erasure-tombstone records. Appends take a transaction-scoped advisory lock, lock the singleton chain-head row, assign the next contiguous `chain_position`, insert the record, and update the HMAC-signed head in the same transaction. This accepts serialized consent writes in exchange for one verifiable evidence ledger and tail-truncation detection.
2. **Canonical HMAC payload:** record and head payloads are the exact versioned fixed-order JSON arrays named in the acceptance criteria. The chain authenticates pseudonymous evidence and terms identity. In accordance with Architecture validation decision 1, encrypted PII envelopes and wrapped-key fields are outside the HMAC chain; AES-GCM authentication and bound additional authenticated data detect ciphertext/key-row swaps while the key still exists.
3. **PII key wrapping:** use standard Node cryptography only. Generate one random 256-bit data key per user, encrypt the snapshot with AES-256-GCM, and wrap that data key with a distinct environment-held 256-bit `CONSENT_PII_KEK` using AES-256-GCM. Database backups therefore contain ciphertext and wrapped keys, never a plaintext data key or the wrapping key. Erasure deletes the per-user wrapped-key row before appending the signed tombstone.
4. **Terms payload:** `terms_versions` stores the validated schema-v1 structured Swedish payload and canonical SHA-256. The publisher consumes an external JSON manifest with stable card IDs `content_usage`, `bystander_consent`, and `user_control` in that order; every card requires exact `title`, `body`, and non-empty `legalTextMarkdown`. `consent-cards.md` supplies approved card copy but not the claimed legal bodies, so Story 3.1 must not create a production `1.0.0` seed. Production publication remains an operational input once Legal supplies the complete manifest; tests use synthetic fixtures.

## Verification

**Commands:**
- `npm run typecheck` -- expected: TypeScript passes.
- `npm run lint` -- expected: boundary and quality rules pass.
- `npm test` -- expected: unit and integration tests pass.
- `supabase db reset` -- expected: migration applies, seed is valid, and scheduled database objects exist in the local stack.
