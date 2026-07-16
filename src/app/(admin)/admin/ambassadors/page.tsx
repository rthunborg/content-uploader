import Link from "next/link";
import { AdminShell } from "@/components/layout/admin-shell";
import { ambassadorCopy } from "@/features/ambassadors/copy";
import { AmbassadorRoster } from "@/features/ambassadors/components/roster";
import { InviteForm } from "@/features/ambassadors/components/invite-form";
import { listAmbassadors, type AmbassadorPage } from "@/features/ambassadors/dal/admin";
import { DomainError } from "@/lib/errors";

const recoveryLink = "mt-4 inline-flex min-h-11 items-center rounded px-3 text-[#3344dd] underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3344dd]";
const rail = <nav aria-label={ambassadorCopy.navigationLabel}><Link className={recoveryLink} href="/admin/ambassadors">{ambassadorCopy.rosterLink}</Link></nav>;
export function RosterPageContent({ page, cursor }: { page: AmbassadorPage; cursor?: string }) {
  if (cursor && page.items.length === 0) return <><h1 className="text-2xl font-semibold">{ambassadorCopy.heading}</h1><p className="mt-4">{ambassadorCopy.stalePage}</p><Link className={recoveryLink} href="/admin/ambassadors">{ambassadorCopy.backToRoster}</Link></>;
  return <><h1 className="mb-6 text-2xl font-semibold">{ambassadorCopy.heading}</h1><InviteForm /><AmbassadorRoster page={page} /></>;
}
export default async function AmbassadorsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  let page: AmbassadorPage;
  try { page = await listAmbassadors(cursor); }
  catch (error) { if (error instanceof DomainError && error.code === "VALIDATION_FAILED") return <AdminShell rail={rail}><h1 className="text-2xl font-semibold">{ambassadorCopy.heading}</h1><p className="mt-4">{ambassadorCopy.invalidPage}</p><Link className={recoveryLink} href="/admin/ambassadors">{ambassadorCopy.backToRoster}</Link></AdminShell>; throw error; }
  return <AdminShell rail={rail}><RosterPageContent page={page} cursor={cursor} /></AdminShell>;
}
