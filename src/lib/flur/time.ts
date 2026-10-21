export function berlinParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  const minute = Number(get("minute"));
  const year = get("year");
  const month = get("month");
  const day = get("day");
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour,
    minute,
    minutes: hour * 60 + minute,
    iso: `${year}-${month}-${day}`,
    ymd: Number(`${year}${month}${day}`),
  };
}

export function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dateFromIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 10, 0, 0));
}

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dateFromIso(iso));
}

export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "–";
  return formatClock(date);
}

export function formatMinutes(min: number): string {
  const normalized = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function delayMinutes(scheduled?: string, actual?: string): number {
  if (!scheduled || !actual) return 0;
  const delta = Date.parse(actual) - Date.parse(scheduled);
  if (!Number.isFinite(delta)) return 0;
  return Math.round(delta / 60_000);
}

export function ymdToIso(ymd: number): string {
  const text = String(ymd);
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

export function untisTimeToMinutes(value: number): number {
  const hour = Math.floor(value / 100);
  const minute = value % 100;
  return hour * 60 + minute;
}
