import { createHash } from "node:crypto";
import { addDaysIso, berlinParts, untisTimeToMinutes, ymdToIso } from "@/lib/flur/time";
import type { BoardResult, DayBoard, Lesson, LessonStatus, Who } from "@/lib/flur/types";

export type UntisCreds = {
  baseUrl: string;
  school: string;
  user: string;
  password: string;
  who: Who;
  whoName: string;
};

type Session = {
  id: string;
  personType: number;
  personId: number;
  at: number;
};

type Named = {
  id?: number;
  name?: string;
  longname?: string;
  longName?: string;
  orgname?: string;
};

type RawLesson = {
  id?: number;
  date?: number;
  startTime?: number;
  endTime?: number;
  code?: string;
  info?: string;
  substText?: string;
  lstext?: string;
  activityType?: string;
  su?: Named[];
  te?: Named[];
  ro?: Named[];
  kl?: Named[];
};

const sessions = new Map<string, Session>();
const SESSION_MS = 12 * 60 * 1000;

function sessionKey(creds: UntisCreds): string {
  const hash = createHash("sha256").update(creds.password).digest("hex").slice(0, 16);
  return [creds.baseUrl, creds.school, creds.user, creds.who, creds.whoName, hash].join("|");
}

export function normalizeUntisBase(input: string): string {
  let value = input.trim().replace(/\/+$/, "");
  if (!value) throw new Error("Server fehlt.");
  if (!/^https?:\/\//i.test(value)) {
    if (!value.includes(".")) value = `${value}.webuntis.com`;
    value = `https://${value}`;
  }
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("WebUntis nur über https.");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0"
  ) {
    throw new Error("Dieser Server ist nicht erlaubt.");
  }
  const ip = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (ip) {
    const a = Number(ip[1]);
    const b = Number(ip[2]);
    const privateRange =
      a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
    if (privateRange) throw new Error("Dieser Server ist nicht erlaubt.");
  }
  return `${url.protocol}//${url.host}`;
}

async function rpc(
  base: string,
  school: string,
  method: string,
  params: unknown,
  sessionId?: string,
): Promise<unknown> {
  const url = `${base}/WebUntis/jsonrpc.do?school=${encodeURIComponent(school)}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "FLUR/1.0",
  };
  if (sessionId) headers.Cookie = `JSESSIONID=${sessionId}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: "flur", method, params, jsonrpc: "2.0" }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`WebUntis antwortet mit Status ${response.status}.`);
  const json = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message || "WebUntis hat die Anfrage abgelehnt.");
  return json.result;
}

async function login(creds: UntisCreds, base: string): Promise<Session> {
  const key = sessionKey(creds);
  const cached = sessions.get(key);
  if (cached && Date.now() - cached.at < SESSION_MS) return cached;
  const result = (await rpc(base, creds.school, "authenticate", {
    user: creds.user,
    password: creds.password,
    client: "FLUR",
  })) as { sessionId?: string; personType?: number; personId?: number };
  if (!result?.sessionId || result.personId == null || result.personType == null) {
    throw new Error("Anmeldung fehlgeschlagen.");
  }
  const session: Session = {
    id: result.sessionId,
    personType: result.personType,
    personId: result.personId,
    at: Date.now(),
  };
  sessions.set(key, session);
  return session;
}

function labelOf(entries: Named[] | undefined, catalog: Map<number, string>): string {
  const entry = entries?.[0];
  if (!entry) return "";
  const long = entry.longname || entry.longName;
  if (long && long.trim()) return long.trim();
  if (entry.name && entry.name.trim()) return entry.name.trim();
  if (entry.id != null && catalog.has(entry.id)) return catalog.get(entry.id) ?? "";
  return "";
}

function shortOf(entries: Named[] | undefined): string {
  return entries?.[0]?.name?.trim() || entries?.[0]?.orgname?.trim() || "";
}

async function catalog(
  base: string,
  school: string,
  sessionId: string,
  method: string,
): Promise<Map<number, string>> {
  try {
    const rows = (await rpc(base, school, method, {}, sessionId)) as Named[];
    const map = new Map<number, string>();
    if (!Array.isArray(rows)) return map;
    for (const row of rows) {
      if (row.id == null) continue;
      map.set(row.id, (row.longname || row.longName || row.name || "").trim());
    }
    return map;
  } catch {
    return new Map();
  }
}

async function resolveElement(
  creds: UntisCreds,
  base: string,
  session: Session,
): Promise<{ id: number; type: number }> {
  if (creds.who === "student") {
    return { id: session.personId, type: session.personType || 5 };
  }
  const method = creds.who === "class" ? "getKlassen" : "getTeachers";
  const type = creds.who === "class" ? 1 : 2;
  const rows = (await rpc(base, creds.school, method, {}, session.id)) as Named[];
  const needle = creds.whoName.trim().toLowerCase();
  if (!needle) {
    throw new Error(creds.who === "class" ? "Klassenname fehlt." : "Lehrerkürzel fehlt.");
  }
  const match = (Array.isArray(rows) ? rows : []).find((row) => {
    const names = [row.name, row.longname, row.longName].map((part) => (part ?? "").toLowerCase());
    return names.some((name) => name === needle || name.replace(/\s+/g, "") === needle.replace(/\s+/g, ""));
  });
  if (!match?.id) {
    throw new Error(
      creds.who === "class"
        ? `Klasse „${creds.whoName.trim()}“ nicht gefunden.`
        : `Lehrkraft „${creds.whoName.trim()}“ nicht gefunden.`,
    );
  }
  return { id: match.id, type };
}

