# Infrastructure verification

Run this checklist before any production data is stored and attach provider-dashboard screenshots or exported metadata to the deployment record. Never paste keys, passwords, connection strings or `.env.local` values into evidence.

## Hard region gate: Supabase

- Project reference: `utohxfcfjmhypejrawmy`
- Required region: Stockholm, `eu-north-1`
- Authoritative check: `supabase projects list --profile content-uploader --output json`, Supabase Dashboard → Project settings → Infrastructure → Region, or an authenticated Supabase Management API `GET /v1/projects/utohxfcfjmhypejrawmy` response.
- Expected evidence: project reference and `region: eu-north-1` visible together; redact organization and billing details.
- Gate behavior: if the reported region differs, or cannot be read authoritatively, stop. Do not create or recreate a billable project unattended and do not store production data.

Verified on 2026-07-14 with the authenticated Supabase CLI profile `content-uploader`: project `utohxfcfjmhypejrawmy` reported `status: ACTIVE_HEALTHY` and `region: eu-north-1`. The earlier Ireland project `lupjrbrqgacgmcbuzdsc` is superseded and must not be used.

### Authentication expiry gate

- In Supabase Dashboard, open Authentication → Sign In / Providers → Email and record the displayed magic-link/OTP expiry for project `utohxfcfjmhypejrawmy`.
- If the Management API exposes the auth configuration, export the authenticated response to the private deployment record and retain only the project reference and expiry field in review evidence.
- Required value: 900 seconds (15 minutes). If it differs or cannot be authoritatively verified, stop the production launch and correct/verify it before sending authentication links.
- Do not record SMTP credentials, API tokens, signing secrets, or complete provider responses in this repository.
- In Authentication → URL Configuration, set the production site URL and allow every deployed portal origin that may appear in `emailRedirectTo`; links must converge on `/auth/confirm`.
- In Authentication → SMTP Settings, enable custom SMTP with the production Brevo SMTP account. Keep credentials in the provider dashboard only.
- Repository `supabase/config.toml` configures the local stack; it does not apply these hosted dashboard values.

## Vercel app

- Source evidence: `vercel.json` contains `"regions": ["arn1"]`.
- Build check: run `npx vercel@latest build`; retain the successful build log.
- Dashboard check: Project → Settings → Functions must report Stockholm (`arn1`) for production functions.
- HTTP check after deployment: `curl -I https://<deployment>/auth/login` must include `X-Robots-Tag: noindex, nofollow`.

## Railway worker

- Deploy the image built from `worker/Dockerfile` to Railway EU West.
- Dashboard check: Service → Settings → Deploy → Region must report Amsterdam.
- Runtime check: Railway's `RAILWAY_REPLICA_REGION` platform value in the structured `worker.ready` log must match the Amsterdam deployment selected in the dashboard.
- Image check: `docker build -t stena-content-worker:story-1-1 worker && docker run --rm stena-content-worker:story-1-1 --versions` must report Node major 22 and ffmpeg 8.1.2.

## Processor placement record

Compare the authoritative provider evidence with `docs/processor-inventory.md`: Supabase Stockholm, Vercel Stockholm, Railway Amsterdam, Brevo EU and 46elks EU. Any mismatch is a deployment blocker. Sentry must remain deferred and absent from the MVP dependency and environment configuration.

### Brevo EU evidence

- From the authenticated Brevo account, export or screenshot the contractual/account data-location setting and the applicable DPA/subprocessor documentation showing EU account/data processing placement.
- Record the Brevo account identifier, evidence date, document/version, and displayed region in the private deployment record; redact contacts, message data, API keys, SMTP credentials, and billing details.
- Do not mark Brevo verified from marketing copy alone. A missing or non-EU authoritative account/contract record blocks production email activation.

### 46elks EU evidence

- From the authenticated 46elks account and current contractual privacy/DPA material, retain evidence of the legal entity, processing locations, and any subprocessors used for the production account.
- Record the account identifier, evidence date, document/version, and EU processing conclusion in the private deployment record; redact telephone numbers, message bodies, credentials, and billing details.
- Do not infer placement from the provider name or public website alone. Missing authoritative EU processing/account evidence blocks production SMS activation.
