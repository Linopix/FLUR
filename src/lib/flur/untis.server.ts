import { createHash, createHmac } from "node:crypto";
import { isUntisHost, parseUntisAccess } from "@/lib/flur/access";
import {
  emptyNotes,
  mergeChanges,
  mondayOf,
  noteFor,
  parseAbsences,
  parseExams,
  parseHolidays,
  parseHomework,
  parseNotices,
  parseSubstitutions,
  type DeskData,
  type DeskResult,
} from "@/lib/flur/desk";
import { readNamedDirectory, readPublicDirectory, type DirectoryItem } from "@/lib/flur/directory";
import { addDaysIso, berlinParts, untisTimeToMinutes, ymdToIso } from "@/lib/flur/time";
import type { BoardResult, DayBoard, Lesson, LessonStatus, LoginKind, Mode, SchoolMatch, Who } from "@/lib/flur/types";

export type UntisCreds = {
  baseUrl: string;
  school: string;
  user: string;
  password: string;
  login: LoginKind;
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

type CatalogName = { short: string; long: string };

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
const directoryCache = new Map<string, { at: number; items: DirectoryItem[] }>();
const DIRECTORY_MS = 30 * 60 * 1000;

function sessionKey(creds: UntisCreds): string {
  const hash = createHash("sha256").update(creds.password).digest("hex").slice(0, 16);
  return [creds.baseUrl, creds.school, creds.user, creds.login, creds.who, creds.whoName, hash].join("|");
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
  if (!isUntisHost(host)) throw new Error("Das ist kein WebUntis-Server.");
  return `${url.protocol}//${url.host}`;
}

type SchoolHit = {
  server?: string;
  loginName?: string;
  displayName?: string;
  address?: string;
};

const schoolNames = new Map<string, { value: string; at: number }>();
const SCHOOL_MS = 6 * 60 * 60 * 1000;

function squash(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export async function searchUntisSchools(query: string): Promise<{ schools: SchoolMatch[]; hint: string }> {
  const search = query.trim();
  if (search.length < 2) return { schools: [], hint: "" };
  const endpoints = [
    "https://schoolsearch.webuntis.com/schoolquery2",
    "https://mobile.webuntis.com/ms/schoolquery2",
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "FLUR/1.0",
        },
        body: JSON.stringify({
          id: "flur",
          method: "searchSchool",
          params: [{ search }],
          jsonrpc: "2.0",
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) continue;
      const json = (await response.json()) as {
        error?: { code?: number };
        result?: { schools?: SchoolHit[] };
      };
      if (json.error?.code === -6003) {
        return { schools: [], hint: "Zu viele Treffer. Nimm den Ort oder den vollen Namen dazu." };
      }
      const schools = (json.result?.schools ?? [])
        .map((hit) => {
          const server = (hit.server ?? "").toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
          const loginName = hit.loginName?.trim() ?? "";
          if (!loginName || !isUntisHost(server)) return null;
          return {
            displayName: hit.displayName?.trim() || loginName,
            loginName,
            server,
            address: hit.address?.trim() ?? "",
          };
        })
        .filter((hit): hit is SchoolMatch => hit != null)
        .slice(0, 8);
      if (schools.length > 0) return { schools, hint: "" };
    } catch {
      continue;
    }
  }
  return { schools: [], hint: "Keine Schule gefunden." };
}

async function resolveSchoolName(base: string, input: string): Promise<string> {
  const school = input.trim();
  const host = new URL(base).host.toLowerCase();
  const cacheKey = `${host}|${school.toLowerCase()}`;
  const cached = schoolNames.get(cacheKey);
  if (cached && Date.now() - cached.at < SCHOOL_MS) return cached.value;

  const remember = (value: string) => {
    schoolNames.set(cacheKey, { value, at: Date.now() });
    return value;
  };

  try {
    const found = await searchUntisSchools(school);
    const hits = found.schools;
    if (hits.length === 0) return school;
    const wanted = squash(school);
    const onServer = hits.filter((hit) => hit.server === host);
    const pool = onServer.length > 0 ? onServer : hits;
    const match =
      pool.find((hit) => squash(hit.loginName) === wanted) ??
      pool.find((hit) => squash(hit.displayName) === wanted) ??
      (onServer.length > 0 ? onServer[0] : pool.length === 1 ? pool[0] : undefined);
    return match ? remember(match.loginName) : school;
  } catch {
    return school;
  }
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function totp(secret: string, now = Date.now()): string {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  if (clean.length < 8) throw new Error("Der Zugangscode ist unvollständig.");
  let bits = "";
  for (const char of clean) bits += B32.indexOf(char).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  const counter = Math.floor(now / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", Buffer.from(bytes)).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

function applyPastedAccess(creds: UntisCreds): UntisCreds {
  if (creds.login !== "secret") return creds;
  const parsed = parseUntisAccess(creds.password);
  if (!parsed?.secret) return creds;
  return {
    ...creds,
    password: parsed.secret,
    user: parsed.user || creds.user,
    school: parsed.school || creds.school,
    baseUrl: parsed.server || creds.baseUrl,
  };
}

async function rpc(
  base: string,
  school: string,
  method: string,
  params: unknown,
  sessionId?: string,
  timeoutMs = 12_000,
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
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.status === 404) {
    throw new Error(
      "WebUntis kennt diese Schule nicht. Server und Schulname prüfen (am besten die Kennung aus der WebUntis-Adresse nach school= verwenden).",
    );
  }
  if (!response.ok) throw new Error(`WebUntis antwortet mit Status ${response.status}.`);
  const json = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message || "WebUntis hat die Anfrage nicht ausgeführt.");
  return json.result;
}

async function rpcIntern(
  base: string,
  school: string,
  method: string,
  params: unknown,
  sessionId: string,
): Promise<unknown> {
  const url = `${base}/WebUntis/jsonrpc_intern.do?school=${encodeURIComponent(school)}&v=i5.2`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "FLUR/1.0",
      Cookie: `JSESSIONID=${sessionId}`,
    },
    body: JSON.stringify({ id: "flur", method, params, jsonrpc: "2.0" }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`WebUntis antwortet mit Status ${response.status}.`);
  const json = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message || "Methode nicht gefunden");
  return json.result;
}

