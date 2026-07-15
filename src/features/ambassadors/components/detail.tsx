import Link from "next/link";
import type { AdminProfile } from "../dal/admin";
import { accountStateCopy, ambassadorCopy, displayOptional } from "../copy";
import { ActivityTime } from "./activity-time";

export function AmbassadorDetail({ profile }: { profile: AdminProfile }) {
  const rows = [[ambassadorCopy.email, profile.email], [ambassadorCopy.mobile, displayOptional(profile.mobile) ?? ambassadorCopy.missingValue], [ambassadorCopy.state, accountStateCopy[profile.accountState]]] as const;
  return <><Link className="inline-flex min-h-11 items-center text-[#3344dd] underline focus-visible:outline-2" href="/admin/ambassadors">{ambassadorCopy.backToRoster}</Link><article className="mt-4 rounded border border-black bg-[#eae3d2] p-6"><h1 className="text-2xl font-semibold">{displayOptional(profile.fullName) ?? ambassadorCopy.missingName}</h1><dl className="mt-4 grid gap-4">{rows.map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd>{value}</dd></div>)}<div><dt className="font-semibold">{ambassadorCopy.activity}</dt><dd><ActivityTime value={profile.lastLoginAt} /></dd></div></dl></article></>;
}
