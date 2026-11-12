export type Who = "student" | "class" | "teacher";
export type Mode = "bus" | "car" | "bike" | "walk" | "drive" | "link";
export type LessonStatus = "regular" | "cancelled" | "substitution";
export type NameFit = "auto" | "short" | "long" | "scroll";
export type NameMode = "short" | "long" | "scroll";
export type ClockFace = "digital" | "analog";
export type DigitalDesign = "serif" | "split" | "led";
export type AnalogDesign = "chalk" | "ring" | "school";
export type ClockUnit = "auto" | "second" | "minute" | "hour";
export type ClockSize = "auto" | "s" | "m" | "l";

export type Lesson = {
  id: string;
  startMin: number;
  endMin: number;
  subject: string;
  subjectShort?: string;
  teacher: string;
  teacherShort?: string;
  originalTeacher: string;
  originalTeacherShort?: string;
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
  schoolAddress: string;
  mode: Mode | "";
  who: Who | "";
  whoName: string;
};

export type ThemeId = "chalk" | "glass";

export type LoginKind = "password" | "secret";

export type SchoolMatch = {
  displayName: string;
  loginName: string;
  server: string;
  address: string;
};

export type Settings = {
  baseUrl: string;
  school: string;
  schoolLabel: string;
  user: string;
  password: string;
  login: LoginKind;
  who: Who;
  whoName: string;
  homeAddress: string;
  station: string;
  schoolStop: string;
  schoolAddress: string;
  mode: Mode;
  kioskRotate: boolean;
  countdown: boolean;
  nameFit: NameFit;
  clockFace: ClockFace;
  clockDigital: DigitalDesign;
  clockAnalog: AnalogDesign;
  clockUnit: ClockUnit;
  clockSize: ClockSize;
  countdownOwn: boolean;
  countFace: ClockFace;
  countDigital: DigitalDesign;
  countAnalog: AnalogDesign;
  countUnit: ClockUnit;
  countSize: ClockSize;
  burnGuard: boolean;
  infoScreen: boolean;
  dense: boolean;
  theme: ThemeId;
  onboarded: boolean;
};

export const MODE_LABEL: Record<Mode, string> = {
  bus: "Bus",
  car: "Auto",
  bike: "Fahrrad",
  walk: "Zu Fuß",
  drive: "Nur Auto",
  link: "Anschluss",
};

export const MODE_HINT: Record<Mode, string> = {
  link: "Vergleicht Bus, Rad und Fuß an beiden Enden und nimmt die kürzere Tür-zu-Tür-Zeit.",
  bus: "Mit dem Bus zum Bahnhof, danach mit dem Zug.",
  bike: "Mit dem Rad zum Bahnhof, danach mit dem Zug.",
  walk: "Zu Fuß zum Bahnhof, danach mit dem Zug.",
  car: "Mit dem Auto zum Bahnhof, danach mit dem Zug.",
  drive: "Ganzer Weg mit dem Auto. Die Fahrzeit kommt aus dem Straßennetz, nicht aus einem Live-Stau.",
};

export const EXAMPLE_PLACES = {
  homeAddress: "Pantaleonswall 12, 50676 Köln",
  station: "Köln Süd",
  schoolStop: "Köln Hbf",
};

declare global {
  interface Window {
    flurBar?: {
      publish: (snapshot: { lesson: string; change: string; ride: string }) => void;
    };
  }
}
