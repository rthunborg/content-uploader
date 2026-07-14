import { CircleCheck, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type AmbientStatusProps = { children: string; className?: string; tone?: "progress" | "celebration" };

export function AmbientStatus({ children, className, tone = "progress" }: AmbientStatusProps) {
  const Icon = tone === "celebration" ? CircleCheck : Info;
  return (
    <p aria-live="polite" className={cn("flex items-center gap-2 rounded-md bg-info p-3 text-surface-media", className)} role="status">
      <Icon aria-hidden="true" className="shrink-0 text-action-primary" />
      <span>{children}</span>
    </p>
  );
}
