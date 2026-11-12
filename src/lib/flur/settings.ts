import type { AnalogDesign, ClockFace, ClockSize, ClockUnit, DigitalDesign, LoginKind, Mode, NameFit, Settings, ThemeId, Who } from "@/lib/flur/types";

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
    schoolAddress: "",
    mode: "bike",
    kioskRotate: false,
    countdown: true,
    nameFit: "auto",
    clockFace: "digital",
    clockDigital: "serif",
    clockAnalog: "chalk",
    clockUnit: "auto",
    clockSize: "auto",
    countdownOwn: false,
    countFace: "digital",
    countDigital: "serif",
    countAnalog: "chalk",
    countUnit: "auto",
    countSize: "auto",
    burnGuard: false,
    infoScreen: false,
    dense: false,
    theme: "chalk",
    onboarded: false,
  };
}

function asWho(value: unknown): Who {
  return value === "class" || value === "teacher" || value === "student" ? value : "student";
}

function asLogin(value: unknown): LoginKind {
  return value === "secret" ? "secret" : "password";
}

function asNameFit(value: unknown): NameFit {
  return value === "short" || value === "long" || value === "scroll" || value === "auto" ? value : "auto";
}

function asClockFace(value: unknown): ClockFace {
  return value === "analog" ? "analog" : "digital";
}

function asDigital(value: unknown): DigitalDesign {
  return value === "split" || value === "led" || value === "serif" ? value : "serif";
}

function asAnalog(value: unknown): AnalogDesign {
  return value === "ring" || value === "school" || value === "chalk" ? value : "chalk";
}

function asClockUnit(value: unknown): ClockUnit {
  return value === "minute" || value === "hour" || value === "second" || value === "auto" ? value : "auto";
}

function asClockSize(value: unknown): ClockSize {
  return value === "s" || value === "l" || value === "m" || value === "auto" ? value : "auto";
}

export type FaceStyle = {
  face: ClockFace;
  digital: DigitalDesign;
  analog: AnalogDesign;
  unit: ClockUnit;
  size: ClockSize;
};

export function wallClock(settings: Settings): FaceStyle {
  return {
    face: settings.clockFace,
    digital: settings.clockDigital,
    analog: settings.clockAnalog,
    unit: settings.clockUnit,
    size: settings.clockSize,
  };
}

export function countdownClock(settings: Settings): FaceStyle {
  if (!settings.countdownOwn) return wallClock(settings);
  return {
    face: settings.countFace,
    digital: settings.countDigital,
    analog: settings.countAnalog,
    unit: settings.countUnit,
    size: settings.countSize,
  };
}

function asTheme(value: unknown): ThemeId {
  return value === "glass" ? "glass" : "chalk";
}

export function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  if (theme === "glass") document.documentElement.dataset.theme = "glass";
  else delete document.documentElement.dataset.theme;
}

function asMode(value: unknown): Mode {
  return value === "bus" ||
    value === "car" ||
    value === "bike" ||
    value === "walk" ||
    value === "drive" ||
    value === "link"
    ? value
    : "bike";
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
      schoolAddress: typeof parsed.schoolAddress === "string" ? parsed.schoolAddress : "",
      kioskRotate: Boolean(parsed.kioskRotate),
      countdown: parsed.countdown !== false,
      nameFit: asNameFit(parsed.nameFit),
      clockFace: asClockFace(parsed.clockFace),
      clockDigital: asDigital(parsed.clockDigital),
      clockAnalog: asAnalog(parsed.clockAnalog),
      clockUnit: asClockUnit(parsed.clockUnit),
      clockSize: asClockSize(parsed.clockSize),
      countdownOwn: parsed.countdownOwn === true,
      countFace: asClockFace(parsed.countFace),
      countDigital: asDigital(parsed.countDigital),
      countAnalog: asAnalog(parsed.countAnalog),
      countUnit: asClockUnit(parsed.countUnit),
      countSize: asClockSize(parsed.countSize),
      burnGuard: parsed.burnGuard === true,
      infoScreen: parsed.infoScreen === true,
      dense: parsed.dense === true,
      theme: asTheme(parsed.theme),
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
  if (!settings.homeAddress.trim()) return false;
  if (settings.mode === "drive") return Boolean(settings.schoolAddress.trim() || settings.schoolStop.trim());
  return Boolean(settings.station.trim() && settings.schoolStop.trim());
}