async function login(creds: UntisCreds, base: string): Promise<Session> {
  const key = sessionKey(creds);
  const cached = sessions.get(key);
  if (cached && Date.now() - cached.at < SESSION_MS) return cached;
  const session = creds.login === "secret" ? await loginWithSecret(creds, base) : await loginWithPassword(creds, base);
  sessions.set(key, session);
  return session;
}

async function loginWithPassword(creds: UntisCreds, base: string): Promise<Session> {
  const result = (await rpc(base, creds.school, "authenticate", {
    user: creds.user,
    password: creds.password,
    client: "FLUR",
  })) as { sessionId?: string; personType?: number; personId?: number };
  if (!result?.sessionId || result.personId == null || result.personType == null) {
    throw new Error("Anmeldung fehlgeschlagen.");
  }
  return { id: result.sessionId, personType: result.personType, personId: result.personId, at: Date.now() };
}

async function loginWithSecret(creds: UntisCreds, base: string): Promise<Session> {
  const otp = Number(totp(creds.password));
  const url = `${base}/WebUntis/jsonrpc_intern.do?school=${encodeURIComponent(creds.school)}&m=getUserData2017&v=i5.2`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "FLUR/1.0",
    },
    body: JSON.stringify({
      id: "flur",
      method: "getUserData2017",
      params: [{ auth: { clientTime: Date.now(), user: creds.user, otp } }],
      jsonrpc: "2.0",
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`WebUntis antwortet mit Status ${response.status}.`);
  const json = (await response.json()) as {
    error?: { message?: string };
    result?: {
      sessionId?: string;
      personType?: number;
      personId?: number;
      userData?: {
        personType?: number;
        personId?: number;
        elemId?: number;
        elemType?: string | number;
      };
    };
  };
  if (json.error) throw new Error(json.error.message || "Schul-Login abgelehnt.");
  const cookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const fromCookie = cookies.map((line) => /JSESSIONID=([^;]+)/.exec(line)?.[1]).find(Boolean);
  const id = json.result?.sessionId || fromCookie;
  const userData = json.result?.userData;
  const personId = json.result?.personId ?? userData?.personId ?? userData?.elemId;
  const personType = personTypeOf(json.result?.personType ?? userData?.personType ?? userData?.elemType);
  if (!id || personId == null) throw new Error("Schul-Login abgelehnt.");
  return { id, personType, personId, at: Date.now() };
}

