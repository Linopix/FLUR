import type { DeskData } from "@/lib/flur/desk";
import type { DayBoard } from "@/lib/flur/types";

const DESK_KEY = "flur.desk.v1";
const BOARD_KEY = "flur.board.v1";

export type BoardCache = {
  today: DayBoard;
  tomorrow: DayBoard;
  savedAt: string;
};

export type CacheOwner = {
  school: string;
  user: string;
  who: string;
  whoName: string;
};

export function cacheOwner(input: CacheOwner): string {
  return [input.school, input.user, input.who, input.whoName]
    .map((part) => part.trim().toLocaleLowerCase("de"))
    .join("\u001f");
}

export const SERVER_CACHE_OWNER = "server";

export function isAuthFailure(message: string): boolean {
  return /anmeldung|passwort|schul-login|zugangscode|werden gebraucht/i.test(message);
}

export function cachedAfterFailure<T>(message: string, cached: T | null): { show: T | null; offline: boolean; error: string | null } {
  if (isAuthFailure(message)) return { show: null, offline: false, error: message };
  if (cached != null) return { show: cached, offline: true, error: null };
  return { show: null, offline: false, error: message };
}

export function loadDeskCache(owner: string): DeskData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DESK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { owner?: string; desk?: DeskData };
    if (parsed.owner !== owner || !parsed.desk) return null;
    if (!Array.isArray(parsed.desk.days) || !Array.isArray(parsed.desk.exams)) return null;
    return parsed.desk;
  } catch {
    return null;
  }
}

export function saveDeskCache(owner: string, desk: DeskData) {
  if (desk.source !== "live") return;
  window.localStorage.setItem(DESK_KEY, JSON.stringify({ owner, desk }));
}

export function loadBoardCache(owner: string): BoardCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BOARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { owner?: string; today?: DayBoard; tomorrow?: DayBoard; savedAt?: string };
    if (parsed.owner !== owner || !parsed.today?.iso || !Array.isArray(parsed.today.lessons)) return null;
    if (!parsed.tomorrow || !Array.isArray(parsed.tomorrow.lessons)) return null;
    return { today: parsed.today, tomorrow: parsed.tomorrow, savedAt: parsed.savedAt || "" };
  } catch {
    return null;
  }
}

export function saveBoardCache(owner: string, today: DayBoard, tomorrow: DayBoard) {
  if (today.source !== "live" && tomorrow.source !== "live") return;
  const payload = { owner, today, tomorrow, savedAt: new Date().toISOString() };
  window.localStorage.setItem(BOARD_KEY, JSON.stringify(payload));
}
