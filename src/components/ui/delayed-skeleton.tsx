"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export const SKELETON_DELAY_MS = 200;

export function scheduleSkeleton(show: () => void, delay = SKELETON_DELAY_MS) {
  const timer = globalThis.setTimeout(show, delay);
  return () => globalThis.clearTimeout(timer);
}

type DelayedSkeletonProps = { className?: string; delay?: number; lines?: number };

export function DelayedSkeleton({ className, delay = SKELETON_DELAY_MS, lines = 3 }: DelayedSkeletonProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => scheduleSkeleton(() => setVisible(true), delay), [delay]);
  if (!visible) return null;
  return (
    <div aria-hidden="true" className={cn("grid animate-pulse gap-3 motion-reduce:animate-none", className)} data-testid="delayed-skeleton">
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <span className="block h-4 rounded bg-info last:w-2/3" key={index} />
      ))}
    </div>
  );
}