function rejectedMessage(login: LoginKind, message: string): string | null {
  if (!/auth|password|benutzer|login|user|otp|secret|zugang|anmeld|credential|falsch/i.test(message)) return null;
  return login === "secret"
    ? "Schul-Login abgelehnt. Benutzer und der Code aus Freigaben stimmen nicht."
    : "Das Passwort ist falsch, oder der Benutzer stimmt nicht.";
}

function personTypeOf(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const text = String(value ?? "").toUpperCase();
  if (text === "2" || text.includes("TEACH") || text.includes("LEHR")) return 2;
  if (text === "1" || text.includes("CLASS") || text.includes("KLAS")) return 1;
  const parsed = Number(text);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 5;
}

function namePair(entries: Named[] | undefined, catalog: Map<number, CatalogName>): { long: string; short: string } {
  const entry = entries?.[0];
  if (!entry) return { long: "", short: "" };
  const fromCat = entry.id != null ? catalog.get(entry.id) : undefined;
  const short = (entry.name || fromCat?.short || "").trim();
  const long = (entry.longname || entry.longName || fromCat?.long || short).trim();
  const same = short.toLocaleLowerCase("de") === long.toLocaleLowerCase("de");
  return { long: long || short, short: short && !same ? short : "" };
}

function labelOf(entries: Named[] | undefined, catalog: Map<number, CatalogName>): string {
  return namePair(entries, catalog).long;
}

function shortOf(entries: Named[] | undefined): string {
  return entries?.[0]?.name?.trim() || entries?.[0]?.orgname?.trim() || "";
}

