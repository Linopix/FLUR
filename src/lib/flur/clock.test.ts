import assert from "node:assert/strict";
import test from "node:test";
import { formatCountdown, formatRtc, resolveSize, resolveUnit } from "./clock.ts";

const at = new Date("2026-11-12T08:28:36.000Z");

test("wall clock drops smaller units", () => {
  assert.equal(formatRtc(at, "second"), "09:28:36");
  assert.equal(formatRtc(at, "minute"), "09:28");
  assert.equal(formatRtc(at, "hour"), "09");
});

test("auto clock follows the screen, and long countdowns drop seconds", () => {
  assert.equal(resolveUnit("auto", true, null, "rtc"), "minute");
  assert.equal(resolveUnit("auto", false, null, "rtc"), "second");
  assert.equal(resolveUnit("auto", false, 30 * 60_000, "countdown"), "second");
  assert.equal(resolveUnit("auto", false, 3 * 3_600_000, "countdown"), "minute");
  assert.equal(resolveUnit("auto", false, 50 * 3_600_000, "countdown"), "hour");
  assert.equal(resolveUnit("second", true, null, "rtc"), "second");
  assert.equal(resolveSize("auto", true), "s");
  assert.equal(resolveSize("auto", false), "m");
  assert.equal(resolveSize("l", true), "l");
});

test("countdown respects the smallest unit", () => {
  assert.equal(formatCountdown(26 * 60_000 + 36_000, "second"), "26:36");
  assert.equal(formatCountdown(26 * 60_000 + 36_000, "minute"), "26 Min");
  assert.equal(formatCountdown(26 * 60_000 + 36_000, "hour"), "< 1 Std");
  assert.equal(formatCountdown((2 * 3600 + 4 * 60 + 5) * 1000, "minute"), "2:04");
  assert.equal(formatCountdown((2 * 3600 + 4 * 60) * 1000, "hour"), "2 Std");
  assert.equal(formatCountdown(26 * 3600 * 1000, "hour"), "1 T 2 Std");
  assert.equal(formatCountdown(0, "hour"), "0 Std");
  assert.equal(formatCountdown((26 * 3600 + 10 * 60) * 1000, "second"), "1 T 02:10:00");
});
