import { notFound } from "next/navigation";
import { AdminShell } from "@/components/layout/admin-shell";
import { AmbassadorDetail } from "@/features/ambassadors/components/detail";
import { getProfileForAdmin } from "@/features/ambassadors/dal/admin";
import { DomainError } from "@/lib/errors";
import Link from "next/link";
import { ambassadorCopy } from "@/features/ambassadors/copy";
export default async function AmbassadorPage({ params }: { params: Promise<{ profileId: string }> }) { const { profileId } = await params; const rail = <nav aria-label={ambassadorCopy.navigationLabel}><Link className="inline-flex min-h-11 items-center p-3 text-[#3344dd] underline focus-visible:outline-2" href="/admin/ambassadors">{ambassadorCopy.rosterLink}</Link></nav>; let profile; try { profile = await getProfileForAdmin(profileId); } catch (error) { if (error instanceof DomainError && error.code === "NOT_FOUND") notFound(); throw error; } return <AdminShell rail={rail}><AmbassadorDetail profile={profile} /></AdminShell>; }
