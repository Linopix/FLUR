import { berlinParts, formatMinutes } from "./time.ts";
import type { DayBoard, Lesson } from "./types.ts";

/** Minuten zwischen Klassenraum und Halt, hin wie zurück. */
export const SCHOOL_BUFFER_MIN = 8;

export type TimedLeg = {
  mode?: string;
  cancelled?: boolean;
  from?: { cancelled?: boolean; departure?: string; scheduledDeparture?: string };
  to?: { cancelled?: boolean; arrival?: string; scheduledArrival?: string };
};

export type TimedItinerary = {
  startTime?: string;
  endTime?: string;
  legs?: TimedLeg[];
};

export type OutboundAim = {
  arriveBy: string;
  classStart: string;
  focus: string;
};

export type ReturnAim = {
  departAt: string;
  classEnd: string;
  focus: string;
};

function openLessons(day: DayBoard): Lesson[] {
  return day.lessons
    .filter((lesson) => lesson.status !== "cancelled")
    .slice()
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
}

export function atBerlinMinutes(iso: string, minutes: number, now: Date): Date {
  const today = berlinParts(now).iso;
  const from = Date.parse(`${today}T00:00:00Z`);
  const to = Date.parse(`${iso}T00:00:00Z`);
  const dayDelta = Number.isFinite(from) && Number.isFinite(to) ? Math.round((to - from) / 86_400_000) : 0;
  const shifted = new Date(now.getTime() + dayDelta * 86_400_000);
  const clockDelta = minutes - berlinParts(shifted).minutes;
  return new Date(shifted.getTime() + clockDelta * 60_000);
}

function focusLabel(lesson: Lesson, end: boolean): string {
  const clock = formatMinutes(end ? lesson.endMin : lesson.startMin);
  const subject = lesson.subject || "Unterricht";
  return end ? `${subject} bis ${clock}` : `${subject} ${clock}`;
}

/** Erste nicht ausgefallene Stunde, die noch nicht vorbei ist. Sonst morgen. */
export function outboundAim(today: DayBoard, tomorrow: DayBoard, now: Date): OutboundAim | null {
  const todayIso = berlinParts(now).iso;
  const days = today.iso === todayIso ? [today, tomorrow] : [tomorrow];
  for (const day of days) {
    const first = openLessons(day)[0];
    if (!first || !day.iso) continue;
    const classStart = atBerlinMinutes(day.iso, first.startMin, now);
    if (classStart.getTime() < now.getTime() - 10 * 60_000) continue;
    const arriveBy = new Date(classStart.getTime() - SCHOOL_BUFFER_MIN * 60_000);
    return {
      arriveBy: arriveBy.toISOString(),
      classStart: classStart.toISOString(),
      focus: focusLabel(first, false),
    };
  }
  return null;
}

/**
 * Zeitpunkt, zu dem man realistisch am Schulhalt steht:
 * Stundenende plus Weg aus dem Schulhaus. Liegt das hinter uns, ab jetzt.
 * Ist der Schultag seit zwei Stunden vorbei, gilt morgen.
 */
export function returnAim(today: DayBoard, tomorrow: DayBoard, now: Date): ReturnAim {
  const todayIso = berlinParts(now).iso;
  let day: DayBoard | null = today.iso === todayIso ? today : null;
  let last = day ? openLessons(day).at(-1) : undefined;
  if (last && day?.iso) {
    const end = atBerlinMinutes(day.iso, last.endMin, now);
    if (end.getTime() < now.getTime() - 2 * 60 * 60_000) {
      day = tomorrow.iso ? tomorrow : null;
      last = day ? openLessons(day).at(-1) : undefined;
    }
  } else if (tomorrow.iso) {
    day = tomorrow;
    last = openLessons(tomorrow).at(-1);
  }
  if (!last || !day?.iso) {
    return { departAt: now.toISOString(), classEnd: "", focus: "" };
  }
  const classEnd = atBerlinMinutes(day.iso, last.endMin, now);
  const atStop = new Date(classEnd.getTime() + SCHOOL_BUFFER_MIN * 60_000);
  const focus = focusLabel(last, true);
  if (atStop.getTime() <= now.getTime()) {
    return { departAt: now.toISOString(), classEnd: "", focus };
  }
  return { departAt: atStop.toISOString(), classEnd: classEnd.toISOString(), focus };
}

export function transitLegs(itinerary: TimedItinerary): TimedLeg[] {
  return (itinerary.legs ?? []).filter((leg) => leg.mode && leg.mode !== "WALK");
}

export function legIsCancelled(leg: TimedLeg): boolean {
  return Boolean(leg.cancelled || leg.from?.cancelled || leg.to?.cancelled);
}

function stamp(value?: string): number {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/** Späteste Abfahrt, die noch vor der Deadline ankommt und erreichbar ist. */
export function pickTightest<T extends TimedItinerary>(
  rows: T[],
  latestArrivalMs: number,
  earliestStartMs: number,
): T | null {
  const usable = rows.filter((row) => {
    const start = stamp(row.startTime);
    const end = stamp(row.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    if (end > latestArrivalMs + 60_000) return false;
    if (start < earliestStartMs - 30_000) return false;
    const legs = transitLegs(row);
    return legs.length > 0 && !legs.some(legIsCancelled);
  });
  usable.sort((a, b) => stamp(b.startTime) - stamp(a.startTime));
  return usable[0] ?? null;
}

/** Früheste Verbindung ab einem Zeitpunkt. Verspätung ist in Ordnung, Ausfall nicht. */
export function pickEarliest<T extends TimedItinerary>(rows: T[], earliestStartMs: number): T | null {
  const usable = rows.filter((row) => {
    const start = stamp(row.startTime);
    if (!Number.isFinite(start) || start < earliestStartMs - 30_000) return false;
    const legs = transitLegs(row);
    return legs.length > 0 && !legs.some(legIsCancelled);
  });
  usable.sort((a, b) => stamp(a.startTime) - stamp(b.startTime));
  return usable[0] ?? null;
}
