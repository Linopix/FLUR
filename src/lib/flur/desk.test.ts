import assert from "node:assert/strict";
import test from "node:test";
import {
  demoDesk,
  mergeChanges,
  mondayOf,
  noteFor,
  parseAbsences,
  parseExams,
  parseHomework,
  parseHolidays,
  parseNotices,
  toIcs,
  weekdayShort,
} from "./desk.ts";

test("monday of a Thursday in November 2026", () => {
  assert.equal(mondayOf("2026-11-12"), "2026-11-09");
  assert.equal(weekdayShort("2026-11-12"), "Do");
  assert.equal(mondayOf("2026-11-15"), "2026-11-09");
});

test("parsers read Untis payloads", () => {
  const exams = parseExams([
    {
      id: 4,
      name: "Klausur",
      subject: "Mathematik",
      teachers: ["Berger"],
      rooms: ["204"],
      date: 20261120,
      startTime: 800,
      endTime: 930,
      text: "Taschenrechner",
    },
  ]);
  assert.equal(exams[0]?.subject, "Mathematik");
  assert.equal(exams[0]?.startMin, 8 * 60);

  const homework = parseHomework({
    homeWorks: [{ id: 9, dueDate: 20261113, text: "Seite 12", subject: "Deutsch", completed: false }],
  });
  assert.equal(homework[0]?.dueIso, "2026-11-13");
  assert.equal(homework[0]?.done, false);

  const absences = parseAbsences([
    { id: 1, date: 20261110, startTime: 800, endTime: 845, subject: "Deutsch", excused: true, text: "Arzt" },
  ]);
  assert.equal(absences[0]?.status, "entschuldigt");

  const holidays = parseHolidays([{ id: 2, name: "Weihnachten", longName: "Weihnachtsferien", startDate: 20261221, endDate: 20270106 }]);
  assert.equal(holidays[0]?.name, "Weihnachtsferien");

  const notices = parseNotices({ messages: [{ id: 3, subject: "Bibliothek", text: "bis 15 Uhr" }] });
  assert.equal(notices[0]?.body, "bis 15 Uhr");
});

test("substitutions of other classes stay out", () => {
  const days = [{ iso: "2026-11-12", lessons: [] }];
  const merged = mergeChanges(
    days,
    [
      {
        id: "a",
        iso: "2026-11-12",
        startMin: 480,
        endMin: 525,
        subject: "Sport",
        kind: "cancelled",
        text: "",
        teacher: "",
        room: "",
        classes: "9a",
      },
      {
        id: "b",
        iso: "2026-11-12",
        startMin: 480,
        endMin: 525,
        subject: "Kunst",
        kind: "cancelled",
        text: "",
        teacher: "",
        room: "",
        classes: "10b",
      },
    ],
    "10b",
  );
  assert.deepEqual(
    merged.map((item) => item.subject),
    ["Kunst"],
  );
});

test("rights errors become a short school note", () => {
  assert.match(noteFor("Method not found", "Hausaufgaben"), /Schnittstelle/);
  assert.match(noteFor("socket hang up", "Ferien"), /nicht abrufbar/);
});

test("calendar export keeps a comma out of the field break", () => {
  const desk = demoDesk(new Date("2026-11-12T08:00:00Z"));
  desk.days[0] = {
    iso: "2026-11-12",
    lessons: [
      {
        id: "x",
        startMin: 480,
        endMin: 525,
        subject: "Deutsch, Aufbau",
        teacher: "Keller",
        originalTeacher: "",
        room: "112",
        info: "",
        status: "regular",
      },
    ],
  };
  const ics = toIcs(desk, new Date("2026-11-12T08:00:00Z"));
  assert.match(ics, /SUMMARY:Deutsch\\, Aufbau/);
  assert.match(ics, /DTSTART:20261112T080000/);
  assert.match(ics, /BEGIN:VCALENDAR/);
});
