import type { ClockSize, ClockUnit } from "./types.ts";
import { berlinParts } from "./time.ts";

export type FixedUnit = "second" | "minute" | "hour";
export type FixedSize = "s" | "m" | "l";

export function resolveUnit(unit: ClockUnit, narrow: boolean, remainMs: number | null, kind: "rtc" | "countdown"): FixedUnit {
  if (unit === "second" || unit === "minute" || unit === "hour") return unit;
  if (kind === "countdown" && remainMs != null) {
    if (remainMs >= 48 * 3_600_000) return "hour";
    if (narrow || remainMs >= 2 * 3_600_000) return "minute";
    return "second";
  }
  return narrow ? "minute" : "second";
}

export function resolveSize(size: ClockSize, narrow: boolean): FixedSize {
  if (size === "s" || size === "m" || size === "l") return size;
  return narrow ? "s" : "m";
}

export function formatRtc(date: Date, unit: FixedUnit): string {
  const parts = berlinParts(date);
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  const second = String(parts.second).padStart(2, "0");
  if (unit === "hour") return hour;
  if (unit === "minute") return `${hour}:${minute}`;
  return `${hour}:${minute}:${second}`;
}

export function formatCountdown(ms: number, unit: FixedUnit): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (unit === "hour") {
    if (total <= 0) return "0 Std";
    const whole = Math.floor(total / 3600);
    if (whole <= 0) return "< 1 Std";
    const dayCount = Math.floor(whole / 24);
    const hourCount = whole % 24;
    if (dayCount > 0) return `${dayCount} T ${hourCount} Std`;
    return `${whole} Std`;
  }
  if (unit === "minute") {
    if (days > 0) return `${days} T ${pad(hours)}:${pad(minutes)}`;
    if (hours > 0) return `${hours}:${pad(minutes)}`;
    return `${minutes} Min`;
  }
  if (days > 0) return `${days} T ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function clockTextClass(size: FixedSize): string {
  if (size === "s") return "text-4xl";
  if (size === "l") return "text-6xl md:text-8xl";
  return "text-5xl md:text-6xl";
}
