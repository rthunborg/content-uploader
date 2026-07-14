import { createClient } from "@supabase/supabase-js";

export async function provisionAdmin(email: string, client = createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")) {
  let page = 1;
  let user;
  // Terminate on an empty page rather than a short page: GoTrue may cap perPage below
  // the requested size, so a full-but-short page is not a reliable end-of-list signal.
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user || data.users.length === 0) break;
    page += 1;
  }
  if (!user) throw new Error(`No auth user found for ${email}`);
  if (user.app_metadata?.admin !== true) {
    const appMetadata = { ...user.app_metadata, admin: true };
    const { error: updateError } = await client.auth.admin.updateUserById(user.id, { app_metadata: appMetadata });
    if (updateError) throw updateError;
  }
  const { error: profileError } = await client.from("profiles").upsert(
    { id: user.id, email: user.email ?? email, account_state: "active" },
    { onConflict: "id" },
  );
  if (profileError) throw profileError;
  return user.id;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: npm run create-admin -- user@example.com");
  await provisionAdmin(email);
}
