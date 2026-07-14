CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" uuid,
	"actor_name_snapshot" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_snapshot" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_event_type_check" CHECK ("audit_events"."event_type" in ('asset.uploaded', 'asset.deleted', 'asset.erased', 'export.created', 'asset.shared', 'asset.used_confirmed', 'auth.logged_in', 'account.invited', 'account.deactivated', 'account.reactivated', 'account.deleted', 'consent.accepted', 'consent.declined', 'consent.withdrawn', 'terms.version_created', 'task.created', 'task.completed', 'message.sent'))
);

CREATE INDEX "idx_audit_events_occurred_at" ON "audit_events" USING btree ("occurred_at");

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.audit_events FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_events FROM service_role;
GRANT SELECT, INSERT ON TABLE public.audit_events TO service_role;

CREATE OR REPLACE FUNCTION public.reject_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND current_user = 'postgres'
    AND current_setting('audit.retention_job', true) = 'on'
  THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'audit_events rows are immutable'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.reject_audit_event_mutation() FROM PUBLIC;

CREATE TRIGGER audit_events_immutable
BEFORE UPDATE OR DELETE ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION public.reject_audit_event_mutation();

CREATE OR REPLACE FUNCTION public.set_audit_event_occurred_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user = 'postgres'
    AND current_setting('audit.retention_fixture', true) = 'on'
  THEN
    RETURN NEW;
  END IF;

  NEW.occurred_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_audit_event_occurred_at() FROM PUBLIC;

CREATE TRIGGER audit_events_force_occurred_at
BEFORE INSERT ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION public.set_audit_event_occurred_at();

CREATE OR REPLACE FUNCTION public.expire_audit_events()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  PERFORM set_config('audit.retention_job', 'on', true);
  DELETE FROM public.audit_events
  WHERE occurred_at < now() - interval '6 months';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  PERFORM set_config('audit.retention_job', 'off', true);
  RETURN deleted_count;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('audit.retention_job', 'off', true);
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_audit_events() FROM PUBLIC, anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'expire-audit-events';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'expire-audit-events',
    '17 2 * * *',
    'select public.expire_audit_events()'
  );
END;
$$;
