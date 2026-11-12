import { DEMO_LESSONS } from "./demo.ts";
import { addDaysIso, berlinParts, formatMinutes, untisTimeToMinutes, ymdToIso } from "./time.ts";
import type { Lesson } from "./types.ts";

export type ExamItem = {
  id: string;
  iso: string;
  startMin: number;
  endMin: number;
  name: string;
  subject: string;
  teachers: string;
  rooms: string;
  text: string;
};

export type HomeworkItem = {
  id: string;
  dueIso: string;
  subject: string;
  text: string;
  teacher: string;
  remark: string;
  done: boolean;
};

export type AbsenceItem = {
  id: string;
  iso: string;
  startMin: number;
  endMin: number;
  subject: string;
  status: string;
  text: string;
};

export type HolidayItem = {
  id: string;
  name: string;
  startIso: string;
  endIso: string;
};

export type NoticeItem = {
  id: string;
  iso: string;
  title: string;
  body: string;
};

export type ChangeItem = {
  id: string;
  iso: string;
  startMin: number;
  endMin: number;
  subject: string;
  kind: "cancelled" | "substitution";
  text: string;
  teacher: string;
  room: string;
  classes: string;
};

export type DeskDay = {
  iso: string;
  lessons: Lesson[];
};

export type DeskNotes = {
  exams: string;
  homework: string;
  absences: string;
  holidays: string;
  notices: string;
};

export type DeskData = {
  source: "live" | "demo";
  fetchedAt: string;
  days: DeskDay[];
  exams: ExamItem[];
  homework: HomeworkItem[];
  absences: AbsenceItem[];
  holidays: HolidayItem[];
  notices: NoticeItem[];
  changes: ChangeItem[];
  notes: DeskNotes;
};

export type DeskResult = { ok: true; desk: DeskData } | { ok: false; error: string };

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

export function emptyNotes(): DeskNotes {
  return { exams: "", homework: "", absences: "", holidays: "", notices: "" };
}

export function weekdayIndex(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1)).getUTCDay();
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS[weekdayIndex(iso)] ?? "";
}

export function daysBetween(fromIso: string, toIso: string): number {
  const [fromYear, fromMonth, fromDay] = fromIso.split("-").map(Number);
  const [toYear, toMonth, toDay] = toIso.split("-").map(Number);
  const from = Date.UTC(fromYear || 1970, (fromMonth || 1) - 1, fromDay || 1);
  const to = Date.UTC(toYear || 1970, (toMonth || 1) - 1, toDay || 1);
  return Math.round((to - from) / 86_400_000);
}

/** First day on or after `fromIso` that still has a lesson. */
export function nextOpenDay(days: DeskDay[], fromIso: string): DeskDay | null {
  for (const day of days) {
    if (fromIso && day.iso < fromIso) continue;
    if (day.lessons.some((lesson) => lesson.status !== "cancelled")) return day;
  }
  return null;
}

export function mondayOf(iso: string): string {
  const index = weekdayIndex(iso);
  const delta = index === 0 ? -6 : 1 - index;
  return addDaysIso(iso, delta);
}

export function noteFor(error: string, label: string): string {
  const text = error.toLowerCase();
  if (
    text.includes("not found") ||
    text.includes("unknown") ||
    text.includes("no such") ||
    text.includes("methode") ||
    text.includes("method") ||
    text.includes("right") ||
    text.includes("berecht") ||
    text.includes("forbidden") ||
    text.includes("nicht erlaubt") ||
    text.includes("permission") ||
    text.includes("not supported") ||
    text.includes("no sufficient")
  ) {
    return `${label} gibt es an dieser Schule über die Schnittstelle nicht.`;
  }
  return `${label} gerade nicht abrufbar.`;
}

function bag(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const row = bag(value);
  if (!row) return "";
  for (const key of ["longName", "longname", "displayName", "name", "text", "subject"]) {
    const part = row[key];
    if (typeof part === "string" && part.trim()) return part.trim();
  }
  return "";
}

function joinNames(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => textOf(entry))
      .filter(Boolean)
      .join(", ");
  }
  return textOf(value);
}

