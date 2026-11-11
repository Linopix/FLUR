import { Link } from "@tanstack/react-router";
import {
  Bike,
  Bus,
  CalendarDays,
  Car,
  ChevronRight,
  Copy,
  Check,
  Footprints,
  Mail,
  Maximize2,
  Settings as SettingsIcon,
  Train,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DEMO_LESSONS, lessonSpan } from "@/lib/flur/demo";
import { emptySettings } from "@/lib/flur/settings";
import { MODE_LABEL, type Lesson, type Mode, type Settings, type TripLeg, type TripPlan } from "@/lib/flur/types";
import { berlinParts, formatClock, formatDay, formatInstant, formatMinutes } from "@/lib/flur/time";
import { useFlur } from "@/components/flur/use-flur";

type View = "heute" | "wege" | "post" | "setup";
type Leg = "hin" | "heim";

const NAV: Array<{ id: View; label: string; icon: typeof Train }> = [
  { id: "heute", label: "Heute", icon: CalendarDays },
  { id: "wege", label: "Wege", icon: Train },
  { id: "post", label: "Post", icon: Mail },
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
    { id: "bus", label: "Bus", icon: Bus },
    { id: "car", label: "Auto", icon: Car },
    { id: "bike", label: "Fahrrad", icon: Bike },
    { id: "walk", label: "Zu Fuß", icon: Footprints },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Weg zum Bahnhof">
      {items.map((item) => {
        const Icon = item.icon;
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.id)}
            className={
              "flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors " +
              (active
                ? "border-chalk bg-chalk text-chalk-ink"
                : "border-line bg-ink text-paper hover:border-chalk")
            }
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function LessonRow({ lesson, minutes }: { lesson: Lesson; minutes: number | null }) {
  const current =
    minutes != null && lesson.status !== "cancelled" && lesson.startMin <= minutes && minutes < lesson.endMin;
  const past = minutes != null && minutes >= lesson.endMin;
  const badge = statusLabel(lesson);
  const rail =
    lesson.status === "cancelled" ? "bg-rust" : current ? "bg-chalk" : past ? "bg-line" : "bg-chalk/50";
  return (
    <li
      className={
        "grid grid-cols-[4.25rem_0.5rem_minmax(0,1fr)] items-stretch gap-3 rounded-xl px-2 py-3 " +
        (current ? "bg-ink" : "")
      }
    >
      <div
        className={
          "pt-0.5 text-right font-display text-lg leading-none tabular-nums " + (past ? "text-mist" : "text-paper")
        }
      >
        <div>{formatMinutes(lesson.startMin)}</div>
        <div className="mt-1 text-sm text-mist">{formatMinutes(lesson.endMin)}</div>
      </div>
      <div className={"my-1 h-full w-1 justify-self-center rounded-full " + rail} />
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h3
            className={
              "truncate text-lg font-medium " +
              (lesson.status === "cancelled" ? "text-mist line-through" : past ? "text-mist" : "text-paper")
            }
          >
            {lesson.subject}
          </h3>
          {lesson.room ? <span className="shrink-0 text-sm text-mist">{lesson.room}</span> : null}
        </div>
        <p className="mt-1 truncate text-sm text-mist">
          {lesson.originalTeacher
            ? `${lesson.teacher} statt ${lesson.originalTeacher}`
            : lesson.teacher || "Lehrkraft offen"}
        </p>
        {badge ? (
          <p className={"mt-1.5 text-sm font-medium " + (lesson.status === "cancelled" ? "text-rust" : "text-chalk")}>
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
    <li className="flex items-center gap-3 px-3 py-1 text-sm text-mist">
      <span className="h-px flex-1 bg-line" />
      Pause {minutes} Min
      <span className="h-px flex-1 bg-line" />
    </li>
  );
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
            (trip.punctual ? "bg-chalk text-chalk-ink" : "bg-rust text-ink")
          }
        >
          {trip.punctual ? "pünktlich" : "Verspätung"}
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
            (trip.punctual ? "bg-chalk text-chalk-ink" : "bg-rust text-ink")
          }
        >
          {trip.punctual ? "pünktlich" : "Verspätung"}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-pretty text-sm text-mist">{trip.headline}</p>
    </>
  ) : (
    <TripBody trip={trip} />
  );

  if (!onOpen) {
    return <div className="rounded-board border border-line bg-panel p-5">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-board border border-line bg-panel p-5 text-left transition-colors hover:border-chalk"
    >
      <span className="mb-3 flex items-center justify-between text-sm font-medium text-paper">
        {title}
        <ChevronRight className="size-4 text-mist" aria-hidden="true" />
      </span>
      {body}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-mist">
      {label}
      {children}
    </label>
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
  const [view, setView] = useState<View>("heute");
  const [leg, setLeg] = useState<Leg>("hin");
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<Settings>(flur.settings);
  const minutes = flur.now ? berlinParts(flur.now).minutes : null;
  const usingDemo = !flur.boardLive && !flur.today.lessons.length;
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

  useEffect(() => {
    setDraft(flur.settings);
  }, [flur.settings]);

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
    lessons.forEach((lesson, index) => {
      rows.push({ kind: "lesson", lesson });
      const next = lessons[index + 1];
      if (!next) return;
      const gap = next.startMin - lesson.endMin;
      if (gap >= 10) rows.push({ kind: "break", minutes: gap, at: lesson.endMin });
    });
    return rows;
  }, [lessons]);

  const letter = digestText({ dateLabel, lessons, hin: flur.hin, heim: flur.heim });

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

  function openLeg(next: Leg) {
    setLeg(next);
    setView("wege");
  }

  const sourceLabel = flur.boardError
    ? "WebUntis nicht erreichbar"
    : flur.boardLive
      ? "Live aus WebUntis"
      : flur.boardLoading
        ? "Wird geladen"
        : "Beispieltag";

  const kicker =
    focus?.kind === "now" ? "Jetzt" : focus?.kind === "tomorrow" ? "Morgen früh" : focus ? "Als Nächstes" : "Heute";

  return (
    <div className="flur-page min-h-dvh text-paper">
      <header className="flex items-start justify-between gap-4 px-4 pt-5 md:px-8 md:pt-8">
        <div className="min-w-0">
          <p className="font-display text-sm tracking-widest text-chalk">FLUR</p>
          <h1 className="mt-2 font-display text-3xl leading-none text-balance md:text-5xl">{weekday}</h1>
          {rest ? <p className="mt-1 text-sm text-mist md:text-base">{rest}</p> : null}
          <p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-sm text-mist">
            <span
              className={
                "size-1.5 shrink-0 rounded-full " +
                (flur.boardError ? "bg-rust" : flur.boardLive ? "bg-chalk" : "bg-mist")
              }
              aria-hidden="true"
            />
            <span className="truncate">{sourceLabel}</span>
          </p>
        </div>
        <div className="flex items-start gap-2">
          <p className="font-display text-4xl tabular-nums leading-none tracking-tight md:text-6xl">
            {flur.now ? formatClock(flur.now) : "––:––"}
          </p>
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

      <nav className="mt-5 hidden flex-wrap items-center gap-2 px-8 md:flex" aria-label="Ansichten">
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
                "flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors " +
                (active ? "border-chalk bg-chalk text-chalk-ink" : "border-line text-paper hover:border-chalk")
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
        <Link
          to="/uhr"
          className="flex h-11 items-center rounded-full border border-line px-4 text-sm font-medium text-paper transition-colors hover:border-chalk"
        >
          Uhr
        </Link>
      </nav>

      <main className="px-4 py-5 md:px-8 md:py-6">
        {view === "heute" ? (
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)] lg:items-start lg:gap-5">
            <div className="contents lg:flex lg:flex-col lg:gap-5">
              <section className="order-1 rounded-board border border-line bg-panel p-5 md:p-6">
                <div className="flex items-end justify-between gap-4">
                  <p className="text-sm font-medium text-chalk">{kicker}</p>
                  {clock ? (
                    <p className="text-right leading-none">
                      <span className="block font-display text-5xl tabular-nums md:text-6xl">{clock.value}</span>
                      <span className="mt-1 block text-sm text-mist">{clock.unit}</span>
                    </p>
                  ) : null}
                </div>
                {focus ? (
                  <>
                    <h2 className="mt-2 font-display text-4xl text-balance md:text-5xl">{focus.lesson.subject}</h2>
                    <p className="mt-3 text-base text-mist">
                      {lessonSpan(focus.lesson)}
                      {" · "}
                      {focus.lesson.room ? `Raum ${focus.lesson.room}` : "Raum offen"}
                      {focus.lesson.teacher ? ` · ${focus.lesson.teacher}` : ""}
                    </p>
                  </>
                ) : (
                  <h2 className="mt-2 font-display text-4xl">Frei</h2>
                )}
                {flur.boardError ? <p className="mt-4 text-sm text-pretty text-rust">{flur.boardError}</p> : null}
              </section>

              <div className="order-2 grid gap-4">
                <TripCard trip={flur.hin} loading={flur.tripLoading && !flur.hin} compact onOpen={() => openLeg("hin")} />
                <TripCard trip={flur.heim} loading={flur.tripLoading && !flur.heim} compact onOpen={() => openLeg("heim")} />
              </div>

              <section className="order-3 rounded-board border border-line bg-panel p-5">
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
                          <p className={lesson.status === "cancelled" ? "text-rust" : "text-chalk"}>
                            {statusLabel(lesson)} · {lesson.subject}
                          </p>
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
              <h2 className="px-2 pt-1 text-sm text-mist">Stunden</h2>
              {lessons.length === 0 ? (
                <p className="px-2 py-6 text-pretty text-mist">Keine Stunden. Frei, Ferien oder noch nichts eingetragen.</p>
              ) : (
                <ol className="mt-1">
                  {breaks.map((row) =>
                    row.kind === "lesson" ? (
                      <LessonRow key={row.lesson.id} lesson={row.lesson} minutes={lookingAtToday ? minutes : null} />
                    ) : (
                      <BreakRow key={`break-${row.at}`} minutes={row.minutes} />
                    ),
                  )}
                </ol>
              )}
              {(schoolOver || !lookingAtToday) && flur.tomorrow.lessons.length > 0 ? (
                <div className="mt-2 border-t border-line px-2 pt-4">
                  <h3 className="text-sm text-mist">Morgen</h3>
                  <ul className="mt-1">
                    {flur.tomorrow.lessons.map((lesson) => (
                      <LessonRow key={lesson.id} lesson={lesson} minutes={null} />
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        {view === "wege" ? (
          <div className="mx-auto max-w-3xl space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-4xl">{leg === "hin" ? "Hinweg" : "Heimweg"}</h2>
                <p className="mt-2 max-w-xl text-pretty text-mist">
                  {leg === "hin"
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
          <form
            className="mx-auto max-w-2xl space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              flur.setSettings(draft);
              setView("heute");
            }}
          >
            <div>
              <h2 className="font-display text-4xl">Einstellungen</h2>
              <p className="mt-2 text-pretty text-mist">
                Zugangsdaten bleiben auf diesem Bildschirm. Am HDMI-Gerät lieber die Server-Variablen setzen, dann
                muss hier nichts eingetippt werden.
              </p>
              {flur.profile?.webuntis ? (
                <p className="mt-3 text-sm text-chalk">Server ist schon mit {flur.profile.school} verbunden.</p>
              ) : null}
            </div>

            <fieldset className="space-y-3 rounded-board border border-line bg-panel p-5">
              <legend className="bg-panel px-2 text-sm text-mist">WebUntis</legend>
              <Field label="Server">
                <input
                  className="flur-field"
                  value={draft.baseUrl}
                  onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
                  placeholder="mese.webuntis.com"
                  autoComplete="off"
                />
              </Field>
              <Field label="Schule">
                <input
                  className="flur-field"
                  value={draft.school}
                  onChange={(event) => setDraft({ ...draft, school: event.target.value })}
                  autoComplete="organization"
                />
              </Field>
              <Field label="Benutzer">
                <input
                  className="flur-field"
                  value={draft.user}
                  onChange={(event) => setDraft({ ...draft, user: event.target.value })}
                  autoComplete="username"
                />
              </Field>
              <Field label="Passwort">
                <input
                  className="flur-field"
                  type="password"
                  value={draft.password}
                  onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                  autoComplete="current-password"
                />
              </Field>
              <Field label="Plan von">
                <select
                  className="flur-field"
                  value={draft.who}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      who:
                        event.target.value === "class" || event.target.value === "teacher"
                          ? event.target.value
                          : "student",
                    })
                  }
                >
                  <option value="student">Schülerkonto</option>
                  <option value="class">Klasse</option>
                  <option value="teacher">Lehrkraft</option>
                </select>
              </Field>
              {draft.who !== "student" ? (
                <Field label={draft.who === "class" ? "Klasse" : "Kürzel"}>
                  <input
                    className="flur-field"
                    value={draft.whoName}
                    onChange={(event) => setDraft({ ...draft, whoName: event.target.value })}
                  />
                </Field>
              ) : null}
            </fieldset>

            <fieldset className="space-y-3 rounded-board border border-line bg-panel p-5">
              <legend className="bg-panel px-2 text-sm text-mist">Weg</legend>
              <Field label="Heimatadresse">
                <input
                  className="flur-field"
                  value={draft.homeAddress}
                  onChange={(event) => setDraft({ ...draft, homeAddress: event.target.value })}
                  autoComplete="street-address"
                />
              </Field>
              <Field label="Bahnhof">
                <input
                  className="flur-field"
                  value={draft.station}
                  onChange={(event) => setDraft({ ...draft, station: event.target.value })}
                  placeholder="Köln Süd"
                />
              </Field>
              <Field label="Halt an der Schule">
                <input
                  className="flur-field"
                  value={draft.schoolStop}
                  onChange={(event) => setDraft({ ...draft, schoolStop: event.target.value })}
                  placeholder="Köln Hbf"
                />
              </Field>
              <ModeSwitch mode={draft.mode} onChange={(mode) => setDraft({ ...draft, mode })} />
            </fieldset>

            <label className="flex min-h-12 items-center gap-3 rounded-board border border-line bg-panel px-5 py-4">
              <input
                type="checkbox"
                className="size-5 accent-chalk"
                checked={draft.kioskRotate}
                onChange={(event) => setDraft({ ...draft, kioskRotate: event.target.checked })}
              />
              <span>Am Bildschirm automatisch zwischen Heute, Hinweg und Heimweg wechseln</span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="h-12 rounded-xl bg-chalk px-5 font-medium text-chalk-ink">
                Speichern
              </button>
              <button
                type="button"
                className="h-12 rounded-xl border border-line px-5 transition-colors hover:border-chalk"
                onClick={() => {
                  flur.resetSettings();
                  setDraft(emptySettings());
                }}
              >
                Zurück zum Beispiel
              </button>
              <Link
                to="/uhr"
                className="flex h-12 items-center rounded-xl border border-line px-5 transition-colors hover:border-chalk"
              >
                Uhrenansicht
              </Link>
            </div>
          </form>
        ) : null}
      </main>

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
                "flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium " +
                (active ? "bg-chalk text-chalk-ink" : "text-mist")
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
