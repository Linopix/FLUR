import assert from "node:assert/strict";
import test from "node:test";
import { outboundAim, pickEarliest, pickTightest, returnAim, type TimedItinerary } from "./plan.ts";
import type { DayBoard, Lesson } from "./types.ts";

function lesson(partial: Pick<Lesson, "id" | "startMin" | "endMin" | "subject" | "status">): Lesson {
  return {
    teacher: "",
    originalTeacher: "",
    room: "",
    info: "",
    ...partial,
  };
}

function day(iso: string, lessons: Lesson[]): DayBoard {
  return { source: "demo", iso, lessons };
}

const blank: DayBoard = { source: "demo", iso: "", lessons: [] };

test("outbound skips a cancelled first lesson and arrives 8 minutes early", () => {
  const now = new Date("2026-10-21T04:00:00.000Z");
  const today = day("2026-10-21", [
    lesson({ id: "a", startMin: 8 * 60, endMin: 8 * 60 + 45, subject: "Deutsch", status: "cancelled" }),
    lesson({ id: "b", startMin: 8 * 60 + 50, endMin: 9 * 60 + 35, subject: "Mathematik", status: "regular" }),
  ]);
  const aim = outboundAim(today, blank, now);
  assert.ok(aim);
  assert.equal(aim.focus, "Mathematik 08:50");
  assert.equal(aim.classStart, "2026-10-21T06:50:00.000Z");
  assert.equal(aim.arriveBy, "2026-10-21T06:42:00.000Z");
});

test("outbound moves to tomorrow once today's first lesson is over", () => {
  const now = new Date("2026-10-21T12:00:00.000Z");
  const today = day("2026-10-21", [
    lesson({ id: "a", startMin: 8 * 60, endMin: 8 * 60 + 45, subject: "Deutsch", status: "regular" }),
  ]);
  const tomorrow = day("2026-10-22", [
    lesson({ id: "b", startMin: 9 * 60, endMin: 9 * 60 + 45, subject: "Physik", status: "cancelled" }),
    lesson({ id: "c", startMin: 10 * 60, endMin: 10 * 60 + 45, subject: "Sport", status: "regular" }),
  ]);
  const aim = outboundAim(today, tomorrow, now);
  assert.ok(aim);
  assert.equal(aim.focus, "Sport 10:00");
  assert.equal(aim.classStart, "2026-10-22T08:00:00.000Z");
});

test("return waits out the walk from school, then gives up after two hours", () => {
  const lessons = [
    lesson({ id: "a", startMin: 8 * 60, endMin: 8 * 60 + 45, subject: "Deutsch", status: "cancelled" }),
    lesson({ id: "b", startMin: 13 * 60, endMin: 13 * 60 + 25, subject: "Sport", status: "regular" }),
  ];
  const today = day("2026-10-21", lessons);
  const tomorrow = day("2026-10-22", lessons);
  const morning = returnAim(today, tomorrow, new Date("2026-10-21T08:00:00.000Z"));
  assert.equal(morning.classEnd, "2026-10-21T11:25:00.000Z");
  assert.equal(morning.departAt, "2026-10-21T11:33:00.000Z");
  assert.equal(morning.focus, "Sport bis 13:25");

  const justLeft = returnAim(today, tomorrow, new Date("2026-10-21T11:40:00.000Z"));
  assert.equal(justLeft.classEnd, "");
  assert.equal(justLeft.departAt, "2026-10-21T11:40:00.000Z");

  const evening = returnAim(today, tomorrow, new Date("2026-10-21T14:00:00.000Z"));
  assert.equal(evening.classEnd, "2026-10-22T11:25:00.000Z");
  assert.equal(evening.departAt, "2026-10-22T11:33:00.000Z");
});

test("tightest ride is the latest reachable one that still arrives on time", () => {
  const early: TimedItinerary = { startTime: "2026-10-22T05:00:00.000Z", endTime: "2026-10-22T05:20:00.000Z", legs: [{ mode: "RAIL" }] };
  const tight: TimedItinerary = { startTime: "2026-10-22T05:32:00.000Z", endTime: "2026-10-22T05:41:00.000Z", legs: [{ mode: "RAIL" }] };
  const late: TimedItinerary = { startTime: "2026-10-22T05:50:00.000Z", endTime: "2026-10-22T06:05:00.000Z", legs: [{ mode: "RAIL" }] };
  const cancelled: TimedItinerary = {
    startTime: "2026-10-22T05:40:00.000Z",
    endTime: "2026-10-22T05:48:00.000Z",
    legs: [{ mode: "RAIL", cancelled: true }],
  };
  const unreachable: TimedItinerary = {
    startTime: "2026-10-22T04:10:00.000Z",
    endTime: "2026-10-22T04:30:00.000Z",
    legs: [{ mode: "RAIL" }],
  };
  const deadline = Date.parse("2026-10-22T05:52:00.000Z");
  const earliest = Date.parse("2026-10-22T05:10:00.000Z");
  const chosen = pickTightest([late, cancelled, unreachable, early, tight], deadline, earliest);
  assert.equal(chosen, tight);
});

test("earliest return keeps a delayed train and skips a cancelled one", () => {
  const cancelled: TimedItinerary = {
    startTime: "2026-10-21T11:40:00.000Z",
    endTime: "2026-10-21T11:55:00.000Z",
    legs: [{ mode: "RAIL", cancelled: true }],
  };
  const delayed: TimedItinerary = {
    startTime: "2026-10-21T11:48:00.000Z",
    endTime: "2026-10-21T12:10:00.000Z",
    legs: [{ mode: "RAIL", from: { departure: "2026-10-21T11:48:00.000Z", scheduledDeparture: "2026-10-21T11:40:00.000Z" } }],
  };
  const later: TimedItinerary = {
    startTime: "2026-10-21T12:05:00.000Z",
    endTime: "2026-10-21T12:20:00.000Z",
    legs: [{ mode: "RAIL" }],
  };
  const chosen = pickEarliest([later, cancelled, delayed], Date.parse("2026-10-21T11:33:00.000Z"));
  assert.equal(chosen, delayed);
});
