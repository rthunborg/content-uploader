ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_id_auth_users_id_fk;

COMMENT ON COLUMN public.profiles.id IS
  'Supabase Auth user identifier. Deliberately has no FK so Auth deletion can precede transactional profile deletion and account.deleted audit emission.';

CREATE FUNCTION public.enforce_profile_auth_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'profile requires a matching auth user'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_profile_auth_identity() FROM PUBLIC;

CREATE TRIGGER profiles_require_auth_identity
BEFORE INSERT OR UPDATE OF id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_auth_identity();
