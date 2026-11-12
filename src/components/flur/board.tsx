import { Link } from "@tanstack/react-router";
import {
  Bike,
  BookOpen,
  Bus,
  CalendarDays,
  CalendarRange,
  Car,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Footprints,
  Mail,
  Maximize2,
  Route,
  Settings as SettingsIcon,
  Train,
} from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { SchoolView } from "@/components/flur/school";
import { Setup, type SetupStep } from "@/components/flur/setup";
import { useFlur } from "@/components/flur/use-flur";
import { WeekView } from "@/components/flur/week";
import { TimeFace, useNarrow } from "@/components/flur/clock-face";
import { DisplaySettings } from "@/components/flur/display-settings";
import { NameLine, useNameMode } from "@/components/flur/names";
import { DEMO_LESSONS, lessonSpan } from "@/lib/flur/demo";
import { daysBetween, downloadIcs, nextCountdown, nextOpenDay, toIcs } from "@/lib/flur/desk";
import { isAuthFailure } from "@/lib/flur/cache";
import { clockTextClass, resolveSize } from "@/lib/flur/clock";
import { lessonSubject, lessonTeacher, shortenSubject } from "@/lib/flur/names";
import { forgetProfile, loadProfiles, rememberProfile, type LocalProfile } from "@/lib/flur/profiles";
import { countdownClock, hasRoute, hasUntis } from "@/lib/flur/settings";
import { MODE_HINT, MODE_LABEL, type Lesson, type Mode, type NameMode, type TripLeg, type TripPlan } from "@/lib/flur/types";
import { addDaysIso, berlinParts, formatDay, formatInstant, formatMinutes } from "@/lib/flur/time";

type BarSnapshot = { lesson: string; change: string; ride: string };

