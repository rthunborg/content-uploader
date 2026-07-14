import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import { profiles } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";

export type AmbassadorProfile = { id: string; email: string; mobile: string | null; accountState: string };

export async function getOwnProfile(): Promise<AmbassadorProfile> {
  const context = await requireUser();
  const [row] = await getDatabase().select({ id: profiles.id, email: profiles.email, mobile: profiles.mobile, accountState: profiles.accountState }).from(profiles).where(eq(profiles.id, context.userId)).limit(1);
  if (!row) throw new DomainError("NOT_FOUND", "Profilen kunde inte hittas.");
  return row;
}