function statusOf(raw: RawLesson): LessonStatus {
  const code = (raw.code ?? "").toLowerCase();
  if (code.includes("cancel")) return "cancelled";
  const original = raw.te?.[0]?.orgname;
  if (code.includes("irregular") || raw.substText || (original && original !== raw.te?.[0]?.name)) {
    return "substitution";
  }
  return "regular";
}

function toLesson(
  raw: RawLesson,
  subjects: Map<number, string>,
  teachers: Map<number, string>,
  rooms: Map<number, string>,
): Lesson | null {
  if (raw.date == null || raw.startTime == null || raw.endTime == null) return null;
  const status = statusOf(raw);
  const teacher = labelOf(raw.te, teachers) || shortOf(raw.te);
  const original = raw.te?.[0]?.orgname?.trim() || "";
  const info = [raw.substText, raw.lstext, raw.info].filter(Boolean).join(" · ");
  return {
    id: String(raw.id ?? `${raw.date}-${raw.startTime}-${labelOf(raw.su, subjects)}`),
    startMin: untisTimeToMinutes(raw.startTime),
    endMin: untisTimeToMinutes(raw.endTime),
    subject: labelOf(raw.su, subjects) || "Unterricht",
    teacher,
    originalTeacher: original && original !== teacher && original !== shortOf(raw.te) ? original : "",
    room: labelOf(raw.ro, rooms) || shortOf(raw.ro),
    info: status === "cancelled" ? info || "entfällt" : info,
    status,
  };
}

async function dayFor(
  creds: UntisCreds,
  base: string,
  session: Session,
  element: { id: number; type: number },
  ymd: number,
  subjects: Map<number, string>,
  teachers: Map<number, string>,
  rooms: Map<number, string>,
): Promise<DayBoard> {
  const result = (await rpc(
    base,
    creds.school,
    "getTimetable",
    {
      options: {
        element,
        startDate: ymd,
        endDate: ymd,
        showInfo: true,
        showSubstText: true,
        showLsText: true,
        showStudentgroup: true,
        klasseFields: ["id", "name", "longname"],
        roomFields: ["id", "name", "longname"],
        subjectFields: ["id", "name", "longname"],
        teacherFields: ["id", "name", "longname", "orgname"],
      },
    },
    session.id,
  )) as RawLesson[];
  const lessons = (Array.isArray(result) ? result : [])
    .map((raw) => toLesson(raw, subjects, teachers, rooms))
    .filter((lesson): lesson is Lesson => lesson != null && lesson.startMin !== lesson.endMin)
    .sort((a, b) => a.startMin - b.startMin || a.subject.localeCompare(b.subject, "de"));
  return { source: "live", iso: ymdToIso(ymd), lessons };
}

export async function loadUntisBoard(creds: UntisCreds): Promise<BoardResult> {
  const base = normalizeUntisBase(creds.baseUrl);
  const school = creds.school.trim();
  if (!school || !creds.user.trim() || !creds.password) {
    return { ok: false, error: "Schulname, Benutzer und Passwort werden gebraucht." };
  }
  try {
    const session = await login({ ...creds, school }, base);
    const element = await resolveElement({ ...creds, school }, base, session);
    const [subjects, teachers, rooms] = await Promise.all([
      catalog(base, school, session.id, "getSubjects"),
      catalog(base, school, session.id, "getTeachers"),
      catalog(base, school, session.id, "getRooms"),
    ]);
    const today = berlinParts();
    const tomorrowYmd = Number(addDaysIso(today.iso, 1).replace(/-/g, ""));
    const [todayBoard, tomorrowBoard] = await Promise.all([
      dayFor({ ...creds, school }, base, session, element, today.ymd, subjects, teachers, rooms),
      dayFor({ ...creds, school }, base, session, element, tomorrowYmd, subjects, teachers, rooms),
    ]);
    return { ok: true, source: "live", today: todayBoard, tomorrow: tomorrowBoard };
  } catch (error) {
    sessions.delete(sessionKey({ ...creds, baseUrl: base, school }));
    const message = error instanceof Error ? error.message : "WebUntis ist nicht erreichbar.";
    if (/auth|password|benutzer|login|user/i.test(message)) {
      return { ok: false, error: "Anmeldung abgelehnt. Server, Schule, Benutzer und Passwort prüfen." };
    }
    return { ok: false, error: message };
  }
}

export function credsFromEnv(): UntisCreds | null {
  const server = process.env.FLUR_WEBUNTIS_SERVER?.trim() ?? "";
  const school = process.env.FLUR_WEBUNTIS_SCHOOL?.trim() ?? "";
  const user = process.env.FLUR_WEBUNTIS_USER?.trim() ?? "";
  const password = process.env.FLUR_WEBUNTIS_PASSWORD ?? "";
  if (!server || !school || !user || !password) return null;
  const whoRaw = process.env.FLUR_WEBUNTIS_WHO?.trim();
  const who: Who = whoRaw === "class" || whoRaw === "teacher" ? whoRaw : "student";
  return {
    baseUrl: server,
    school,
    user,
    password,
    who,
    whoName: process.env.FLUR_WEBUNTIS_NAME?.trim() ?? "",
  };
}

export function routeFromEnv(): {
  home: string;
  station: string;
  schoolStop: string;
  mode: "" | "bus" | "car" | "bike" | "walk";
} {
  const modeRaw = process.env.FLUR_MODE?.trim();
  const mode =
    modeRaw === "bus" || modeRaw === "car" || modeRaw === "bike" || modeRaw === "walk" ? modeRaw : "";
  return {
    home: process.env.FLUR_HOME?.trim() ?? "",
    station: process.env.FLUR_STATION?.trim() ?? "",
    schoolStop: process.env.FLUR_SCHOOL_STOP?.trim() ?? "",
    mode,
  };
}
