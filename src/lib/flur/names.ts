import type { Lesson, NameFit, NameMode } from "./types.ts";

const SUBJECT_SHORT: Record<string, string> = {
  mathematik: "M",
  mathe: "M",
  deutsch: "D",
  englisch: "E",
  französisch: "F",
  franzoesisch: "F",
  latein: "L",
  spanisch: "S",
  italienisch: "I",
  geschichte: "Ge",
  politik: "Pk",
  wirtschaft: "Wl",
  wirtschaftslehre: "WL",
  physik: "Ph",
  chemie: "Ch",
  biologie: "Bio",
  sport: "Sp",
  informatik: "Inf",
  informationstechnik: "IT",
  kunst: "Ku",
  musik: "Mu",
  religion: "Rel",
  "evangelische religion": "ER",
  "katholische religion": "KR",
  ethik: "Eth",
  erdkunde: "Ek",
  geographie: "Geo",
  geografie: "Geo",
  sozialkunde: "Sk",
  gemeinschaftskunde: "Gk",
  pädagogik: "Päd",
  psychologie: "Psy",
  philosophie: "Phi",
  recht: "Re",
  bwl: "BWL",
  vwl: "VWL",
  naturwissenschaften: "Nw",
  "darstellendes spiel": "DS",
  hauswirtschaft: "HW",
};

export function shortenSubject(name: string): string {
  const clean = name.trim();
  if (!clean) return "";
  const key = clean.toLocaleLowerCase("de");
  if (SUBJECT_SHORT[key]) return SUBJECT_SHORT[key];
  const first = key.split(/[\s,/]+/).find(Boolean) ?? key;
  if (SUBJECT_SHORT[first]) return SUBJECT_SHORT[first];
  if (clean.length <= 4) return clean;
  const words = clean.split(/[\s,/]+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((word) => word[0] ?? "")
      .join("")
      .toLocaleUpperCase("de")
      .slice(0, 4);
  }
  return clean.slice(0, 3);
}

export function shortenTeacher(name: string): string {
  const clean = name.trim();
  if (!clean) return "";
  if (clean.length <= 4) return clean;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((word) => word[0] ?? "")
      .join("")
      .toLocaleUpperCase("de")
      .slice(0, 4);
  }
  return clean.slice(0, 3);
}

export function resolveFit(fit: NameFit, narrow: boolean): NameMode {
  if (fit === "short" || fit === "long" || fit === "scroll") return fit;
  return narrow ? "short" : "long";
}

export function shownName(full: string, brief: string | undefined, kind: "subject" | "teacher", mode: NameMode): string {
  const long = full.trim();
  if (mode !== "short") return long;
  const given = brief?.trim() ?? "";
  if (given && given.toLocaleLowerCase("de") !== long.toLocaleLowerCase("de")) return given;
  const made = kind === "subject" ? shortenSubject(long) : shortenTeacher(long);
  return made || long;
}

type NamedLesson = Pick<Lesson, "subject" | "subjectShort" | "teacher" | "teacherShort" | "originalTeacher" | "originalTeacherShort">;

export function lessonSubject(lesson: Pick<Lesson, "subject" | "subjectShort">, mode: NameMode): string {
  return shownName(lesson.subject, lesson.subjectShort, "subject", mode);
}

export function lessonTeacher(lesson: NamedLesson, mode: NameMode): string {
  if (!lesson.teacher.trim()) return "";
  const pick: NameMode = mode === "short" ? "short" : "long";
  const main = shownName(lesson.teacher, lesson.teacherShort, "teacher", pick);
  if (!lesson.originalTeacher.trim()) return main;
  const instead = shownName(lesson.originalTeacher, lesson.originalTeacherShort, "teacher", pick);
  return `${main} statt ${instead}`;
}
