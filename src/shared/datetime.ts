const STOCKHOLM_TIME_ZONE = "Europe/Stockholm";

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: STOCKHOLM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: STOCKHOLM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type DateInput = Date | number | string;

function normalizeDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date value");
  }
  return date;
}

export function formatStockholmDate(value: DateInput): string {
  return dateFormatter.format(normalizeDate(value));
}

export function formatStockholmDateTime(value: DateInput): string {
  return dateTimeFormatter.format(normalizeDate(value)).replace(",", "");
}

function stockholmDayKey(value: DateInput): number {
  const parts = dateFormatter.formatToParts(normalizeDate(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)!.value);
  return Math.floor(Date.UTC(part("year"), part("month") - 1, part("day")) / 86_400_000);
}
export function stockholmCalendarDaysAgo(value: DateInput, now: DateInput = Date.now()): number {
  return Math.max(0, stockholmDayKey(now) - stockholmDayKey(value));
}
