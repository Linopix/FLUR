import { addDaysIso, berlinParts, formatMinutes } from "./time.ts";
import { EXAMPLE_PLACES, MODE_LABEL, type DayBoard, type Lesson, type Mode, type TripLeg, type TripPlan } from "./types.ts";

const PERIODS: Array<Omit<Lesson, "id">> = [
  {
    startMin: 8 * 60,
    endMin: 8 * 60 + 45,
    subject: "Deutsch",
    subjectShort: "D",
    teacher: "Keller",
    teacherShort: "Kel",
    originalTeacher: "",
    room: "112",
    info: "",
    status: "regular",
  },
  {
    startMin: 8 * 60 + 50,
    endMin: 9 * 60 + 35,
    subject: "Mathematik",
    subjectShort: "M",
    teacher: "Berger",
    teacherShort: "Ber",
    originalTeacher: "",
    room: "204",
    info: "",
    status: "regular",
  },
  {
    startMin: 9 * 60 + 55,
    endMin: 10 * 60 + 40,
    subject: "Englisch",
    subjectShort: "E",
    teacher: "Nowak",
    teacherShort: "Now",
    originalTeacher: "Lang",
    room: "118",
    info: "Vertretung",
    status: "substitution",
  },
  {
    startMin: 10 * 60 + 45,
    endMin: 11 * 60 + 30,
    subject: "Geschichte",
    subjectShort: "Ge",
    teacher: "Hoffmann",
    teacherShort: "Hof",
    originalTeacher: "",
    room: "210",
    info: "entfällt",
    status: "cancelled",
  },
  {
    startMin: 11 * 60 + 50,
    endMin: 12 * 60 + 35,
    subject: "Physik",
    subjectShort: "Ph",
    teacher: "Aydin",
    teacherShort: "Ayd",
    originalTeacher: "",
    room: "020",
    info: "",
    status: "regular",
  },
  {
    startMin: 12 * 60 + 40,
    endMin: 13 * 60 + 25,
    subject: "Sport",
    subjectShort: "Sp",
    teacher: "Krüger",
    teacherShort: "Krü",
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

function legMode(mode: Mode): TripLeg["mode"] {
  if (mode === "bus") return "bus";
  if (mode === "car" || mode === "drive") return "car";
  if (mode === "bike") return "bike";
  return "walk";
}

export function demoTrip(direction: "hin" | "heim", mode: Mode, now = new Date()): TripPlan {
  const places = {
    home: "Pantaleonswall",
    station: EXAMPLE_PLACES.station,
    schoolStop: EXAMPLE_PLACES.schoolStop,
  };
  if (mode === "drive") {
    const leave = direction === "hin" ? 22 : 6;
    const arrive = leave + 28;
    return {
      source: "demo",
      direction,
      mode,
      punctual: true,
      leaveAt: isoIn(leave, now),
      arriveAt: isoIn(arrive, now),
      headline: "Auto direkt · 12 km",
      note: "Beispiel. Ganzer Weg mit dem Auto. Die Fahrzeit kommt aus dem Straßennetz, nicht aus einem Live-Stau.",
      places: { ...places, station: "" },
      legs: [
        {
          mode: "car",
          title: "Auto · 12 km",
          from: direction === "hin" ? places.home : "Schule",
          to: direction === "hin" ? "Schule" : "zu Hause",
          departure: isoIn(leave, now),
          arrival: isoIn(arrive, now),
          delayMin: 0,
          punctual: true,
          cancelled: false,
          platform: "",
        },
      ],
    };
  }
  if (mode === "link") {
    if (direction === "hin") {
      return {
        source: "demo",
        direction,
        mode,
        punctual: true,
        leaveAt: isoIn(16, now),
        arriveAt: isoIn(52, now),
        headline: "Automatisch Bus und Bus, RB 24 pünktlich.",
        note: "Beispiel. Anschluss vergleicht Bus, Rad und Fuß an beiden Enden. Hier ist Bus plus Bus kürzer als Rad plus Fuß.",
        places,
        legs: [
          {
            mode: "bus",
            title: "Bus 132",
            from: places.home,
            to: places.station,
            departure: isoIn(16, now),
            arrival: isoIn(28, now),
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
            departure: isoIn(33, now),
            arrival: isoIn(42, now),
            delayMin: 0,
            punctual: true,
            cancelled: false,
            platform: "3",
          },
          {
            mode: "bus",
            title: "Bus 5",
            from: places.schoolStop,
            to: "Schule",
            departure: isoIn(44, now),
            arrival: isoIn(52, now),
            delayMin: 0,
            punctual: true,
            cancelled: false,
            platform: "",
          },
        ],
      };
    }
    return {
      source: "demo",
      direction,
      mode,
      punctual: true,
      leaveAt: isoIn(8, now),
      arriveAt: isoIn(43, now),
      headline: "Automatisch Bus und Fuß, RB 48 pünktlich.",
      note: "Beispiel. Auf dem Rückweg gewinnt Bus zum Halt und zu Fuß nach Hause.",
      places,
      legs: [
        {
          mode: "bus",
          title: "Bus 5",
          from: "Schule",
          to: places.schoolStop,
          departure: isoIn(8, now),
          arrival: isoIn(16, now),
          delayMin: 0,
          punctual: true,
          cancelled: false,
          platform: "",
        },
        {
          mode: "rail",
          title: "RB 48",
          from: places.schoolStop,
          to: places.station,
          departure: isoIn(18, now),
          arrival: isoIn(28, now),
          delayMin: 0,
          punctual: true,
          cancelled: false,
          platform: "6",
        },
        {
          mode: "walk",
          title: "Zu Fuß",
          from: places.station,
          to: "zu Hause",
          departure: isoIn(28, now),
          arrival: isoIn(43, now),
          delayMin: 0,
          punctual: true,
          cancelled: false,
          platform: "",
        },
      ],
    };
  }
  const access = mode === "car" ? 8 : mode === "bike" ? 11 : mode === "walk" ? 22 : 16;
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
          mode: legMode(mode),
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
        mode: legMode(mode),
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
