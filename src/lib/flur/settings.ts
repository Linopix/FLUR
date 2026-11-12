import type { LoginKind, Mode, Settings, Who } from "@/lib/flur/types";

const KEY = "flur.settings.v1";

export function emptySettings(): Settings {
  return {
    baseUrl: "",
    school: "",
    schoolLabel: "",
    user: "",
    password: "",
    login: "password",
    who: "student",
    whoName: "",
    homeAddress: "",
    station: "",
    schoolStop: "",
    mode: "bike",
    kioskRotate: false,
    onboarded: false,
  };
}

function asWho(value: unknown): Who {
  return value === "class" || value === "teacher" || value === "student" ? value : "student";
}

function asLogin(value: unknown): LoginKind {
  return value === "secret" ? "secret" : "password";
}

function asMode(value: unknown): Mode {
  return value === "bus" || value === "car" || value === "bike" || value === "walk" ? value : "bike";
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return emptySettings();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptySettings();
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...emptySettings(),
      ...parsed,
      who: asWho(parsed.who),
      mode: asMode(parsed.mode),
      login: asLogin(parsed.login),
      schoolLabel: typeof parsed.schoolLabel === "string" ? parsed.schoolLabel : "",
      kioskRotate: Boolean(parsed.kioskRotate),
      password: typeof parsed.password === "string" ? parsed.password : "",
      onboarded: parsed.onboarded === true,
    };
  } catch {
    return emptySettings();
  }
}

export function saveSettings(settings: Settings) {
  window.localStorage.setItem(KEY, JSON.stringify(settings));
}

export function clearSettings() {
  window.localStorage.removeItem(KEY);
}

export function hasUntis(settings: Settings): boolean {
  return Boolean(
    settings.baseUrl.trim() &&
      settings.school.trim() &&
      settings.user.trim() &&
      settings.password,
  );
}

export function hasRoute(settings: Settings): boolean {
  return Boolean(settings.homeAddress.trim() && settings.station.trim() && settings.schoolStop.trim());
}
