import Link from "next/link";
import { isValidElement, type ReactNode } from "react";
import { ambassadorCopy } from "@/features/ambassadors/copy";

type AdminShellProps = { children: ReactNode; rail?: ReactNode; bulkActions?: ReactNode };
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3344dd]";

export function AdminShell({ children, rail, bulkActions }: AdminShellProps) {
  const hasRail = rail !== undefined;
  const defaultRail = <Link className={`block rounded p-3 ${focus}`} href="/admin/ambassadors">{ambassadorCopy.rosterLink}</Link>;
  const railContent = rail ?? defaultRail;
  const semanticRail = isValidElement(railContent) && railContent.type === "nav" ? railContent : <nav aria-label={ambassadorCopy.navigationLabel}>{railContent}</nav>;
  return <>
    <header className="border-b border-black bg-white"><div className="mx-auto flex min-h-16 max-w-[1440px] items-center px-4 font-semibold md:px-6">{ambassadorCopy.brand}</div></header>
    <nav aria-label={ambassadorCopy.mobileNavigationLabel} className="border-b border-black p-2 md:hidden"><Link className={`flex min-h-11 items-center rounded px-2 ${focus}`} href="/admin/ambassadors">{ambassadorCopy.rosterLink}</Link></nav>
    <main className={hasRail ? "mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[256px_minmax(0,1fr)] md:px-6" : "mx-auto grid w-full max-w-[1440px] grid-cols-1 px-4 py-4 md:px-6"}>
      {hasRail ? <aside className="hidden w-64 md:block">{semanticRail}</aside> : null}
      <section className="grid min-w-0 grid-cols-12"><div className="col-span-12 min-w-0">{bulkActions ? <div className="mb-4 hidden md:block" data-bulk-actions>{bulkActions}</div> : null}{children}</div></section>
    </main>
  </>;
}