function isoOf(value: unknown): string {
  if (typeof value === "number" && value > 19_000_101 && value < 30_000_101) return ymdToIso(value);
  if (typeof value === "string" && /^\d{8}$/.test(value)) return ymdToIso(Number(value));
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return "";
}

function minutesOf(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value >= 0 && value < 2400 && value % 100 < 60) return untisTimeToMinutes(value);
  return 0;
}

function rowsOf(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const row = bag(value);
  if (!row) return [];
  for (const key of keys) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  return [];
}

function idOf(value: unknown, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function changeKind(value: unknown): "cancelled" | "substitution" {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("cancel") || text.includes("entf")) return "cancelled";
  return "substitution";
}

export function parseExams(raw: unknown): ExamItem[] {
  return rowsOf(raw, ["exams"])
    .map((entry, index) => {
      const row = bag(entry);
      if (!row) return null;
      const iso = isoOf(row.date ?? row.startDate);
      if (!iso) return null;
      const subject = textOf(row.subject) || joinNames(row.subjects);
      const name = textOf(row.name) || textOf(row.examType) || subject || "Prüfung";
      return {
        id: idOf(row.id, `exam-${iso}-${index}`),
        iso,
        startMin: minutesOf(row.startTime),
        endMin: minutesOf(row.endTime),
        name,
        subject: subject && subject !== name ? subject : "",
        teachers: joinNames(row.teachers ?? row.teacher),
        rooms: joinNames(row.rooms ?? row.room),
        text: textOf(row.text) || textOf(row.examType),
      } satisfies ExamItem;
    })
    .filter((item): item is ExamItem => item != null)
    .sort((a, b) => a.iso.localeCompare(b.iso) || a.startMin - b.startMin);
}

export function parseHomework(raw: unknown): HomeworkItem[] {
  return rowsOf(raw, ["homeWorks", "homeworks", "homework"])
    .map((entry, index) => {
      const row = bag(entry);
      if (!row) return null;
      const text = textOf(row.text) || textOf(row.remark) || textOf(row.description);
      if (!text) return null;
      const dueIso = isoOf(row.dueDate ?? row.date ?? row.endDate) || "";
      const subject = textOf(row.subject) || textOf(row.subjectName) || "";
      return {
        id: idOf(row.id, `hw-${dueIso}-${index}`),
        dueIso,
        subject,
        text,
        teacher: textOf(row.teacher) || textOf(row.teacherName),
        remark: textOf(row.remark) && textOf(row.remark) !== text ? textOf(row.remark) : "",
        done: row.completed === true || row.done === true,
      } satisfies HomeworkItem;
    })
    .filter((item): item is HomeworkItem => item != null)
    .sort((a, b) => (a.dueIso || "9999").localeCompare(b.dueIso || "9999"));
}

function absenceStatus(row: Record<string, unknown>): string {
  const nested = bag(row.absence);
  const excused = row.excused ?? nested?.excused ?? row.isExcused;
  if (excused === true || String(row.excuseStatus ?? nested?.status ?? "").toLowerCase().includes("excuse")) {
    return "entschuldigt";
  }
  if (excused === false) return "unentschuldigt";
  const label = textOf(row.status) || textOf(nested?.status) || textOf(row.excuseStatus) || textOf(nested?.reason);
  return label;
}

export function parseAbsences(raw: unknown): AbsenceItem[] {
  return rowsOf(raw, ["absences", "classRegEvents", "events"])
    .map((entry, index) => {
      const row = bag(entry);
      if (!row) return null;
      const nested = bag(row.absence);
      const iso = isoOf(row.date ?? row.startDate ?? nested?.date);
      if (!iso) return null;
      const text =
        textOf(row.text) ||
        textOf(nested?.text) ||
        textOf(row.reason) ||
        textOf(nested?.reason) ||
        textOf(row.absenceReason);
      return {
        id: idOf(row.id ?? nested?.id, `abs-${iso}-${index}`),
        iso,
        startMin: minutesOf(row.startTime ?? nested?.startTime),
        endMin: minutesOf(row.endTime ?? nested?.endTime),
        subject: textOf(row.subject) || textOf(row.subjectName),
        status: absenceStatus(row),
        text,
      } satisfies AbsenceItem;
    })
    .filter((item): item is AbsenceItem => item != null)
    .sort((a, b) => b.iso.localeCompare(a.iso) || b.startMin - a.startMin);
}

