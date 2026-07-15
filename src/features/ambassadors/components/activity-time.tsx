import { ambassadorCopy } from "../copy";
import { formatStockholmDateTime, stockholmCalendarDaysAgo } from "@/shared/datetime";

export function ActivityTime({ value, now }: { value: string | null; now?: Date }) {
  if (!value) return <span>{ambassadorCopy.never}</span>;
  const instant = new Date(value);
  const reference = now ?? new Date();
  const days = stockholmCalendarDaysAgo(value, now);
  const relative = instant.getTime() > reference.getTime() ? ambassadorCopy.future : days === 0 ? ambassadorCopy.today : days === 1 ? ambassadorCopy.yesterday : ambassadorCopy.daysAgo(days);
  return <span className="grid gap-0.5"><span>{relative}</span><time className="text-sm" dateTime={value}>{formatStockholmDateTime(value)}</time></span>;
}
