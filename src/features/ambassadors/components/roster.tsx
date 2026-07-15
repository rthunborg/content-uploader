import Link from "next/link";
import type { AmbassadorPage } from "../dal/admin";
import { accountStateCopy, ambassadorCopy, displayOptional } from "../copy";
import { ActivityTime } from "./activity-time";

const linkClass = "rounded text-[#3344dd] underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3344dd]";
export function AmbassadorRoster({ page }: { page: AmbassadorPage }) {
  if (!page.items.length) return <section className="rounded bg-[#eae3d2] p-6"><h2 className="text-xl font-semibold">{ambassadorCopy.emptyHeading}</h2><p className="mt-2">{ambassadorCopy.emptyBody}</p></section>;
  return <>
    <div className="hidden overflow-hidden rounded border border-black xl:block"><table className="w-full border-collapse text-left"><thead className="bg-[#eae3d2]"><tr>{[ambassadorCopy.name, ambassadorCopy.email, ambassadorCopy.mobile, ambassadorCopy.state, ambassadorCopy.activity].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{page.items.map((item) => <tr className="border-t border-black" key={item.id}><td className="p-3"><Link className={linkClass} href={`/admin/ambassadors/${item.id}`}>{displayOptional(item.fullName) ?? ambassadorCopy.missingName}</Link></td><td className="p-3">{item.email}</td><td className="p-3">{displayOptional(item.mobile) ?? ambassadorCopy.missingValue}</td><td className="p-3">{accountStateCopy[item.accountState]}</td><td className="p-3"><ActivityTime value={item.lastLoginAt} /></td></tr>)}</tbody></table></div>
    <ul className="grid list-none gap-4 p-0 xl:hidden">{page.items.map((item) => <li className="rounded border border-black bg-[#eae3d2] p-4" key={item.id}><h2 className="text-lg font-semibold"><Link className={`${linkClass} inline-flex min-h-11 items-center`} href={`/admin/ambassadors/${item.id}`}>{displayOptional(item.fullName) ?? ambassadorCopy.missingName}</Link></h2><dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-2"><dt className="font-semibold">{ambassadorCopy.email}</dt><dd className="break-all">{item.email}</dd><dt className="font-semibold">{ambassadorCopy.mobile}</dt><dd>{displayOptional(item.mobile) ?? ambassadorCopy.missingValue}</dd><dt className="font-semibold">{ambassadorCopy.state}</dt><dd>{accountStateCopy[item.accountState]}</dd><dt className="font-semibold">{ambassadorCopy.activity}</dt><dd><ActivityTime value={item.lastLoginAt} /></dd></dl></li>)}</ul>
    {page.nextCursor ? <Link className={`mt-6 inline-flex min-h-11 items-center px-3 ${linkClass}`} href={`/admin/ambassadors?cursor=${page.nextCursor}`}>{ambassadorCopy.nextPage}</Link> : null}
  </>;
}
