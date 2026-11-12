import type { DeskData } from "@/lib/flur/desk";

const KEY = "flur.desk.v1";

export function loadDeskCache(): DeskData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeskData;
    if (!parsed || !Array.isArray(parsed.days) || !Array.isArray(parsed.exams)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDeskCache(desk: DeskData) {
  if (desk.source !== "live") return;
  window.localStorage.setItem(KEY, JSON.stringify(desk));
}