async function catalog(
  base: string,
  school: string,
  sessionId: string,
  method: string,
): Promise<Map<number, CatalogName>> {
  try {
    const rows = (await rpc(base, school, method, {}, sessionId)) as Named[];
    const map = new Map<number, CatalogName>();
    if (!Array.isArray(rows)) return map;
    for (const row of rows) {
      if (row.id == null) continue;
      map.set(row.id, {
        short: (row.name || "").trim(),
        long: (row.longname || row.longName || row.name || "").trim(),
      });
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
    return names.some(
      (name) => name === needle || name.replace(/\s+/g, "") === needle.replace(/\s+/g, ""),
    );
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

async function listPublicDirectory(base: string, school: string, who: "class" | "teacher"): Promise<DirectoryItem[]> {
  const type = who === "class" ? "CLASS" : "TEACHER";
  const url = `${base}/WebUntis/api/rest/view/v1/timetable/filter?resourceType=${type}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "FLUR/1.0",
  };
  if (/^[\x20-\x7E]+$/.test(school)) headers["anonymous-school"] = school;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return [];
  return readPublicDirectory(await response.json(), who);
}

async function listPrivateDirectory(
  input: UntisCreds & { who: "class" | "teacher" },
  base: string,
): Promise<DirectoryItem[]> {
  const creds = applyPastedAccess({ ...input, whoName: "" });
  const school = await resolveSchoolName(base, creds.school.trim());
  const session = await login({ ...creds, school, baseUrl: base }, base);
  const method = input.who === "class" ? "getKlassen" : "getTeachers";
  const rows = await rpc(base, school, method, {}, session.id);
  return readNamedDirectory(rows);
}

export async function listUntisDirectory(input: {
  baseUrl: string;
  school: string;
  who: "class" | "teacher";
  user: string;
  password: string;
  login: LoginKind;
}): Promise<{ items: DirectoryItem[]; hint: string }> {
  let base = "";
  try {
    base = normalizeUntisBase(input.baseUrl);
  } catch (error) {
    return { items: [], hint: error instanceof Error ? error.message : "Server fehlt." };
  }
  const school = input.school.trim();
  const cacheKey = `${base}|${school.toLowerCase()}|${input.who}|public`;
  const cached = directoryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < DIRECTORY_MS) return { items: cached.items, hint: "" };

  let items: DirectoryItem[] = [];
  try {
    items = await listPublicDirectory(base, school, input.who);
  } catch {
    items = [];
  }
  if (items.length > 0) {
    directoryCache.set(cacheKey, { items, at: Date.now() });
    return { items, hint: "" };
  }
  if (input.user.trim() && input.password) {
    try {
      items = await listPrivateDirectory({ ...input, school, baseUrl: base, whoName: "" }, base);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/auth|password|benutzer|login|otp|secret|zugang/i.test(message)) {
        return {
          items: [],
          hint:
            input.who === "class"
              ? "Anmeldung abgelehnt. Den Klassennamen kannst du trotzdem eintragen."
              : "Anmeldung abgelehnt. Das Kürzel kannst du trotzdem eintragen.",
        };
      }
    }
  }
  if (items.length > 0) return { items, hint: "" };
  if (input.who === "teacher") return { items: [], hint: "" };
  if (!input.user.trim() || !input.password) {
    return {
      items: [],
      hint: "Keine öffentliche Klassenliste. Mit Anmeldung gibt es sie vielleicht, sonst den Namen eintragen, zum Beispiel 10b.",
    };
  }
  return {
    items: [],
    hint: "Keine Klassen gefunden. Den Namen trotzdem eintragen, zum Beispiel 10b.",
  };
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
  subjects: Map<number, CatalogName>,
  teachers: Map<number, CatalogName>,
  rooms: Map<number, CatalogName>,
): Lesson | null {
  if (raw.date == null || raw.startTime == null || raw.endTime == null) return null;
  const status = statusOf(raw);
  const subject = namePair(raw.su, subjects);
  const teacherPair = namePair(raw.te, teachers);
  const teacher = teacherPair.long || shortOf(raw.te);
  const original = raw.te?.[0]?.orgname?.trim() || "";
  const info = [raw.substText, raw.lstext, raw.info].filter(Boolean).join(" · ");
  return {
    id: String(raw.id ?? `${raw.date}-${raw.startTime}-${subject.long}`),
    startMin: untisTimeToMinutes(raw.startTime),
    endMin: untisTimeToMinutes(raw.endTime),
    subject: subject.long || "Unterricht",
    subjectShort: subject.short,
    teacher,
    teacherShort: teacherPair.short,
    originalTeacher: original && original !== teacher && original !== teacherPair.short && original !== shortOf(raw.te) ? original : "",
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
  subjects: Map<number, CatalogName>,
  teachers: Map<number, CatalogName>,
  rooms: Map<number, CatalogName>,
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
        teacherFields: ["id", "name", "longname"],
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

export async function loadUntisBoard(input: UntisCreds): Promise<BoardResult> {
  const creds = applyPastedAccess(input);
  const base = normalizeUntisBase(creds.baseUrl);
  const typedSchool = creds.school.trim();
  if (!typedSchool || !creds.user.trim() || !creds.password) {
    return {
      ok: false,
      error:
        creds.login === "secret"
          ? "Schule, Benutzer und Zugangscode werden gebraucht."
          : "Schule, Benutzer und Passwort werden gebraucht.",
    };
  }
  let school = typedSchool;
  try {
    school = await resolveSchoolName(base, typedSchool);
    const session = await login({ ...creds, school, baseUrl: base }, base);
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
    return { ok: false, error: rejectedMessage(creds.login, message) ?? message };
  }
}

async function firstOk(attempts: Array<() => Promise<unknown>>): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  let error = "Methode nicht gefunden";
  for (const attempt of attempts) {
    try {
      return { ok: true, result: await attempt() };
    } catch (caught) {
      error = caught instanceof Error ? caught.message : error;
    }
  }
  return { ok: false, error };
}

function lessonsOn(
  raws: RawLesson[],
  subjects: Map<number, CatalogName>,
  teachers: Map<number, CatalogName>,
  rooms: Map<number, CatalogName>,
): Map<string, Lesson[]> {
  const map = new Map<string, Lesson[]>();
  for (const raw of raws) {
    const lesson = toLesson(raw, subjects, teachers, rooms);
    if (!lesson || lesson.startMin === lesson.endMin || raw.date == null) continue;
    const iso = ymdToIso(raw.date);
    const list = map.get(iso) ?? [];
    const key = `${lesson.startMin}|${lesson.endMin}|${lesson.subject}|${lesson.room}|${lesson.status}`;
    if (list.some((item) => `${item.startMin}|${item.endMin}|${item.subject}|${item.room}|${item.status}` === key)) continue;
    list.push(lesson);
    map.set(iso, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.startMin - b.startMin || a.subject.localeCompare(b.subject, "de"));
  }
  return map;
}

export async function loadUntisDesk(input: UntisCreds): Promise<DeskResult> {
  const creds = applyPastedAccess(input);
  const base = normalizeUntisBase(creds.baseUrl);
  const typedSchool = creds.school.trim();
  if (!typedSchool || !creds.user.trim() || !creds.password) {
    return {
      ok: false,
      error:
        creds.login === "secret"
          ? "Schule, Benutzer und Zugangscode werden gebraucht."
          : "Schule, Benutzer und Passwort werden gebraucht.",
    };
  }
  let school = typedSchool;
  try {
    school = await resolveSchoolName(base, typedSchool);
    const session = await login({ ...creds, school, baseUrl: base }, base);
    const element = await resolveElement({ ...creds, school }, base, session);
    const today = berlinParts();
    const startIso = mondayOf(today.iso);
    const span = 42;
    const endIso = addDaysIso(startIso, span - 1);
    const ymd = (iso: string) => Number(iso.replace(/-/g, ""));
    const startDate = ymd(startIso);
    const endDate = ymd(endIso);
    const timetable = (from: string, to: string) =>
      rpc(
        base,
        school,
        "getTimetable",
        {
          options: {
            element,
            startDate: ymd(from),
            endDate: ymd(to),
            showInfo: true,
            showSubstText: true,
            showLsText: true,
            showStudentgroup: true,
            klasseFields: ["id", "name", "longname"],
            roomFields: ["id", "name", "longname"],
            subjectFields: ["id", "name", "longname"],
            teacherFields: ["id", "name", "longname"],
          },
        },
        session.id,
      ) as Promise<RawLesson[]>;
    const [subjects, teachers, rooms, firstChunk, secondChunk, thirdChunk] = await Promise.all([
      catalog(base, school, session.id, "getSubjects"),
      catalog(base, school, session.id, "getTeachers"),
      catalog(base, school, session.id, "getRooms"),
      timetable(startIso, addDaysIso(startIso, 13)),
      timetable(addDaysIso(startIso, 14), addDaysIso(startIso, 27)).catch(() => [] as RawLesson[]),
      timetable(addDaysIso(startIso, 28), endIso).catch(() => [] as RawLesson[]),
    ]);
    const rawLessons = [firstChunk, secondChunk, thirdChunk].flatMap((rows) => (Array.isArray(rows) ? rows : []));
    const grouped = lessonsOn(rawLessons, subjects, teachers, rooms);
    const days = Array.from({ length: span }, (_, index) => {
      const iso = addDaysIso(startIso, index);
      return { iso, lessons: grouped.get(iso) ?? [] };
    });

    const optional = { timeout: 8_000 };
    const [exams, holidays, substitutions, absences, homework, notices] = await Promise.all([
      firstOk([
        () => rpc(base, school, "getExams", { startDate, endDate }, session.id, optional.timeout),
        () => rpc(base, school, "getExams", { startDate, endDate, examTypeId: 0 }, session.id, optional.timeout),
      ]),
      firstOk([() => rpc(base, school, "getHolidays", {}, session.id, optional.timeout)]),
      firstOk([
        () => rpc(base, school, "getSubstitutions", { startDate, endDate, departmentId: 0 }, session.id, optional.timeout),
        () => rpc(base, school, "getSubstitutions", { startDate, endDate }, session.id, optional.timeout),
      ]),
      firstOk([
        () => rpc(base, school, "getClassregEvents", { startDate, endDate }, session.id, optional.timeout),
        () =>
          rpcIntern(base, school, "getStudentAbsences2017", { startDate, endDate, includeExcused: true, includeUnExcused: true }, session.id),
      ]),
      firstOk([
        () =>
          rpc(base, school, "getHomeWorks", { startDate, endDate, id: element.id, type: element.type }, session.id, optional.timeout),
        () => rpcIntern(base, school, "getHomeWork2017", { startDate, endDate }, session.id),
      ]),
      firstOk([
        () => rpcIntern(base, school, "getMessagesOfDay2017", { date: today.ymd }, session.id),
        () => rpcIntern(base, school, "getMessagesOfDay2017", { startDate, endDate }, session.id),
      ]),
    ]);

    const notes = emptyNotes();
    if (!exams.ok) notes.exams = noteFor(exams.error, "Prüfungen");
    if (!holidays.ok) notes.holidays = noteFor(holidays.error, "Ferien");
    if (!absences.ok) notes.absences = noteFor(absences.error, "Fehlzeiten");
    if (!homework.ok) notes.homework = noteFor(homework.error, "Hausaufgaben");
    if (!notices.ok) notes.notices = noteFor(notices.error, "Mitteilungen");

    const desk: DeskData = {
      source: "live",
      fetchedAt: new Date().toISOString(),
      days,
      exams: exams.ok ? parseExams(exams.result) : [],
      homework: homework.ok ? parseHomework(homework.result) : [],
      absences: absences.ok ? parseAbsences(absences.result) : [],
      holidays: holidays.ok ? parseHolidays(holidays.result) : [],
      notices: notices.ok ? parseNotices(notices.result) : [],
      changes: mergeChanges(days, substitutions.ok ? parseSubstitutions(substitutions.result) : [], creds.whoName),
      notes,
    };
    return { ok: true, desk };
  } catch (error) {
    sessions.delete(sessionKey({ ...creds, baseUrl: base, school }));
    const message = error instanceof Error ? error.message : "WebUntis ist nicht erreichbar.";
    return { ok: false, error: rejectedMessage(creds.login, message) ?? message };
  }
}

export async function checkUntisLogin(input: {
  baseUrl: string;
  school: string;
  user: string;
  password: string;
  login: LoginKind;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const creds = applyPastedAccess({ ...input, who: "student", whoName: "" });
  let base = "";
  let school = creds.school.trim();
  try {
    base = normalizeUntisBase(creds.baseUrl);
    if (!school || !creds.user.trim() || !creds.password) {
      return {
        ok: false,
        error:
          creds.login === "secret"
            ? "Benutzer und Zugangscode werden gebraucht."
            : "Benutzer und Passwort werden gebraucht.",
      };
    }
    school = await resolveSchoolName(base, school);
    await login({ ...creds, school, baseUrl: base }, base);
    return { ok: true };
  } catch (error) {
    if (base) sessions.delete(sessionKey({ ...creds, baseUrl: base, school }));
    const message = error instanceof Error ? error.message : "WebUntis ist nicht erreichbar.";
    return { ok: false, error: rejectedMessage(creds.login, message) ?? message };
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
    login: "password",
    who,
    whoName: process.env.FLUR_WEBUNTIS_NAME?.trim() ?? "",
  };
}

export function routeFromEnv(): {
  home: string;
  station: string;
  schoolStop: string;
  schoolAddress: string;
  mode: "" | Mode;
} {
  const modeRaw = process.env.FLUR_MODE?.trim();
  const mode: "" | Mode =
    modeRaw === "bus" ||
    modeRaw === "car" ||
    modeRaw === "bike" ||
    modeRaw === "walk" ||
    modeRaw === "drive" ||
    modeRaw === "link"
      ? modeRaw
      : "";
  return {
    home: process.env.FLUR_HOME?.trim() ?? "",
    station: process.env.FLUR_STATION?.trim() ?? "",
    schoolStop: process.env.FLUR_SCHOOL_STOP?.trim() ?? "",
    schoolAddress: process.env.FLUR_SCHOOL_ADDRESS?.trim() ?? "",
    mode,
  };
}
