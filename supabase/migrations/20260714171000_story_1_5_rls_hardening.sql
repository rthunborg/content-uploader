DROP POLICY IF EXISTS profiles_read_own ON profiles;
DROP POLICY IF EXISTS profiles_admin_read ON profiles;
DROP POLICY IF EXISTS themes_authenticated_read ON themes;
DROP POLICY IF EXISTS campaigns_authenticated_read ON campaigns;
DROP POLICY IF EXISTS assets_admin_read ON assets;
DROP POLICY IF EXISTS asset_themes_admin_read ON asset_themes;
DROP POLICY IF EXISTS asset_campaigns_admin_read ON asset_campaigns;

CREATE OR REPLACE FUNCTION public.is_active_actor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_state = 'active') $$;
REVOKE ALL ON FUNCTION public.is_active_actor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_actor() TO authenticated;

CREATE POLICY profiles_read_active_own ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() AND account_state = 'active');
CREATE POLICY profiles_active_admin_read ON profiles FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'admin') = 'true'
    AND public.is_active_actor()
  );

CREATE POLICY themes_active_read ON themes FOR SELECT TO authenticated USING (
  public.is_active_actor()
);
CREATE POLICY campaigns_active_read ON campaigns FOR SELECT TO authenticated USING (
  public.is_active_actor()
);

CREATE POLICY assets_active_admin_read ON assets FOR SELECT TO authenticated USING (
  (auth.jwt() -> 'app_metadata' ->> 'admin') = 'true'
  AND public.is_active_actor()
);
CREATE POLICY asset_themes_active_admin_read ON asset_themes FOR SELECT TO authenticated USING (
  (auth.jwt() -> 'app_metadata' ->> 'admin') = 'true'
  AND public.is_active_actor()
);
CREATE POLICY asset_campaigns_active_admin_read ON asset_campaigns FOR SELECT TO authenticated USING (
  (auth.jwt() -> 'app_metadata' ->> 'admin') = 'true'
  AND public.is_active_actor()
);
