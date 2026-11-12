import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useState } from "react";
import type { DeskData } from "@/lib/flur/desk";
import { mondayOf, weekdayShort } from "@/lib/flur/desk";
import type { Lesson } from "@/lib/flur/types";
import { addDaysIso, berlinParts, formatDayShort, formatMinutes } from "@/lib/flur/time";

export function DeskStatus({
  loading,
  error,
  fromCache,
}: {
  loading: boolean;
  error: string | null;
  fromCache: boolean;
}) {
  if (loading && !fromCache && !error) return <p className="text-sm text-mist">Wird aus WebUntis geladen …</p>;
  if (error && fromCache) return <p className="text-sm text-pretty text-mist">Zuletzt gespeichert auf diesem Gerät. {error}</p>;
  if (error) return <p className="text-sm text-pretty text-rust">{error}</p>;
  if (fromCache) return <p className="text-sm text-mist">Zuletzt gespeichert auf diesem Gerät.</p>;
  return null;
}

function statusWord(lesson: Lesson): string {
  if (lesson.status === "cancelled") return "Entfällt";
  if (lesson.status === "substitution") return "Vertretung";
  return "";
}

function WeekCell({ lesson, current }: { lesson: Lesson; current: boolean }) {
  const word = statusWord(lesson);
  return (
    <div className={"rounded-xl px-2 py-2 " + (current ? "bg-now" : "")}>
      <p className="text-xs tabular-nums text-mist">{formatMinutes(lesson.startMin)}</p>
      <p className={"truncate text-sm font-semibold " + (lesson.status === "cancelled" ? "text-mist line-through" : "text-paper")}>
        {lesson.subject}
      </p>
      {lesson.room ? <p className="truncate text-xs text-mist">{lesson.room}</p> : null}
      {word ? (
        <p className={"text-xs font-semibold " + (lesson.status === "cancelled" ? "text-rust" : "text-chalk")}>{word}</p>
      ) : null}
    </div>
  );
}

export function WeekView({
  desk,
  now,
  loading,
  error,
  fromCache,
  onExport,
}: {
  desk: DeskData | null;
  now: Date | null;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  onExport: () => void;
}) {
  const todayIso = now ? berlinParts(now).iso : "";
  const anchor = mondayOf(todayIso || desk?.days[0]?.iso || "2026-11-09");
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState("");
  const monday = addDaysIso(anchor, offset * 7);
  const isos = [0, 1, 2, 3, 4, 5, 6].map((index) => addDaysIso(monday, index));
  const byIso = new Map((desk?.days ?? []).map((day) => [day.iso, day.lessons]));
  const weeks = Math.max(1, Math.ceil((desk?.days.length || 14) / 7));
  const schoolDays = isos.slice(0, 5);
  const visible = isos.filter((iso, index) => index < 5 || (byIso.get(iso)?.length ?? 0) > 0);
  const active = visible.includes(picked) ? picked : visible.includes(todayIso) ? todayIso : visible[0];
  const minutes = now && active === todayIso ? berlinParts(now).minutes : null;
  const lessons = byIso.get(active ?? "") ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-4xl">Woche</h2>
          <p className="mt-1 text-sm text-mist">
            {formatDayShort(isos[0] ?? monday)} – {formatDayShort(isos[6] ?? monday)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-paper disabled:opacity-40"
            onClick={onExport}
            disabled={!desk}
          >
            <Download className="size-4" aria-hidden="true" />
            Kalender
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex size-12 items-center justify-center rounded-xl border border-line text-paper disabled:opacity-40"
              aria-label="Vorige Woche"
              disabled={offset <= 0}
              onClick={() => setOffset((value) => Math.max(0, value - 1))}
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="flex size-12 items-center justify-center rounded-xl border border-line text-paper disabled:opacity-40"
              aria-label="Nächste Woche"
              disabled={offset >= weeks - 1}
              onClick={() => setOffset((value) => Math.min(weeks - 1, value + 1))}
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <DeskStatus loading={loading && !desk} error={desk ? null : error} fromCache={fromCache && !desk} />
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto md:hidden" role="tablist" aria-label="Wochentag">
        {visible.map((iso) => {
          const selected = iso === active;
          return (
            <button
              key={iso}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setPicked(iso)}
              className={
                "h-12 shrink-0 rounded-xl border px-3 text-sm font-medium " +
                (selected ? "border-chalk bg-chalk text-chalk-ink" : "border-line text-paper")
              }
            >
              {weekdayShort(iso)} {iso.slice(8)}
            </button>
          );
        })}
      </div>

      <div className="mt-4 md:hidden">
        {lessons.length === 0 ? (
          <p className="rounded-board border border-line bg-panel px-4 py-6 text-mist">Frei.</p>
        ) : (
          <ol className="overflow-hidden rounded-board border border-line bg-panel">
            {lessons.map((lesson) => {
              const current =
                minutes != null && lesson.status !== "cancelled" && lesson.startMin <= minutes && minutes < lesson.endMin;
              const word = statusWord(lesson);
              return (
                <li key={lesson.id} className={"border-b border-line px-4 py-3 last:border-b-0 " + (current ? "bg-now" : "")}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={"font-medium " + (lesson.status === "cancelled" ? "text-mist line-through" : "text-paper")}>
                      {lesson.subject}
                    </p>
                    <p className="shrink-0 text-sm tabular-nums text-mist">
                      {formatMinutes(lesson.startMin)}–{formatMinutes(lesson.endMin)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-mist">
                    {[lesson.room, lesson.teacher].filter(Boolean).join(" · ") || "Raum offen"}
                    {word ? ` · ${word}` : ""}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-4 hidden gap-3 md:grid md:grid-cols-5">
        {schoolDays.map((iso) => {
          const dayLessons = byIso.get(iso) ?? [];
          const dayMinutes = iso === todayIso && now ? berlinParts(now).minutes : null;
          return (
            <section key={iso} className="min-w-0 rounded-board border border-line bg-panel p-2">
              <h3 className={"px-2 pt-1 text-sm " + (iso === todayIso ? "text-chalk" : "text-mist")}>
                {weekdayShort(iso)} {iso.slice(8)}
              </h3>
              {dayLessons.length === 0 ? (
                <p className="px-2 py-4 text-sm text-mist">Frei</p>
              ) : (
                <div className="mt-1">
                  {dayLessons.map((lesson) => (
                    <WeekCell
                      key={lesson.id}
                      lesson={lesson}
                      current={
                        dayMinutes != null &&
                        lesson.status !== "cancelled" &&
                        lesson.startMin <= dayMinutes &&
                        dayMinutes < lesson.endMin
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
