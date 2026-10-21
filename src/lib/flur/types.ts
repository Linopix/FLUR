export type Who = "student" | "class" | "teacher";
export type Mode = "bus" | "car" | "bike" | "walk";
export type LessonStatus = "regular" | "cancelled" | "substitution";

export type Lesson = {
  id: string;
  startMin: number;
  endMin: number;
  subject: string;
  teacher: string;
  originalTeacher: string;
  room: string;
  info: string;
  status: LessonStatus;
};

export type DayBoard = {
  source: "live" | "demo";
  iso: string;
  lessons: Lesson[];
};

export type BoardResult =
  | { ok: true; source: "live" | "demo"; today: DayBoard; tomorrow: DayBoard }
  | { ok: false; error: string };

export type TripLeg = {
  mode: "walk" | "bike" | "car" | "bus" | "rail";
  title: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  delayMin: number;
  punctual: boolean;
  cancelled: boolean;
  platform: string;
};

export type TripPlan = {
  source: "live" | "demo";
  direction: "hin" | "heim";
  mode: Mode;
  punctual: boolean;
  leaveAt: string;
  arriveAt: string;
  headline: string;
  note: string;
  legs: TripLeg[];
  places: { home: string; station: string; schoolStop: string };
};

export type TripResult = { ok: true; trip: TripPlan } | { ok: false; error: string };

export type ServerProfile = {
  webuntis: boolean;
  school: string;
  home: string;
  station: string;
  schoolStop: string;
  mode: Mode | "";
  who: Who | "";
  whoName: string;
};

export type Settings = {
  baseUrl: string;
  school: string;
  user: string;
  password: string;
  who: Who;
  whoName: string;
  homeAddress: string;
  station: string;
  schoolStop: string;
  mode: Mode;
  kioskRotate: boolean;
};

export const MODE_LABEL: Record<Mode, string> = {
  bus: "Bus",
  car: "Auto",
  bike: "Fahrrad",
  walk: "Zu Fuß",
};

export const EXAMPLE_PLACES = {
  homeAddress: "Pantaleonswall 12, 50676 Köln",
  station: "Köln Süd",
  schoolStop: "Köln Hbf",
};