function subscribeReduce(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function reduceNow() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let lastBar = "";

function publishBar(snapshot: BarSnapshot) {
  const bridge = typeof window === "undefined" ? undefined : window.flurBar;
  if (!bridge) return;
  const key = `${snapshot.lesson}\n${snapshot.change}\n${snapshot.ride}`;
  if (key === lastBar) return;
  lastBar = key;
  bridge.publish(snapshot);
}

type View = "heute" | "woche" | "wege" | "schule" | "post" | "setup";
type Leg = "hin" | "heim";

const NAV: Array<{ id: View; label: string; icon: typeof Train }> = [
  { id: "heute", label: "Heute", icon: CalendarDays },
  { id: "woche", label: "Woche", icon: CalendarRange },
  { id: "wege", label: "Wege", icon: Train },
  { id: "schule", label: "Schule", icon: BookOpen },
  { id: "setup", label: "Mehr", icon: SettingsIcon },
];

function statusLabel(lesson: Lesson): string {
  if (lesson.status === "cancelled") return "Entfällt";
  if (lesson.status === "substitution") return "Vertretung";
  return "";
}

function focusOf(lessons: Lesson[], minutes: number | null) {
  if (minutes == null) {
    const first = lessons.find((lesson) => lesson.status !== "cancelled");
    return first ? { kind: "next" as const, lesson: first } : null;
  }
  const current = lessons.find(
    (lesson) => lesson.status !== "cancelled" && lesson.startMin <= minutes && minutes < lesson.endMin,
  );
  if (current) return { kind: "now" as const, lesson: current };
  const upcoming = lessons.find((lesson) => lesson.status !== "cancelled" && lesson.startMin > minutes);
  if (upcoming) return { kind: "next" as const, lesson: upcoming };
  return null;
}

function splitDay(label: string) {
  const comma = label.indexOf(",");
  if (comma === -1) return { weekday: label, rest: "" };
  return { weekday: label.slice(0, comma), rest: label.slice(comma + 1).trim() };
}

function heroClock(kind: "now" | "next" | "tomorrow", lesson: Lesson, minutes: number | null) {
  if (kind === "tomorrow" || minutes == null) {
    return { value: formatMinutes(lesson.startMin), unit: kind === "tomorrow" ? "Morgen" : "Beginn" };
  }
  const delta = kind === "now" ? lesson.endMin - minutes : lesson.startMin - minutes;
  if (delta <= 0) return { value: "jetzt", unit: kind === "now" ? "endet" : "Beginn" };
  if (delta < 90) return { value: String(delta), unit: kind === "now" ? "Minuten noch" : "Minuten" };
  return {
    value: formatMinutes(kind === "now" ? lesson.endMin : lesson.startMin),
    unit: kind === "now" ? "endet um" : "Beginn",
  };
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const items: Array<{ id: Mode; label: string; icon: typeof Bus }> = [
    { id: "link", label: "Anschluss", icon: Route },
    { id: "bus", label: "Bus", icon: Bus },
    { id: "bike", label: "Rad", icon: Bike },
    { id: "walk", label: "Fuß", icon: Footprints },
    { id: "car", label: "Bahn+Auto", icon: Car },
    { id: "drive", label: "Nur Auto", icon: Car },
  ];
  return (
    <div className="space-y-2">
      <div className="apple-seg grid-cols-3 [&>button]:px-2 [&>button]:text-[13px]" role="radiogroup" aria-label="Weg">
        {items.map((item) => {
          const Icon = item.icon;
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={MODE_HINT[item.id]}
              onClick={() => onChange(item.id)}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>
      <p className="text-pretty text-sm text-mist">{MODE_HINT[mode]}</p>
    </div>
  );
}

function LessonRow({ lesson, minutes, names }: { lesson: Lesson; minutes: number | null; names: NameMode }) {
  const current =
    minutes != null && lesson.status !== "cancelled" && lesson.startMin <= minutes && minutes < lesson.endMin;
  const past = minutes != null && minutes >= lesson.endMin;
  const badge = statusLabel(lesson);
  const rail =
    lesson.status === "cancelled" ? "bg-signal-bad" : current ? "bg-accent" : past ? "bg-track" : "bg-soon";
  return (
    <li
      className={
        "flur-lesson grid grid-cols-[4.25rem_0.35rem_minmax(0,1fr)] items-stretch gap-3 rounded-xl px-3 py-3 " +
        (current ? "bg-now" : "")
      }
    >
      <div
        className={
          "pt-0.5 text-right text-base leading-none font-semibold tabular-nums tracking-tight " +
          (past || lesson.status === "cancelled" ? "text-secondary" : "text-label")
        }
      >
        <div>{formatMinutes(lesson.startMin)}</div>
        <div className="mt-1 text-sm font-medium text-secondary">{formatMinutes(lesson.endMin)}</div>
      </div>
      <div className={"my-1 h-full w-1 justify-self-center rounded-full " + rail} />
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h3
            className={
              "min-w-0 flex-1 text-lg font-semibold tracking-tight " +
              (lesson.status === "cancelled" ? "text-secondary line-through" : past ? "text-secondary" : "text-label")
            }
          >
            <NameLine text={lessonSubject(lesson, names)} label={lesson.subject} mode={names} />
          </h3>
          {lesson.room ? <span className="shrink-0 text-sm text-secondary">{lesson.room}</span> : null}
        </div>
        <div
          className={
            "mt-0.5 text-sm " + (lesson.status === "cancelled" || past ? "text-secondary" : "text-secondary")
          }
        >
          <NameLine
            text={lesson.teacher ? lessonTeacher(lesson, names) : "Lehrkraft offen"}
            label={lesson.teacher ? lessonTeacher(lesson, "long") : undefined}
            mode={names}
          />
        </div>
        {badge ? (
          <p className={"mt-1 text-sm font-semibold " + (lesson.status === "cancelled" ? "text-danger" : "text-accent")}>
            {badge}
            {lesson.info &&
            lesson.info.toLowerCase() !== "entfällt" &&
            lesson.info.toLowerCase() !== badge.toLowerCase()
              ? ` · ${lesson.info}`
              : ""}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function BreakRow({ minutes }: { minutes: number }) {
  return (
    <li className="flex items-center gap-3 px-3 py-1 text-xs font-medium text-tertiary">
      <span className="h-px flex-1 bg-separator" />
      Pause {minutes} Min
      <span className="h-px flex-1 bg-separator" />
    </li>
  );
}

function tripMark(trip: TripPlan): { label: string; good: boolean } {
  if (trip.mode === "drive") return { label: "Fahrzeit", good: true };
  return { label: trip.punctual ? "pünktlich" : "Verspätung", good: trip.punctual };
}

function legIcon(mode: TripLeg["mode"]) {
  if (mode === "rail") return Train;
  if (mode === "bus") return Bus;
  if (mode === "car") return Car;
  if (mode === "bike") return Bike;
  return Footprints;
}

function TripBody({ trip }: { trip: TripPlan }) {
  const when = trip.direction === "hin" ? trip.leaveAt : trip.arriveAt;
  const whenLabel = trip.direction === "hin" ? "Losgehen" : "Zu Hause";
  const mark = tripMark(trip);
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-mist">{whenLabel}</p>
          <p className="mt-1 font-display text-4xl tabular-nums leading-none md:text-5xl">{formatInstant(when)}</p>
        </div>
        <span
          className={
            "shrink-0 rounded-full px-3 py-1 text-sm font-medium " +
            (mark.good ? "bg-chalk text-chalk-ink" : "bg-rust text-ink")
          }
        >
          {mark.label}
        </span>
      </div>
      <p className="mt-3 text-pretty text-base">{trip.headline}</p>
      <ol className="mt-4">
        {trip.legs.map((leg, index) => {
          const Icon = legIcon(leg.mode);
          return (
            <li key={`${leg.title}-${leg.departure}-${index}`} className="grid grid-cols-[4.25rem_1.25rem_minmax(0,1fr)] gap-x-3">
              <div className="pt-0.5 text-right font-display text-base tabular-nums leading-none">
                <div>{formatInstant(leg.departure)}</div>
                <div className="mt-1 text-sm text-mist">{formatInstant(leg.arrival)}</div>
              </div>
              <div className="flex h-full flex-col items-center">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-chalk" />
                {index < trip.legs.length - 1 ? <span className="mt-1 w-px flex-1 bg-line" /> : null}
              </div>
              <div className="min-w-0 pb-4">
                <p className="flex items-center gap-2 font-medium">
                  <Icon className="size-4 shrink-0 text-chalk" aria-hidden="true" />
                  <span className="truncate">
                    {leg.title}
                    {leg.platform ? <span className="font-normal text-mist"> · {leg.platform}</span> : null}
                  </span>
                </p>
                <p className="mt-1 truncate text-sm text-mist">
                  {leg.from} → {leg.to}
                  {leg.delayMin > 0 ? ` · +${leg.delayMin} Min` : ""}
                  {leg.cancelled ? " · fällt aus" : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function TripCard({
  trip,
  loading,
  onOpen,
  compact = false,
}: {
  trip: TripPlan | null;
  loading: boolean;
  onOpen?: () => void;
  compact?: boolean;
}) {
  const when = trip ? (trip.direction === "hin" ? trip.leaveAt : trip.arriveAt) : "";
  const whenLabel = trip?.direction === "heim" ? "Zu Hause" : "Losgehen";
  const title = trip?.direction === "heim" ? "Heimweg" : "Hinweg";

  const body = !trip ? (
    <p className="text-sm text-mist">{loading ? "Verbindung wird gerechnet …" : "Noch keine Verbindung."}</p>
  ) : compact ? (
    <>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-mist">{whenLabel}</p>
          <p className="mt-1 font-display text-4xl tabular-nums leading-none">{formatInstant(when)}</p>
        </div>
        <span
          className={
            "shrink-0 rounded-full px-3 py-1 text-sm font-medium " +
            (tripMark(trip).good ? "bg-chalk text-chalk-ink" : "bg-rust text-ink")
          }
        >
          {tripMark(trip).label}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-pretty text-sm text-mist">{trip.headline}</p>
    </>
  ) : (
    <TripBody trip={trip} />
  );

  if (!onOpen) {
    return <div className="flur-pad rounded-board border border-line bg-panel p-5">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flur-pad w-full rounded-board border border-line bg-panel p-5 text-left transition-colors hover:border-chalk"
    >
      <span className="mb-3 flex items-center justify-between text-sm font-medium text-paper">
        {title}
        <ChevronRight className="size-4 text-mist" aria-hidden="true" />
      </span>
      {body}
    </button>
  );
}

function digestText(input: {
  dateLabel: string;
  lessons: Lesson[];
  hin: TripPlan | null;
  heim: TripPlan | null;
}): string {
  const changes = input.lessons.filter((lesson) => lesson.status !== "regular");
  const lines = [`FLUR · ${input.dateLabel}`, ""];
  if (input.lessons.length === 0) lines.push("Keine Stunden eingetragen.");
  else {
    lines.push("Stunden:");
    for (const lesson of input.lessons) {
      const flag =
        lesson.status === "cancelled" ? " ENTFÄLLT" : lesson.status === "substitution" ? " VERTRETUNG" : "";
      lines.push(
        `${lessonSpan(lesson)} ${lesson.subject}, ${lesson.teacher || "ohne Lehrkraft"}, ${lesson.room || "Raum offen"}${flag}`,
      );
    }
  }
  if (changes.length === 0) lines.push("", "Keine Änderungen.");
  if (input.hin) {
    lines.push(
      "",
      `Hinweg (${MODE_LABEL[input.hin.mode]}): los ${formatInstant(input.hin.leaveAt)}, an ${formatInstant(input.hin.arriveAt)}. ${input.hin.headline}`,
    );
  }
  if (input.heim) {
    lines.push(
      `Heimweg: los ${formatInstant(input.heim.leaveAt)}, zu Hause ${formatInstant(input.heim.arriveAt)}. ${input.heim.headline}`,
    );
  }
  return lines.join("\n");
}

export function Board() {
  const flur = useFlur();
  const names = useNameMode(flur.settings.nameFit);
  const narrow = useNarrow();
  const reduceMotion = useSyncExternalStore(subscribeReduce, reduceNow, () => false);
  const countStyle = countdownClock(flur.settings);
  const heroSize = resolveSize(flur.settings.clockSize, narrow);
  const drift = flur.settings.burnGuard && !reduceMotion;
  const [view, setView] = useState<View>("heute");
  const [leg, setLeg] = useState<Leg>("hin");
  const [copied, setCopied] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep | null>(null);
  const [dayShift, setDayShift] = useState(0);
  const [profiles, setProfiles] = useState<LocalProfile[]>([]);
  const minutes = flur.now ? berlinParts(flur.now).minutes : null;
  const signedIn = flur.deviceUntis || flur.serverUntis;
  const usingDemo = !signedIn && !flur.boardLive;
  const lessons = usingDemo ? DEMO_LESSONS : flur.today.lessons;
  const dateLabel = flur.now ? formatDay(berlinParts(flur.now).iso) : "Heute";
  const { weekday, rest } = splitDay(dateLabel);
  const lookingAtToday = !flur.today.iso || !flur.now || flur.today.iso === berlinParts(flur.now).iso;
  const todayFocus = lookingAtToday ? focusOf(lessons, minutes) : null;
  const tomorrowFirst = flur.tomorrow.lessons.find((lesson) => lesson.status !== "cancelled") ?? null;
  const focus = todayFocus ?? (tomorrowFirst ? { kind: "tomorrow" as const, lesson: tomorrowFirst } : null);
  const schoolOver = lookingAtToday && minutes != null && !todayFocus && Boolean(tomorrowFirst);
  const changes = lessons.filter((lesson) => lesson.status !== "regular");
  const clock = focus ? heroClock(focus.kind, focus.lesson, minutes) : null;
  const countdownDays =
    flur.desk?.days.length
      ? flur.desk.days
      : [
          flur.today.iso ? { iso: flur.today.iso, lessons } : null,
          flur.tomorrow.iso ? { iso: flur.tomorrow.iso, lessons: flur.tomorrow.lessons } : null,
        ].filter((day): day is { iso: string; lessons: Lesson[] } => Boolean(day?.iso));
  const countdown = flur.settings.countdown && flur.now ? nextCountdown(flur.now, countdownDays) : null;
  const remainMs = countdown && flur.now ? countdown.at - flur.now.getTime() : null;
  const countdownName = (() => {
    if (!countdown) return "";
    const lesson = countdownDays
      .find((day) => day.iso === countdown.iso)
      ?.lessons.find((item) => item.subject === countdown.subject);
    if (lesson) return lessonSubject(lesson, names);
    return names === "short" ? shortenSubject(countdown.subject) : countdown.subject;
  })();
  const todayIso = flur.now ? berlinParts(flur.now).iso : "";
  const selectedIso = todayIso ? addDaysIso(todayIso, dayShift) : "";
  const shifted = dayShift !== 0;
  const listLessons = !shifted
    ? lessons
    : (flur.desk?.days.find((day) => day.iso === selectedIso)?.lessons ?? []);
  const listMinutes = !shifted && lookingAtToday ? minutes : null;
  const later = !focus && todayIso && flur.desk ? nextOpenDay(flur.desk.days, addDaysIso(todayIso, 2)) : null;
  const lastIso = flur.desk?.days.at(-1)?.iso ?? "";
  const maxShift = todayIso && lastIso ? Math.max(0, daysBetween(todayIso, lastIso)) : 41;

  useEffect(() => {
    if (view === "setup") setProfiles(loadProfiles());
  }, [view]);

  useEffect(() => {
    if (!flur.settings.kioskRotate) return;
    if (view !== "heute" && view !== "wege") return;
    const id = window.setInterval(() => {
      if (view === "heute") {
        setLeg("hin");
        setView("wege");
        return;
      }
      if (leg === "hin") setLeg("heim");
      else setView("heute");
    }, 45_000);
    return () => window.clearInterval(id);
  }, [flur.settings.kioskRotate, leg, view]);

  const breaks = useMemo(() => {
    const rows: Array<{ kind: "lesson"; lesson: Lesson } | { kind: "break"; minutes: number; at: number }> = [];
    listLessons.forEach((lesson, index) => {
      rows.push({ kind: "lesson", lesson });
      const next = listLessons[index + 1];
      if (!next) return;
      const gap = next.startMin - lesson.endMin;
      if (gap >= 10) rows.push({ kind: "break", minutes: gap, at: lesson.endMin });
    });
    return rows;
  }, [listLessons]);

  const letter = digestText({ dateLabel, lessons, hin: flur.hin, heim: flur.heim });

  useEffect(() => {
    const lesson = focus
      ? `${focus.lesson.subject} ${formatMinutes(focus.lesson.startMin)}–${formatMinutes(focus.lesson.endMin)}`
      : later
        ? `Unterricht ab ${formatDay(later.iso)}`
        : "Frei";
    const changed = changes.find((item) => item.status === "substitution") ?? changes.find((item) => item.status === "cancelled");
    const change = !changed
      ? ""
      : changed.status === "cancelled"
        ? `${changed.subject} entfällt`
        : `Vertretung ${changed.subject}${changed.originalTeacher ? `: ${changed.teacher} statt ${changed.originalTeacher}` : changed.teacher ? `: ${changed.teacher}` : ""}`;
    const rail = flur.hin?.legs.find((item) => item.mode === "rail");
    const ride =
      flur.route.mode === "drive" && flur.hin
        ? `Auto ${formatInstant(flur.hin.leaveAt)}`
        : rail
          ? rail.cancelled
            ? `${rail.title} fällt aus`
            : rail.delayMin > 0
              ? `${rail.title} +${rail.delayMin}`
              : `${rail.title} pünktlich ${formatInstant(rail.departure)}`
          : flur.tripLoading
            ? "Zug wird geladen"
            : "";
    publishBar({ lesson, change, ride });
  }, [changes, flur.hin, flur.route.mode, flur.tripLoading, focus, later]);

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }

  function exportCalendar() {
    if (!flur.desk) return;
    downloadIcs(toIcs(flur.desk, flur.now ?? new Date()));
  }

  function openLeg(next: Leg) {
    setLeg(next);
    setView("wege");
  }

  const authError = Boolean(flur.boardError && isAuthFailure(flur.boardError));
  const sourceLabel = authError
    ? "Anmeldung abgelehnt"
    : flur.boardError
      ? "WebUntis nicht erreichbar"
      : flur.boardOffline
        ? "Offline, zuletzt gespeichert"
        : flur.boardLive
          ? "Live aus WebUntis"
          : flur.boardLoading && flur.boardFromCache
            ? "Wird aktualisiert"
            : flur.boardFromCache
              ? "Zuletzt gespeichert"
              : flur.boardLoading
                ? "Wird geladen"
                : "Beispieltag";

  const kicker = authError
    ? "Zugang"
    : focus?.kind === "now"
      ? "Jetzt"
      : focus?.kind === "tomorrow"
        ? "Morgen früh"
        : focus
          ? "Als Nächstes"
          : later
            ? "Demnächst"
            : "Heute";

  const planStatus = authError
    ? "Anmeldung abgelehnt"
    : flur.boardError
      ? "Nicht erreichbar"
      : hasUntis(flur.settings)
      ? flur.settings.schoolLabel.trim() || flur.settings.school.trim() || "WebUntis"
      : flur.serverUntis
        ? flur.profile?.school || "Über den Server"
        : "Beispieltag";
  const routeStatus =
    hasRoute(flur.settings) || !flur.exampleRoute
      ? flur.route.mode === "drive"
        ? `${flur.route.schoolAddress || flur.route.schoolStop || "Schule"} · ${MODE_LABEL.drive}`
        : `${flur.route.station || "Bahnhof"} · ${MODE_LABEL[flur.route.mode]}`
      : "Beispielweg";

  if (!flur.hydrated) {
    return <div className="min-h-dvh" />;
  }

  if (!flur.settings.onboarded || setupStep) {
    return (
      <Setup
        step={setupStep ?? "welcome"}
        settings={flur.settings}
        profile={flur.profile}
        onStep={setSetupStep}
        onDone={(next) => {
          flur.setSettings({ ...next, onboarded: true });
          setSetupStep(null);
          setView("heute");
        }}
        onClose={flur.settings.onboarded ? () => setSetupStep(null) : undefined}
      />
    );
  }

  return (
    <div
      className={
        "flur-page min-h-dvh text-paper" +
        (drift ? " flur-drift" : "") +
        (flur.settings.infoScreen ? " flur-touch" : "") +
        (flur.settings.dense ? " flur-dense" : "")
      }
    >
      <div className="flur-stage relative">
      {drift ? <div className="flur-wash" aria-hidden="true" /> : null}
      <header className="relative z-10 flex items-start justify-between gap-4 px-4 pt-5 md:px-8 md:pt-8">
        <div className="min-w-0">
          <p className="font-display text-sm tracking-widest text-chalk">FLUR</p>
          <h1 className="mt-2 font-display text-3xl leading-none text-balance md:text-5xl">{weekday}</h1>
          {rest ? <p className="mt-1 text-sm text-mist md:text-base">{rest}</p> : null}
          <p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-sm text-mist">
            <span
              className={
                "size-1.5 shrink-0 rounded-full " +
                (authError ? "bg-rust" : flur.boardOffline ? "bg-mist" : flur.boardLive ? "bg-chalk" : "bg-mist")
              }
              aria-hidden="true"
            />
            <span className="truncate">{sourceLabel}</span>
          </p>
        </div>
        <div className="flex items-start gap-2">
          <TimeFace
            kind="rtc"
            now={flur.now}
            remainMs={null}
            face={flur.settings.clockFace}
            digital={flur.settings.clockDigital}
            analog={flur.settings.clockAnalog}
            unit={flur.settings.clockUnit}
            size={flur.settings.clockSize}
          />
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden size-12 items-center justify-center rounded-xl border border-line text-paper transition-colors hover:border-chalk md:flex"
            aria-label="Vollbild"
          >
            <Maximize2 className="size-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav className="flur-nav relative z-10 mt-5 hidden flex-wrap items-center gap-2 px-8 md:flex" aria-label="Ansichten">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-current={active ? "page" : undefined}
              className={
                "flur-tap flex items-center gap-2 rounded-full border font-medium " +
                (flur.settings.infoScreen ? "h-14 px-5 text-base" : "h-11 px-4 text-sm") +
                (active ? " border-chalk bg-chalk text-chalk-ink" : " border-line text-paper hover:border-chalk")
              }
            >
              <Icon className={flur.settings.infoScreen ? "size-5" : "size-4"} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
        <Link
          to="/uhr"
          className={
            "flur-tap flex items-center rounded-full border border-line font-medium text-paper hover:border-chalk " +
            (flur.settings.infoScreen ? "h-14 px-5 text-base" : "h-11 px-4 text-sm")
          }
        >
          Uhr
        </Link>
      </nav>

      <main className="relative z-10 px-4 py-5 md:px-8 md:py-6">
        <div key={view} className="flur-view">
        {view === "heute" ? (
          <div className="flur-board flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)] lg:items-start lg:gap-5">
            <div className="flur-stack contents lg:flex lg:flex-col lg:gap-5">
              <section className="flur-hero order-1 rounded-board border border-line bg-panel p-5 md:p-6">
                <div className="flex items-end justify-between gap-4">
                  <p className="text-sm font-medium text-chalk">{kicker}</p>
                  {countdown && remainMs != null ? (
                    <div className="text-right leading-none">
                      <TimeFace
                        kind="countdown"
                        now={flur.now}
                        remainMs={remainMs}
                        face={countStyle.face}
                        digital={countStyle.digital}
                        analog={countStyle.analog}
                        unit={countStyle.unit}
                        size={countStyle.size}
                      />
                      <span className="mt-1 block text-sm text-mist">
                        {countdown.phase === "end" ? `${countdownName} endet` : `bis ${countdownName}`}
                      </span>
                    </div>
                  ) : clock ? (
                    <p className="text-right leading-none">
                      <span className={"block font-display tabular-nums " + clockTextClass(heroSize)}>{clock.value}</span>
                      <span className="mt-1 block text-sm text-mist">{clock.unit}</span>
                    </p>
                  ) : null}
                </div>
                {authError ? (
                  <h2 className="mt-2 font-display text-4xl text-balance">Anmeldung</h2>
                ) : focus ? (
                  <>
                    <h2 className="mt-2 min-w-0">
                      <NameLine
                        text={lessonSubject(focus.lesson, names)}
                        label={focus.lesson.subject}
                        mode={names}
                        className="font-display text-4xl md:text-5xl"
                      />
                    </h2>
                    <p className="mt-3 text-base text-mist">
                      {lessonSpan(focus.lesson)}
                      {" · "}
                      {focus.lesson.room ? `Raum ${focus.lesson.room}` : "Raum offen"}
                    </p>
                    {focus.lesson.teacher ? (
                      <div className="mt-1 text-base text-mist">
                        <NameLine text={lessonTeacher(focus.lesson, names)} label={lessonTeacher(focus.lesson, "long")} mode={names} />
                      </div>
                    ) : null}
                  </>
                ) : later ? (
                  <>
                    <h2 className="mt-2 font-display text-4xl text-balance">Noch frei</h2>
                    <p className="mt-3 text-pretty text-base text-mist">Unterricht ab {formatDay(later.iso)}.</p>
                    <button
                      type="button"
                      className="mt-4 h-11 text-sm font-semibold text-chalk"
                      onClick={() => setDayShift(daysBetween(todayIso, later.iso))}
                    >
                      Ersten Schultag zeigen
                    </button>
                  </>
                ) : (
                  <h2 className="mt-2 font-display text-4xl">Frei</h2>
                )}
                {authError ? <p className="mt-4 text-sm text-pretty text-rust">{flur.boardError}</p> : null}
                {flur.boardError && !authError ? <p className="mt-4 text-sm text-pretty text-rust">{flur.boardError}</p> : null}
                {flur.boardOffline ? (
                  <p className="mt-4 text-sm text-pretty text-mist">Offline. Der letzte Stundenplan von diesem Gerät.</p>
                ) : null}
                {authError ? (
                  <button type="button" className="mt-3 h-11 text-sm font-semibold text-chalk" onClick={() => setSetupStep("login")}>
                    Zugang prüfen
                  </button>
                ) : null}
              </section>

              <div className="order-2 grid gap-4">
                <TripCard trip={flur.hin} loading={flur.tripLoading && !flur.hin} compact onOpen={() => openLeg("hin")} />
                <TripCard trip={flur.heim} loading={flur.tripLoading && !flur.heim} compact onOpen={() => openLeg("heim")} />
              </div>

              <section className="flur-pad order-3 rounded-board border border-line bg-panel p-5">
                <h2 className="text-sm text-mist">Änderungen</h2>
                {changes.length === 0 ? (
                  <p className="mt-3 text-pretty">Keine Vertretung. Nichts entfällt.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {changes.map((lesson) => (
                      <li key={lesson.id} className="flex gap-3">
                        <span
                          className={
                            "mt-1.5 size-2 shrink-0 rounded-full " +
                            (lesson.status === "cancelled" ? "bg-rust" : "bg-chalk")
                          }
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <NameLine
                            text={`${statusLabel(lesson)} · ${lessonSubject(lesson, names)}`}
                            label={`${statusLabel(lesson)} · ${lesson.subject}`}
                            mode={names}
                            className={lesson.status === "cancelled" ? "text-rust" : "text-chalk"}
                          />
                          <p className="text-sm text-mist">
                            {lessonSpan(lesson)}
                            {lesson.room ? ` · ${lesson.room}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="order-4 rounded-board border border-line bg-panel p-3 md:p-4 lg:sticky lg:top-6 lg:order-none">
              <div className="flex items-center justify-between gap-2 px-2 pt-1">
                <h2 className="text-sm text-mist">{shifted && selectedIso ? formatDay(selectedIso) : "Stunden"}</h2>
                <div className="flex">
                  <button
                    type="button"
                    aria-label="Voriger Tag"
                    className="flex size-11 items-center justify-center rounded-xl text-paper disabled:opacity-40"
                    disabled={dayShift <= -7}
                    onClick={() => setDayShift((value) => value - 1)}
                  >
                    <ChevronLeft className="size-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Nächster Tag"
                    className="flex size-11 items-center justify-center rounded-xl text-paper disabled:opacity-40"
                    disabled={dayShift >= maxShift}
                    onClick={() => setDayShift((value) => value + 1)}
                  >
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              {listLessons.length === 0 ? (
                <div className="px-2 py-6">
                  <p className="text-pretty text-mist">
                    {shifted && flur.deskLoading
                      ? "Wird geladen …"
                      : !shifted && later
                        ? `Keine Stunden heute. Unterricht ab ${formatDay(later.iso)}.`
                        : "Keine Stunden. Frei, Ferien oder noch nichts eingetragen."}
                  </p>
                  {!shifted && later ? (
                    <button
                      type="button"
                      className="mt-3 h-11 text-sm font-semibold text-chalk"
                      onClick={() => setDayShift(daysBetween(todayIso, later.iso))}
                    >
                      Diesen Tag zeigen
                    </button>
                  ) : null}
                </div>
              ) : (
                <ol className="mt-1">
                  {breaks.map((row) =>
                    row.kind === "lesson" ? (
                      <LessonRow key={row.lesson.id} lesson={row.lesson} minutes={listMinutes} names={names} />
                    ) : (
                      <BreakRow key={`break-${row.at}`} minutes={row.minutes} />
                    ),
                  )}
                </ol>
              )}
              {!shifted && (schoolOver || !lookingAtToday) && flur.tomorrow.lessons.length > 0 ? (
                <div className="mt-2 border-t border-line px-2 pt-4">
                  <h3 className="text-sm text-mist">Morgen</h3>
                  <ul className="mt-1">
                    {flur.tomorrow.lessons.map((lesson) => (
                      <LessonRow key={lesson.id} lesson={lesson} minutes={null} names={names} />
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        {view === "woche" ? (
          <WeekView
            desk={flur.desk}
            now={flur.now}
            loading={flur.deskLoading}
            error={flur.deskError}
            fromCache={flur.deskOffline}
            onExport={exportCalendar}
            names={names}
          />
        ) : null}

        {view === "schule" ? (
          <SchoolView desk={flur.desk} loading={flur.deskLoading} error={flur.deskError} fromCache={flur.deskOffline} names={names} />
        ) : null}

        {view === "wege" ? (
          <div className="mx-auto max-w-3xl space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-4xl">{leg === "hin" ? "Hinweg" : "Heimweg"}</h2>
                <p className="mt-2 max-w-xl text-pretty text-mist">
                  {flur.route.mode === "drive"
                    ? leg === "hin"
                      ? "Der ganze Weg mit dem Auto, rechtzeitig zur ersten Stunde. Gezeigt wird die Fahrzeit im Straßennetz, nicht der Live-Stau."
                      : "Nach der letzten Stunde direkt nach Hause. Dieselbe Fahrzeit aus dem Straßennetz, ohne Live-Stau."
                    : flur.route.mode === "link"
                      ? leg === "hin"
                        ? "Bus, Rad und Fuß werden an beiden Enden verglichen. Die kürzere Tür-zu-Tür-Zeit gewinnt, wenn sie noch rechtzeitig ankommt."
                        : "Vom Schulhaus zum Halt und vom Bahnhof nach Hause wird wieder die kürzere Kombination genommen."
                      : leg === "hin"
                        ? "So knapp wie möglich zur ersten Stunde, die nicht ausfällt. Danach noch der Weg ins Schulhaus."
                        : "Erst der Weg vom Schulhaus zur Haltestelle, dann die früheste Zugverbindung."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Richtung">
                {(
                  [
                    ["hin", "Zur Schule"],
                    ["heim", "Nach Hause"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={leg === id}
                    onClick={() => setLeg(id)}
                    className={
                      "h-12 rounded-xl border px-4 text-sm font-medium transition-colors " +
                      (leg === id ? "border-chalk bg-chalk text-chalk-ink" : "border-line text-paper hover:border-chalk")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ModeSwitch mode={flur.route.mode} onChange={flur.setMode} />
            {flur.tripError ? <p className="text-sm text-pretty text-rust">{flur.tripError}</p> : null}
            <TripCard
              trip={leg === "hin" ? flur.hin : flur.heim}
              loading={flur.tripLoading && !(leg === "hin" ? flur.hin : flur.heim)}
            />
            {(leg === "hin" ? flur.hin : flur.heim)?.note ? (
              <p className="text-pretty text-sm text-mist">{(leg === "hin" ? flur.hin : flur.heim)?.note}</p>
            ) : null}
          </div>
        ) : null}

        {view === "post" ? (
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-4xl">Morgenpost</h2>
                <p className="mt-1 text-sm text-mist">Text zum Kopieren. Versand ist noch nicht angeschlossen.</p>
              </div>
              <button
                type="button"
                onClick={() => void copyLetter()}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-chalk px-4 font-medium text-chalk-ink"
              >
                {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                {copied ? "Kopiert" : "Text kopieren"}
              </button>
            </div>
            <article className="rounded-board bg-paper p-6 text-chalk-ink md:p-8">
              <p className="text-sm font-medium">Vorlage</p>
              <pre className="mt-4 font-sans text-base leading-relaxed whitespace-pre-wrap">{letter}</pre>
            </article>
          </div>
        ) : null}

        {view === "setup" ? (
          <div className="mx-auto max-w-lg">
            <h2 className="font-display text-4xl">Einstellungen</h2>
            <p className="mt-2 text-pretty text-mist">Plan, Weg und wie die Tafel aussieht.</p>

            <div className="mt-6 overflow-hidden rounded-board border border-line bg-panel">
              <button
                type="button"
                onClick={() => setSetupStep("school")}
                className="flex w-full items-center justify-between gap-4 border-b border-line px-4 py-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block font-medium">Stundenplan</span>
                  <span className="mt-0.5 block truncate text-sm text-mist">{planStatus}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-mist" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setSetupStep("route")}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block font-medium">Weg</span>
                  <span className="mt-0.5 block truncate text-sm text-mist">{routeStatus}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-mist" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setView("post")}
              className="mt-4 flex w-full items-center justify-between rounded-board border border-line bg-panel px-4 py-4 text-left"
            >
              <span>
                <span className="flex items-center gap-2 font-medium">
                  <Mail className="size-4 text-chalk" aria-hidden="true" />
                  Morgenpost
                </span>
                <span className="mt-0.5 block text-sm text-mist">Tageszettel zum Kopieren</span>
              </span>
              <ChevronRight className="size-4 text-mist" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={exportCalendar}
              disabled={!flur.desk}
              className="mt-4 flex w-full items-center justify-between rounded-board border border-line bg-panel px-4 py-4 text-left disabled:opacity-40"
            >
              <span>
                <span className="block font-medium">Kalenderdatei</span>
                <span className="mt-0.5 block text-sm text-mist">Stunden und Prüfungen als .ics</span>
              </span>
              <ChevronRight className="size-4 text-mist" aria-hidden="true" />
            </button>

            <div className="mt-4 overflow-hidden rounded-board border border-line bg-panel">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4">
                <span>
                  <span className="block font-medium">Konten auf diesem Gerät</span>
                  <span className="mt-0.5 block text-sm text-mist">Wechsel zwischen Schule und Kind. Nichts verlässt das Gerät.</span>
                </span>
              </div>
              {profiles.map((profile) => (
                <div key={profile.id} className="flex items-center gap-2 border-b border-line px-4 py-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 py-2 text-left"
                    onClick={() => flur.setSettings(profile.settings)}
                  >
                    <span className="block truncate font-medium">{profile.name}</span>
                  </button>
                  <button
                    type="button"
                    className="h-11 px-2 text-sm text-mist"
                    onClick={() => setProfiles(forgetProfile(profile.id))}
                  >
                    Entfernen
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="h-12 w-full px-4 text-left text-sm font-medium text-chalk disabled:opacity-40"
                disabled={!hasUntis(flur.settings)}
                onClick={() => setProfiles(rememberProfile(flur.settings))}
              >
                Dieses Konto sichern
              </button>
            </div>

            <DisplaySettings
              settings={flur.settings}
              now={flur.now}
              remainMs={flur.settings.countdown ? remainMs : null}
              onChange={(patch) => flur.setSettings({ ...flur.settings, ...patch })}
            />

            <div className="mt-4 overflow-hidden rounded-board border border-line bg-panel">
              <label className="flex items-center gap-4 border-b border-line px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Platzoptimierung</span>
                  <span className="mt-0.5 block text-sm text-pretty text-mist">
                    Weniger Abstand, damit mehr Stunden auf die Tafel passen.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="apple-switch"
                  checked={flur.settings.dense}
                  onChange={(event) => flur.setSettings({ ...flur.settings, dense: event.target.checked })}
                />
              </label>
              <label className="flex items-center gap-4 border-b border-line px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Countdown</span>
                  <span className="mt-0.5 block text-sm text-pretty text-mist">Bis zur nächsten Stunde, auch über Tage.</span>
                </span>
                <input
                  type="checkbox"
                  className="apple-switch"
                  checked={flur.settings.countdown}
                  onChange={(event) => flur.setSettings({ ...flur.settings, countdown: event.target.checked })}
                />
              </label>
              <label className="flex items-center gap-4 border-b border-line px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Infobildschirm</span>
                  <span className="mt-0.5 block text-sm text-pretty text-mist">
                    Größere Menüpunkte. Schaltet Wechsel und Einbrennschutz ein.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="apple-switch"
                  checked={flur.settings.infoScreen}
                  onChange={(event) => {
                    const on = event.target.checked;
                    flur.setSettings({
                      ...flur.settings,
                      infoScreen: on,
                      ...(on ? { kioskRotate: true, burnGuard: true } : {}),
                    });
                  }}
                />
              </label>
              <label className="flex items-center gap-4 border-b border-line px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Automatisch wechseln</span>
                  <span className="mt-0.5 block text-sm text-pretty text-mist">Heute, Hinweg und Heimweg im Wechsel.</span>
                </span>
                <input
                  type="checkbox"
                  className="apple-switch"
                  checked={flur.settings.kioskRotate}
                  onChange={(event) => flur.setSettings({ ...flur.settings, kioskRotate: event.target.checked })}
                />
              </label>
              <label className="flex items-center gap-4 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Gegen Einbrennen</span>
                  <span className="mt-0.5 block text-sm text-pretty text-mist">Die Tafel rückt langsam ein paar Pixel.</span>
                </span>
                <input
                  type="checkbox"
                  className="apple-switch"
                  checked={flur.settings.burnGuard}
                  onChange={(event) => flur.setSettings({ ...flur.settings, burnGuard: event.target.checked })}
                />
              </label>
            </div>

            <Link
              to="/uhr"
              className="mt-4 flex items-center justify-between rounded-board border border-line bg-panel px-4 py-4"
            >
              <span>
                <span className="block font-medium">Uhrenansicht</span>
                <span className="mt-0.5 block text-sm text-mist">Nur Uhr, Stunde und Zug</span>
              </span>
              <ChevronRight className="size-4 text-mist" aria-hidden="true" />
            </Link>

            <button
              type="button"
              className="mt-6 h-12 text-sm font-medium text-chalk"
              onClick={() => setSetupStep("welcome")}
            >
              Einrichtung wiederholen
            </button>
            <button
              type="button"
              className="h-11 text-sm font-medium text-mist"
              onClick={() => flur.resetSettings()}
            >
              Beispieltag laden
            </button>
          </div>
        ) : null}
        </div>
      </main>
      </div>

      <nav className="flur-dock md:hidden" aria-label="Ansichten">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-current={active ? "page" : undefined}
              className={
                "flur-tap flex flex-col items-center justify-center gap-1 rounded-2xl font-medium " +
                (flur.settings.infoScreen ? "h-[4.35rem] text-[13px]" : "h-14 text-xs") +
                (active ? " bg-chalk text-chalk-ink" : " text-mist")
              }
            >
              <Icon className={flur.settings.infoScreen ? "size-6" : "size-5"} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