export function parseHolidays(raw: unknown): HolidayItem[] {
  return rowsOf(raw, ["holidays"])
    .map((entry, index) => {
      const row = bag(entry);
      if (!row) return null;
      const startIso = isoOf(row.startDate);
      const endIso = isoOf(row.endDate) || startIso;
      const name = textOf(row.longName) || textOf(row.longname) || textOf(row.name);
      if (!startIso || !name) return null;
      return {
        id: idOf(row.id, `hol-${startIso}-${index}`),
        name,
        startIso,
        endIso,
      } satisfies HolidayItem;
    })
    .filter((item): item is HolidayItem => item != null)
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}

export function parseNotices(raw: unknown): NoticeItem[] {
  return rowsOf(raw, ["messages", "messageOfDay", "notices"])
    .map((entry, index) => {
      const row = bag(entry);
      if (!row) return null;
      const body = textOf(row.text) || textOf(row.body) || textOf(row.content);
      const title = textOf(row.subject) || textOf(row.title) || "Mitteilung";
      if (!body && title === "Mitteilung") return null;
      return {
        id: idOf(row.id, `note-${index}`),
        iso: isoOf(row.date) || "",
        title,
        body: body || title,
      } satisfies NoticeItem;
    })
    .filter((item): item is NoticeItem => item != null);
}

export function parseSubstitutions(raw: unknown): ChangeItem[] {
  return rowsOf(raw, ["substitutions"])
    .map((entry, index) => {
      const row = bag(entry);
      if (!row) return null;
      const iso = isoOf(row.date);
      if (!iso) return null;
      const kind = changeKind(row.type ?? row.code);
      const subject = joinNames(row.su ?? row.subject) || "Unterricht";
      return {
        id: idOf(row.id, `sub-${iso}-${index}`),
        iso,
        startMin: minutesOf(row.startTime),
        endMin: minutesOf(row.endTime),
        subject,
        kind,
        text: textOf(row.txt) || textOf(row.substText) || textOf(row.text),
        teacher: joinNames(row.te ?? row.teachers),
        room: joinNames(row.ro ?? row.rooms),
        classes: joinNames(row.kl ?? row.classes),
      } satisfies ChangeItem;
    })
    .filter((item): item is ChangeItem => item != null);
}

export function changesFromDays(days: DeskDay[]): ChangeItem[] {
  const items: ChangeItem[] = [];
  for (const day of days) {
    for (const lesson of day.lessons) {
      if (lesson.status === "regular") continue;
      items.push({
        id: `${day.iso}-${lesson.id}`,
        iso: day.iso,
        startMin: lesson.startMin,
        endMin: lesson.endMin,
        subject: lesson.subject,
        kind: lesson.status === "cancelled" ? "cancelled" : "substitution",
        text: lesson.info,
        teacher: lesson.teacher,
        room: lesson.room,
        classes: "",
      });
    }
  }
  return items;
}

