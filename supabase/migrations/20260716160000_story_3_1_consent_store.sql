create table public.terms_versions (
  id uuid primary key default gen_random_uuid(), version text not null, locale text not null,
  schema_version integer not null check (schema_version = 1), payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  published_at timestamptz not null default now(), unique (version, locale)
);
create index idx_terms_versions_current on public.terms_versions (locale, published_at desc, id desc);

create table public.consent_pii_keys (
  user_id uuid primary key, wrapped_key_ciphertext text not null, wrapped_key_nonce text not null,
  wrapped_key_tag text not null, created_at timestamptz not null default now()
);
create table public.acceptance_records (
  id uuid primary key default gen_random_uuid(), record_type text not null check (record_type in ('acceptance','erasure_tombstone')),
  user_id_snapshot uuid not null, terms_version_id uuid references public.terms_versions(id), terms_payload_sha256 text,
  identity_ciphertext text, identity_nonce text, identity_tag text, occurred_at timestamptz not null default now(),
  chain_position bigint not null unique check (chain_position > 0), prev_hmac text not null check (prev_hmac ~ '^[0-9a-f]{64}$'),
  hmac text not null check (hmac ~ '^[0-9a-f]{64}$'),
  constraint acceptance_records_shape_check check (
    (record_type = 'acceptance' and terms_version_id is not null and terms_payload_sha256 ~ '^[0-9a-f]{64}$' and identity_ciphertext is not null and identity_nonce is not null and identity_tag is not null)
    or (record_type = 'erasure_tombstone' and terms_version_id is null and terms_payload_sha256 is null and identity_ciphertext is null and identity_nonce is null and identity_tag is null)
  )
);
create index idx_acceptance_records_user_terms on public.acceptance_records(user_id_snapshot, terms_version_id);
create unique index idx_acceptance_records_one_tombstone on public.acceptance_records(user_id_snapshot) where record_type = 'erasure_tombstone';
create table public.acceptance_chain_head (
  singleton integer primary key default 1 check (singleton = 1), chain_position bigint not null default 0,
  head_hmac text not null check (head_hmac ~ '^[0-9a-f]{64}$'), signature text not null check (signature ~ '^[0-9a-f]{64}$')
);
insert into public.acceptance_chain_head(singleton, chain_position, head_hmac, signature) values (1, 0, repeat('0',64), repeat('0',64));

create function public.reject_acceptance_mutation() returns trigger language plpgsql as $$ begin raise exception 'acceptance_records are append-only' using errcode = '55000'; end $$;
-- Cover truncate too: revoke does not bind the table owner, and the app connects
-- through DATABASE_URL, so the owner-effective trigger is what actually keeps the
-- ledger append-only. Without `or truncate` an owner could silently wipe it.
create trigger acceptance_records_immutable before update or delete or truncate on public.acceptance_records for each statement execute function public.reject_acceptance_mutation();
create function public.reject_terms_mutation() returns trigger language plpgsql as $$ begin raise exception 'terms_versions are immutable' using errcode = '55000'; end $$;
create trigger terms_versions_immutable before update or delete or truncate on public.terms_versions for each statement execute function public.reject_terms_mutation();

alter table public.terms_versions enable row level security;
alter table public.consent_pii_keys enable row level security;
alter table public.acceptance_records enable row level security;
alter table public.acceptance_chain_head enable row level security;
revoke all on public.terms_versions, public.consent_pii_keys, public.acceptance_records, public.acceptance_chain_head from anon, authenticated;
revoke update, delete, truncate on public.acceptance_records from public, anon, authenticated, service_role;
grant select, insert on public.acceptance_records to service_role;
grant select, insert on public.terms_versions to service_role;
grant select, insert, update, delete on public.consent_pii_keys to service_role;
grant select, update on public.acceptance_chain_head to service_role;

create schema if not exists pgmq;
create extension if not exists pgmq with schema pgmq cascade;
select pgmq.create('maintenance_jobs');

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('verify-acceptance-chain', '17 2 * * *', $job$select pgmq.send('maintenance_jobs', '{"v":1,"name":"verify-acceptance-chain"}'::jsonb)$job$);
  end if;
end $$;
