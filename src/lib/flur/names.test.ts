import assert from "node:assert/strict";
import test from "node:test";
import { lessonSubject, lessonTeacher, resolveFit, shortenSubject, shortenTeacher, shownName } from "./names.ts";

test("known subjects and teachers shorten", () => {
  assert.equal(shortenSubject("Mathematik"), "M");
  assert.equal(shortenSubject("Geschichte"), "Ge");
  assert.equal(shortenSubject("Deutsch, Aufbau"), "D");
  assert.equal(shortenSubject("GK"), "GK");
  assert.equal(shortenTeacher("Keller"), "Kel");
  assert.equal(shortenTeacher("Hoffmann"), "Hof");
  assert.equal(shortenTeacher("Lang"), "Lang");
  assert.equal(shortenTeacher("Anna Berger"), "AB");
});

test("untis short code wins, scroll and long keep the full name", () => {
  assert.equal(shownName("Mathematik", "Ma", "subject", "short"), "Ma");
  assert.equal(shownName("Mathematik", "Mathematik", "subject", "short"), "M");
  assert.equal(shownName("Mathematik", "M", "subject", "scroll"), "Mathematik");
  assert.equal(shownName("Keller", "", "teacher", "long"), "Keller");
});

test("screen size only decides in auto", () => {
  assert.equal(resolveFit("auto", true), "short");
  assert.equal(resolveFit("auto", false), "long");
  assert.equal(resolveFit("scroll", true), "scroll");
});

test("lesson lines abbreviate both names", () => {
  const lesson = {
    subject: "Englisch",
    subjectShort: "E",
    teacher: "Nowak",
    teacherShort: "Now",
    originalTeacher: "Lang",
    originalTeacherShort: "",
  };
  assert.equal(lessonSubject(lesson, "short"), "E");
  assert.equal(lessonTeacher(lesson, "short"), "Now statt Lang");
  assert.equal(lessonTeacher(lesson, "scroll"), "Nowak statt Lang");
});