export function mergeChanges(days: DeskDay[], extra: ChangeItem[], whoName: string): ChangeItem[] {
  const slots = new Set<string>();
  for (const day of days) {
    for (const lesson of day.lessons) slots.add(`${day.iso}|${lesson.startMin}`);
  }
  const needle = whoName.trim().toLowerCase();
  const ownExtra = extra.filter((change) => {
    if (slots.has(`${change.iso}|${change.startMin}`)) return true;
    if (!needle) return false;
    return change.classes.toLowerCase().split(",").some((part) => part.trim() === needle);
  });
  const seen = new Set<string>();
  const out: ChangeItem[] = [];
  for (const item of [...changesFromDays(days), ...ownExtra]) {
    const key = `${item.iso}|${item.startMin}|${item.subject.toLowerCase()}|${item.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  out.sort((a, b) => a.iso.localeCompare(b.iso) || a.startMin - b.startMin || a.subject.localeCompare(b.subject, "de"));
  return out;
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    parts.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

function icsStamp(iso: string, minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${iso.replace(/-/g, "")}T${hh}${mm}00`;
}

export function toIcs(desk: DeskData, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FLUR//Stundenplan//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape("FLUR")}`,
  ];
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  for (const day of desk.days) {
    for (const lesson of day.lessons) {
      const summary = lesson.status === "cancelled" ? `${lesson.subject} entfällt` : lesson.subject;
      const description = [lesson.teacher, lesson.info].filter(Boolean).join(" · ");
      lines.push("BEGIN:VEVENT");
      lines.push(fold(`UID:flur-${day.iso}-${lesson.id}@flur`));
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(`DTSTART:${icsStamp(day.iso, lesson.startMin)}`);
      lines.push(`DTEND:${icsStamp(day.iso, lesson.endMin)}`);
      lines.push(fold(`SUMMARY:${icsEscape(summary)}`));
      if (lesson.room) lines.push(fold(`LOCATION:${icsEscape(lesson.room)}`));
      if (description) lines.push(fold(`DESCRIPTION:${icsEscape(description)}`));
      if (lesson.status === "cancelled") lines.push("STATUS:CANCELLED");
      lines.push("END:VEVENT");
    }
  }
  for (const exam of desk.exams) {
    const end = exam.endMin > exam.startMin ? exam.endMin : exam.startMin + 45;
    lines.push("BEGIN:VEVENT");
    lines.push(fold(`UID:flur-exam-${exam.id}@flur`));
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${icsStamp(exam.iso, exam.startMin)}`);
    lines.push(`DTEND:${icsStamp(exam.iso, end)}`);
    lines.push(fold(`SUMMARY:${icsEscape(exam.name || exam.subject || "Prüfung")}`));
    if (exam.rooms) lines.push(fold(`LOCATION:${icsEscape(exam.rooms)}`));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(body: string) {
  const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "FLUR-stundenplan.ics";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function cloneLessons(iso: string, lessons: Lesson[]): Lesson[] {
  return lessons.map((lesson) => ({ ...lesson, id: `${iso}-${lesson.id}` }));
}

export function demoDesk(now = new Date()): DeskData {
  const today = berlinParts(now).iso;
  const monday = mondayOf(today);
  const tomorrow = addDaysIso(today, 1);
  const days: DeskDay[] = [];
  for (let index = 0; index < 14; index += 1) {
    const iso = addDaysIso(monday, index);
    const weekend = weekdayIndex(iso) === 0 || weekdayIndex(iso) === 6;
    if (weekend) {
      days.push({ iso, lessons: [] });
      continue;
    }
    const source = iso === today || iso === tomorrow ? DEMO_LESSONS : DEMO_LESSONS.filter((lesson) => lesson.status === "regular");
    days.push({ iso, lessons: cloneLessons(iso, source) });
  }
  const examDay = addDaysIso(monday, 11);
  const absenceDay = addDaysIso(today, -2);
  const desk: DeskData = {
    source: "demo",
    fetchedAt: now.toISOString(),
    days,
    exams: [
      {
        id: "demo-exam",
        iso: examDay,
        startMin: 8 * 60,
        endMin: 9 * 60 + 30,
        name: "Klausur",
        subject: "Mathematik",
        teachers: "Berger",
        rooms: "204",
        text: "Taschenrechner",
      },
    ],
    homework: [
      {
        id: "demo-hw",
        dueIso: tomorrow,
        subject: "Deutsch",
        text: "Lesetagebuch, zwei Seiten",
        teacher: "Keller",
        remark: "",
        done: false,
      },
    ],
    absences: [
      {
        id: "demo-abs",
        iso: absenceDay,
        startMin: 8 * 60,
        endMin: 8 * 60 + 45,
        subject: "Deutsch",
        status: "entschuldigt",
        text: "Arzt",
      },
    ],
    holidays: [
      {
        id: "demo-hol",
        name: "Weihnachtsferien",
        startIso: "2026-12-21",
        endIso: "2027-01-06",
      },
    ],
    notices: [
      {
        id: "demo-note",
        iso: today,
        title: "Bibliothek",
        body: "Heute nur bis 15 Uhr geöffnet.",
      },
    ],
    changes: [],
    notes: emptyNotes(),
  };
  desk.changes = mergeChanges(days, [], "");
  return desk;
}
