import type { Settings } from "@/lib/flur/types";

const KEY = "flur.profiles.v1";

export type LocalProfile = {
  id: string;
  name: string;
  settings: Settings;
};

export function profileName(settings: Settings): string {
  const school = settings.schoolLabel.trim() || settings.school.trim() || "Schule";
  const who = settings.whoName.trim() || settings.user.trim() || "Konto";
  return `${school} · ${who}`;
}

export function loadProfiles(): LocalProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalProfile[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === "string" && item.settings);
  } catch {
    return [];
  }
}

export function saveProfiles(profiles: LocalProfile[]) {
  window.localStorage.setItem(KEY, JSON.stringify(profiles.slice(0, 6)));
}

export function rememberProfile(settings: Settings): LocalProfile[] {
  const name = profileName(settings);
  const current = loadProfiles().filter((item) => item.name !== name);
  const next = [{ id: crypto.randomUUID(), name, settings }, ...current].slice(0, 6);
  saveProfiles(next);
  return next;
}

export function forgetProfile(id: string): LocalProfile[] {
  const next = loadProfiles().filter((item) => item.id !== id);
  saveProfiles(next);
  return next;
}
