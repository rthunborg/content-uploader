import type { ReactNode } from "react";

export function AmbassadorShell({ children, primaryAction }: { children: ReactNode; primaryAction: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-4">
      <div className="flex-1 pb-6">{children}</div>
      <div className="sticky bottom-0 mt-auto border-t border-surface-media bg-surface pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] [&>*]:w-full">{primaryAction}</div>
    </main>
  );
}
