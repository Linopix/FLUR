import { addDaysIso, berlinParts, formatMinutes } from "@/lib/flur/time";
import { EXAMPLE_PLACES, MODE_LABEL, type DayBoard, type Lesson, type Mode, type TripPlan } from "@/lib/flur/types";

const PERIODS: Array<Omit<Lesson, "id">> = [
  {
    startMin: 8 * 60,
    endMin: 8 * 60 + 45,
    subject: "Deutsch",
    teacher: "Keller",
    originalTeacher: "",
    room: "112",
    info: "",
    status: "regular",
  },
  {
    startMin: 8 * 60 + 50,
    endMin: 9 * 60 + 35,
    subject: "Mathematik",
    teacher: "Berger",
    originalTeacher: "",
    room: "204",
    info: "",
    status: "regular",
  },
  {
    startMin: 9 * 60 + 55,
    endMin: 10 * 60 + 40,
    subject: "Englisch",
    teacher: "Nowak",
    originalTeacher: "Lang",
    room: "118",
    info: "Vertretung",
    status: "substitution",
  },
  {
    startMin: 10 * 60 + 45,
    endMin: 11 * 60 + 30,
    subject: "Geschichte",
    teacher: "Hoffmann",
    originalTeacher: "",
    room: "210",
    info: "entfällt",
    status: "cancelled",
  },
  {
    startMin: 11 * 60 + 50,
    endMin: 12 * 60 + 35,
    subject: "Physik",
    teacher: "Aydin",
    originalTeacher: "",
    room: "020",
    info: "",
    status: "regular",
  },
  {
    startMin: 12 * 60 + 40,
    endMin: 13 * 60 + 25,
    subject: "Sport",
    teacher: "Krüger",
    originalTeacher: "",
    room: "Halle 2",
    info: "",
    status: "regular",
  },
];

export const DEMO_LESSONS: Lesson[] = PERIODS.map((lesson, index) => ({
  ...lesson,
  id: `demo-${index}`,
}));

export function demoBoard(which: "today" | "tomorrow", now = new Date()): DayBoard {
  const today = berlinParts(now).iso;
  const iso = which === "today" ? today : addDaysIso(today, 1);
  return {
    source: "demo",
    iso,
    lessons: DEMO_LESSONS.map((lesson) => ({ ...lesson, id: `${which}-${lesson.id}` })),
  };
}

function isoIn(minutesFromNow: number, now: Date): string {
  return new Date(now.getTime() + minutesFromNow * 60_000).toISOString();
}

export function demoTrip(direction: "hin" | "heim", mode: Mode, now = new Date()): TripPlan {
  const access = mode === "car" ? 8 : mode === "bike" ? 11 : mode === "walk" ? 22 : 16;
  const places = {
    home: "Pantaleonswall",
    station: EXAMPLE_PLACES.station,
    schoolStop: EXAMPLE_PLACES.schoolStop,
  };
  if (direction === "hin") {
    const leave = 18;
    const trainDep = leave + access + 5;
    const trainArr = trainDep + 9;
    return {
      source: "demo",
      direction,
      mode,
      punctual: true,
      leaveAt: isoIn(leave, now),
      arriveAt: isoIn(trainArr, now),
      headline: `${MODE_LABEL[mode]} zum Bahnhof, dann RB 24 pünktlich.`,
      note: "Beispielstrecke Köln Süd → Köln Hbf. In den Einstellungen auf deine Haltestellen umstellen.",
      places,
      legs: [
        {
          mode: mode === "bus" ? "bus" : mode,
          title: mode === "bus" ? "Bus 132" : MODE_LABEL[mode],
          from: places.home,
          to: places.station,
          departure: isoIn(leave, now),
          arrival: isoIn(leave + access, now),
          delayMin: 0,
          punctual: true,
          cancelled: false,
          platform: "",
        },
        {
          mode: "rail",
          title: "RB 24",
          from: places.station,
          to: places.schoolStop,
          departure: isoIn(trainDep, now),
          arrival: isoIn(trainArr, now),
          delayMin: 0,
          punctual: true,
          cancelled: false,
          platform: "3",
        },
      ],
    };
  }
  const trainDep = 12;
  const trainArr = 22;
  const homeArr = trainArr + access;
  return {
    source: "demo",
    direction,
    mode,
    punctual: true,
    leaveAt: isoIn(trainDep - 4, now),
    arriveAt: isoIn(homeArr, now),
    headline: `RB 48 pünktlich, dann ${MODE_LABEL[mode]} nach Hause.`,
    note: "Beispiel. Die Ankunft rechnet den Weg vom Bahnhof nach Hause dazu.",
    places,
    legs: [
      {
        mode: "rail",
        title: "RB 48",
        from: places.schoolStop,
        to: places.station,
        departure: isoIn(trainDep, now),
        arrival: isoIn(trainArr, now),
        delayMin: 0,
        punctual: true,
        cancelled: false,
        platform: "6",
      },
      {
        mode: mode === "bus" ? "bus" : mode,
        title: mode === "bus" ? "Bus 132" : MODE_LABEL[mode],
        from: places.station,
        to: "zu Hause",
        departure: isoIn(trainArr, now),
        arrival: isoIn(homeArr, now),
        delayMin: 0,
        punctual: true,
        cancelled: false,
        platform: "",
      },
    ],
  };
}

export function lessonSpan(lesson: Lesson): string {
  return `${formatMinutes(lesson.startMin)}–${formatMinutes(lesson.endMin)}`;
}
