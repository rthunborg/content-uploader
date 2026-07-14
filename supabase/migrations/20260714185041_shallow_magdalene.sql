ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at
  ON public.audit_events USING btree (occurred_at);

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
DROP TRIGGER IF EXISTS audit_events_force_occurred_at ON public.audit_events;
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
