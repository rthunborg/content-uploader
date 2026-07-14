import { CircleAlert } from "lucide-react";
import { type ReactNode, useId } from "react";

import { cn } from "@/lib/utils";

type SoftErrorProps = {
  what: string;
  why: string;
  remedy: ReactNode;
  className?: string;
};

export function SoftError({ what, why, remedy, className }: SoftErrorProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={cn("rounded-lg border-2 border-destructive bg-caution-bg p-4 text-surface-media", className)} role="alert">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-destructive" />
        <div>
          <h2 className="text-base font-semibold" id={titleId}>{what}</h2>
          <p className="mt-1">{why}</p>
          <div className="mt-3">{remedy}</div>
        </div>
      </div>
    </section>
  );
}
