import type { ReactNode } from "react";

type AdminShellProps = { children: ReactNode; rail?: ReactNode; bulkActions?: ReactNode };

export function AdminShell({ children, rail, bulkActions }: AdminShellProps) {
  return (
    <main className={rail ? "mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-6 px-4 py-4 md:grid-cols-[256px_minmax(0,1fr)] md:px-6" : "mx-auto grid w-full max-w-[1440px] grid-cols-1 px-4 py-4 md:px-6"}>
      {rail ? <aside className="hidden w-64 md:block">{rail}</aside> : null}
      <section className="grid min-w-0 grid-cols-12">
        <div className="col-span-12 min-w-0">
        {bulkActions ? <div className="mb-4 hidden md:block" data-bulk-actions>{bulkActions}</div> : null}
        {children}
        </div>
      </section>
    </main>
  );
}
