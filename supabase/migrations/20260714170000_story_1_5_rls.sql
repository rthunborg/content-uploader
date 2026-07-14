-- Story 1.5 baseline policies. Future schemas add their own ownership policies atomically.
GRANT SELECT ON TABLE profiles, assets, themes, asset_themes, campaigns, asset_campaigns TO authenticated;
GRANT ALL ON TABLE profiles, assets, themes, asset_themes, campaigns, asset_campaigns TO service_role;

CREATE POLICY profiles_read_own ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_admin_read ON profiles FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean IS TRUE);

CREATE POLICY themes_authenticated_read ON themes FOR SELECT TO authenticated USING (true);
CREATE POLICY campaigns_authenticated_read ON campaigns FOR SELECT TO authenticated USING (true);

CREATE POLICY assets_admin_read ON assets FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean IS TRUE);
CREATE POLICY asset_themes_admin_read ON asset_themes FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean IS TRUE);
CREATE POLICY asset_campaigns_admin_read ON asset_campaigns FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean IS TRUE);

-- All writes remain denied to anon/authenticated at this baseline: service_role bypasses RLS.
