import { Link } from "@tanstack/react-router";
import {
  Bike,
  Bus,
  CalendarDays,
  Car,
  Footprints,
  House,
  Mail,
  Maximize2,
  Settings as SettingsIcon,
  Train,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DEMO_LESSONS, lessonSpan } from "@/lib/flur/demo";
import { emptySettings } from "@/lib/flur/settings";
import { MODE_LABEL, type Lesson, type Mode, type Settings, type TripPlan } from "@/lib/flur/types";
import { berlinParts, formatClock, formatDay, formatInstant, formatMinutes } from "@/lib/flur/time";
import { useFlur } from "@/components/flur/use-flur";

type View = "heute" | "hin" | "heim" | "post" | "setup";

const NAV: Array<{ id: View; label: string; short: string; icon: typeof Train }> = [
  { id: "heute", label: "Heute", short: "Heute", icon: CalendarDays },
  { id: "hin", label: "Hinweg", short: "Hinweg", icon: Train },
  { id: "heim", label: "Heimweg", short: "Heimweg", icon: House },
  { id: "post", label: "Post", short: "Post", icon: Mail },
  { id: "setup", label: "Einstellungen", short: "Daten", icon: SettingsIcon },
];

const fieldClass =
  "h-12 w-full rounded-lg border border-line bg-ink px-3 text-base text-paper outline-none focus:border-chalk";

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
              "flex h-12 items-center justify-center gap-2 rounded-lg border text-sm font-medium " +
              (active
                ? "border-chalk bg-chalk text-chalk-ink"
                : "border-line bg-panel text-paper hover:border-chalk")
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
  return (
    <li
      className={
        "rounded-lg border px-4 py-3 " +
        (current ? "border-chalk bg-ink" : "border-transparent") +
        (past ? " opacity-50" : "")
      }
    >
      <div className="flex gap-4">
        <div className="w-16 shrink-0 font-display text-xl leading-none tabular-nums text-paper">
          <div>{formatMinutes(lesson.startMin)}</div>
          <div className="mt-1 text-sm text-mist">{formatMinutes(lesson.endMin)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3
              className={
                "truncate text-xl font-medium " + (lesson.status === "cancelled" ? "text-mist line-through" : "")
              }
            >
              {lesson.subject}
            </h3>
            <span className="shrink-0 text-sm text-mist">{lesson.room}</span>
          </div>
          <p className="mt-1 text-sm text-mist">
            {lesson.originalTeacher
              ? `${lesson.teacher} statt ${lesson.originalTeacher}`
              : lesson.teacher || "Lehrkraft offen"}
          </p>
          {badge ? (
            <p className={"mt-2 text-sm font-medium " + (lesson.status === "cancelled" ? "text-rust" : "text-chalk")}>
              {badge}
              {lesson.info && lesson.info !== "entfällt" ? ` · ${lesson.info}` : ""}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function TripCard({ trip, loading }: { trip: TripPlan | null; loading: boolean }) {
  if (!trip) {
    return (
      <div className="rounded-board border border-line bg-panel p-5">
        <p className="text-sm text-mist">{loading ? "Verbindung wird gerechnet …" : "Noch keine Verbindung."}</p>
      </div>
    );
  }
  return (
    <div className="rounded-board border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm uppercase tracking-widest text-mist">
          {trip.direction === "hin" ? "Losgehen" : "Ankunft zu Hause"}
        </p>
        <span
          className={
            "rounded-full px-3 py-1 text-sm font-medium " +
            (trip.punctual ? "bg-chalk text-chalk-ink" : "bg-rust text-ink")
          }
        >
          {trip.punctual ? "pünktlich" : "Verspätung"}
        </span>
      </div>
      <p className="mt-2 font-display text-5xl tabular-nums leading-none md:text-6xl">
        {formatInstant(trip.direction === "hin" ? trip.leaveAt : trip.arriveAt)}
      </p>
      <p className="mt-3 text-pretty text-lg">{trip.headline}</p>
      <ol className="mt-5 space-y-3">
        {trip.legs.map((leg, index) => (
          <li key={`${leg.title}-${leg.departure}-${index}`} className="grid grid-cols-[4.5rem_1fr] gap-3">
            <div className="font-display text-lg tabular-nums leading-none">
              <div>{formatInstant(leg.departure)}</div>
              <div className="mt-1 text-sm text-mist">{formatInstant(leg.arrival)}</div>
            </div>
            <div className="min-w-0">
              <p className="font-medium">
                {leg.title}
                {leg.platform ? <span className="text-mist"> · {leg.platform}</span> : null}
              </p>
              <p className="truncate text-sm text-mist">
                {leg.from} → {leg.to}
                {leg.delayMin > 0 ? ` · +${leg.delayMin} Min` : ""}
                {leg.cancelled ? " · fällt aus" : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {trip.note ? <p className="mt-4 text-pretty text-sm text-mist">{trip.note}</p> : null}
    </div>
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
  lines.push("", "Automatischer Mailversand ist noch nicht angeschlossen. Dieser Text ist die Vorlage.");
  return lines.join("\n");
}

export function Board() {
  const flur = useFlur();
  const [view, setView] = useState<View>("heute");
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<Settings>(flur.settings);
  const minutes = flur.now ? berlinParts(flur.now).minutes : null;
  const lessons = flur.today.lessons.length ? flur.today.lessons : DEMO_LESSONS;
  const dateLabel = flur.now ? formatDay(berlinParts(flur.now).iso) : "Heute";
  const lookingAtToday = !flur.today.iso || !flur.now || flur.today.iso === berlinParts(flur.now).iso;
  const todayFocus = lookingAtToday ? focusOf(lessons, minutes) : null;
  const tomorrowFirst = flur.tomorrow.lessons.find((lesson) => lesson.status !== "cancelled") ?? null;
  const focus = todayFocus ?? (tomorrowFirst ? { kind: "tomorrow" as const, lesson: tomorrowFirst } : null);
  const schoolOver = lookingAtToday && minutes != null && !todayFocus && Boolean(tomorrowFirst);
  const changes = lessons.filter((lesson) => lesson.status !== "regular");

  useEffect(() => {
    setDraft(flur.settings);
  }, [flur.settings]);

  useEffect(() => {
    if (!flur.settings.kioskRotate) return;
    if (view !== "heute" && view !== "hin" && view !== "heim") return;
    const id = window.setInterval(() => {
      setView((current) => (current === "heute" ? "hin" : current === "hin" ? "heim" : "heute"));
    }, 45_000);
    return () => window.clearInterval(id);
  }, [flur.settings.kioskRotate, view]);

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

  const sourceLabel = flur.boardError
    ? "WebUntis Fehler"
    : flur.boardLive
      ? "WebUntis"
      : flur.boardLoading
        ? "lädt"
        : "Beispieltag";

  return (
    <div className="min-h-dvh bg-ink pb-24 text-paper md:pb-8">
      <header className="flex items-start justify-between gap-4 px-4 pt-6 md:px-8 md:pt-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-chalk">Flur</p>
          <h1 className="mt-1 font-display text-3xl text-balance capitalize md:text-4xl">{dateLabel}</h1>
          <p className="mt-1 text-sm text-mist">{sourceLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="font-display text-3xl tabular-nums md:text-5xl" aria-live="polite">
            {flur.now ? formatClock(flur.now) : "––:––"}
          </p>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden h-12 w-12 items-center justify-center rounded-lg border border-line text-paper hover:border-chalk md:flex"
            aria-label="Vollbild"
          >
            <Maximize2 className="size-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <nav className="mt-5 hidden gap-2 px-8 md:flex" aria-label="Ansichten">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={
                "flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium " +
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
          className="flex h-11 items-center rounded-full border border-line px-4 text-sm font-medium text-paper hover:border-chalk"
        >
          Uhr
        </Link>
      </nav>

      <main className="px-4 py-5 md:px-8 md:py-6">
        {view === "heute" ? (
          <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)_22rem] lg:items-start">
            <section className="rounded-board border border-line bg-panel p-5">
              <p className="text-sm uppercase tracking-widest text-mist">
                {focus?.kind === "now" ? "Jetzt" : focus?.kind === "tomorrow" ? "Morgen früh" : "Als Nächstes"}
              </p>
              {focus ? (
                <>
                  <h2 className="mt-2 font-display text-4xl text-balance">{focus.lesson.subject}</h2>
                  <p className="mt-2 text-lg tabular-nums">{lessonSpan(focus.lesson)}</p>
                  <p className="mt-1 text-mist">
                    {focus.lesson.room ? `Raum ${focus.lesson.room}` : "Raum offen"}
                    {focus.lesson.teacher ? ` · ${focus.lesson.teacher}` : ""}
                  </p>
                </>
              ) : (
                <h2 className="mt-2 font-display text-4xl">Frei</h2>
              )}
              {flur.boardError ? <p className="mt-4 text-sm text-rust">{flur.boardError}</p> : null}
            </section>

            <section className="rounded-board border border-line bg-panel p-3 md:p-4">
              <h2 className="px-2 pt-1 text-sm uppercase tracking-widest text-mist">Stunden</h2>
              {lessons.length === 0 ? (
                <p className="px-2 py-6 text-mist">Keine Stunden. Frei, Ferien oder noch nichts eingetragen.</p>
              ) : (
                <ol className="mt-2">
                  {breaks.map((row) =>
                    row.kind === "lesson" ? (
                      <LessonRow key={row.lesson.id} lesson={row.lesson} minutes={lookingAtToday ? minutes : null} />
                    ) : (
                      <li key={`break-${row.at}`} className="px-4 py-2 text-sm text-mist">
                        Pause {row.minutes} Min
                      </li>
                    ),
                  )}
                </ol>
              )}
              {(schoolOver || !lookingAtToday) && flur.tomorrow.lessons.length > 0 ? (
                <div className="mt-4 border-t border-line px-2 pt-4">
                  <h3 className="text-sm uppercase tracking-widest text-mist">Morgen</h3>
                  <ul className="mt-2">
                    {flur.tomorrow.lessons.map((lesson) => (
                      <LessonRow key={lesson.id} lesson={lesson} minutes={null} />
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <div className="space-y-5">
              <section className="rounded-board border border-line bg-panel p-5">
                <h2 className="text-sm uppercase tracking-widest text-mist">Änderungen</h2>
                {changes.length === 0 ? (
                  <p className="mt-3 text-pretty">Keine Vertretung, nichts entfällt.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {changes.map((lesson) => (
                      <li key={lesson.id}>
                        <p className={lesson.status === "cancelled" ? "text-rust" : "text-chalk"}>
                          {statusLabel(lesson)} · {lesson.subject}
                        </p>
                        <p className="text-sm text-mist">
                          {lessonSpan(lesson)}
                          {lesson.room ? ` · ${lesson.room}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <button type="button" onClick={() => setView("hin")} className="block w-full text-left">
                <TripCard trip={flur.hin} loading={flur.tripLoading && !flur.hin} />
              </button>
            </div>
          </div>
        ) : null}

        {view === "hin" || view === "heim" ? (
          <div className="mx-auto max-w-3xl space-y-5">
            <div>
              <h2 className="font-display text-4xl">{view === "hin" ? "Hinweg" : "Heimweg"}</h2>
              <p className="mt-2 max-w-xl text-pretty text-mist">
                {view === "hin"
                  ? "So knapp wie möglich zur ersten Stunde, die nicht ausfällt. Danach noch der Weg ins Schulhaus."
                  : "Erst der Weg vom Schulhaus zur Haltestelle, dann die früheste Zugverbindung."}
              </p>
            </div>
            <ModeSwitch mode={flur.route.mode} onChange={flur.setMode} />
            {flur.tripError ? <p className="text-sm text-rust">{flur.tripError}</p> : null}
            <TripCard
              trip={view === "hin" ? flur.hin : flur.heim}
              loading={flur.tripLoading && !(view === "hin" ? flur.hin : flur.heim)}
            />
          </div>
        ) : null}

        {view === "post" ? (
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-4xl text-paper">Morgenpost</h2>
              <button
                type="button"
                onClick={() => void copyLetter()}
                className="h-12 rounded-lg bg-chalk px-4 font-medium text-chalk-ink"
              >
                {copied ? "Kopiert" : "Text kopieren"}
              </button>
            </div>
            <article className="rounded-board bg-paper p-6 text-ink md:p-8">
              <p className="text-sm uppercase tracking-widest text-chalk-ink">Vorlage, noch ohne Versand</p>
              <pre className="mt-4 font-sans text-base leading-relaxed whitespace-pre-wrap">{letter}</pre>
            </article>
            <p className="mt-4 text-sm text-pretty text-mist">
              Mail, eine eigene Smartphone-App und Apple-Watch-Widgets sind der nächste Schritt. Die Uhr-Ansicht ist
              die Vorlage für so ein Widget, das Telefon nutzt dieselbe Tafel.
            </p>
          </div>
        ) : null}

        {view === "setup" ? (
          <form
            className="mx-auto max-w-2xl space-y-8"
            onSubmit={(event) => {
              event.preventDefault();
              flur.setSettings(draft);
              setView("heute");
            }}
          >
            <div>
              <h2 className="font-display text-4xl">Einstellungen</h2>
              <p className="mt-2 text-pretty text-mist">
                Zugangsdaten bleiben auf diesem Bildschirm. Für den Dauerbetrieb am HDMI-Gerät lieber die
                Server-Variablen setzen, dann muss hier nichts eingetippt werden.
              </p>
              {flur.profile?.webuntis ? (
                <p className="mt-3 text-sm text-chalk">Server ist schon mit {flur.profile.school} verbunden.</p>
              ) : null}
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm uppercase tracking-widest text-mist">WebUntis</legend>
              <label className="block text-sm">
                Server
                <input
                  className={fieldClass}
                  value={draft.baseUrl}
                  onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
                  placeholder="mese.webuntis.com"
                  autoComplete="off"
                />
              </label>
              <label className="block text-sm">
                Schule
                <input
                  className={fieldClass}
                  value={draft.school}
                  onChange={(event) => setDraft({ ...draft, school: event.target.value })}
                  autoComplete="organization"
                />
              </label>
              <label className="block text-sm">
                Benutzer
                <input
                  className={fieldClass}
                  value={draft.user}
                  onChange={(event) => setDraft({ ...draft, user: event.target.value })}
                  autoComplete="username"
                />
              </label>
              <label className="block text-sm">
                Passwort
                <input
                  className={fieldClass}
                  type="password"
                  value={draft.password}
                  onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                  autoComplete="current-password"
                />
              </label>
              <label className="block text-sm">
                Plan von
                <select
                  className={fieldClass}
                  value={draft.who}
                  onChange={(event) =>
                    setDraft({ ...draft, who: event.target.value === "class" || event.target.value === "teacher" ? event.target.value : "student" })
                  }
                >
                  <option value="student">Schülerkonto</option>
                  <option value="class">Klasse</option>
                  <option value="teacher">Lehrkraft</option>
                </select>
              </label>
              {draft.who !== "student" ? (
                <label className="block text-sm">
                  {draft.who === "class" ? "Klasse" : "Kürzel"}
                  <input
                    className={fieldClass}
                    value={draft.whoName}
                    onChange={(event) => setDraft({ ...draft, whoName: event.target.value })}
                  />
                </label>
              ) : null}
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm uppercase tracking-widest text-mist">Weg</legend>
              <label className="block text-sm">
                Heimatadresse
                <input
                  className={fieldClass}
                  value={draft.homeAddress}
                  onChange={(event) => setDraft({ ...draft, homeAddress: event.target.value })}
                  autoComplete="street-address"
                />
              </label>
              <label className="block text-sm">
                Bahnhof
                <input
                  className={fieldClass}
                  value={draft.station}
                  onChange={(event) => setDraft({ ...draft, station: event.target.value })}
                  placeholder="Köln Süd"
                />
              </label>
              <label className="block text-sm">
                Halt an der Schule
                <input
                  className={fieldClass}
                  value={draft.schoolStop}
                  onChange={(event) => setDraft({ ...draft, schoolStop: event.target.value })}
                  placeholder="Köln Hbf"
                />
              </label>
              <ModeSwitch mode={draft.mode} onChange={(mode) => setDraft({ ...draft, mode })} />
            </fieldset>

            <label className="flex items-center gap-3 text-base">
              <input
                type="checkbox"
                className="size-5 accent-chalk"
                checked={draft.kioskRotate}
                onChange={(event) => setDraft({ ...draft, kioskRotate: event.target.checked })}
              />
              Am Bildschirm automatisch zwischen Heute, Hinweg und Heimweg wechseln
            </label>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="h-12 rounded-lg bg-chalk px-5 font-medium text-chalk-ink">
                Speichern
              </button>
              <button
                type="button"
                className="h-12 rounded-lg border border-line px-5"
                onClick={() => {
                  flur.resetSettings();
                  setDraft(emptySettings());
                }}
              >
                Zurück zum Beispiel
              </button>
              <Link to="/uhr" className="flex h-12 items-center rounded-lg border border-line px-5">
                Uhrenansicht
              </Link>
            </div>
          </form>
        ) : null}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-ink md:hidden"
        aria-label="Ansichten"
      >
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={"flex h-16 flex-col items-center justify-center gap-1 px-1 text-xs leading-tight " + (active ? "text-chalk" : "text-mist")}
            >
              <Icon className="size-5" aria-hidden="true" />
              {item.short}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
