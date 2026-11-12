import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { DeskStatus } from "@/components/flur/week";
import type { DeskData } from "@/lib/flur/desk";
import { formatDayShort, formatMinutes } from "@/lib/flur/time";

type Tab = "changes" | "exams" | "homework" | "absences" | "holidays" | "notices";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "changes", label: "Änderungen" },
  { id: "exams", label: "Prüfungen" },
  { id: "homework", label: "Aufgaben" },
  { id: "absences", label: "Fehlzeiten" },
  { id: "holidays", label: "Ferien" },
  { id: "notices", label: "Pinnwand" },
];

const DONE_KEY = "flur.tasks.v1";

function loadDone(): string[] {
  try {
    const raw = window.localStorage.getItem(DONE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function span(start: number, end: number): string {
  if (!start && !end) return "";
  if (!end || end === start) return formatMinutes(start);
  return `${formatMinutes(start)}–${formatMinutes(end)}`;
}

export function SchoolView({
  desk,
  loading,
  error,
  fromCache,
}: {
  desk: DeskData | null;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
}) {
  const [tab, setTab] = useState<Tab>("changes");
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    setDone(loadDone());
  }, []);

  function toggleDone(id: string) {
    setDone((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem(DONE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const notes = desk?.notes;
  const note =
    tab === "exams"
      ? notes?.exams
      : tab === "homework"
        ? notes?.homework
        : tab === "absences"
          ? notes?.absences
          : tab === "holidays"
            ? notes?.holidays
            : tab === "notices"
              ? notes?.notices
              : "";

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="font-display text-4xl">Schule</h2>
      <p className="mt-1 text-sm text-pretty text-mist">Was Untis zum eigenen Stundenplan hergibt. Zwei Wochen voraus.</p>
      <div className="mt-4">
        <DeskStatus loading={loading && !desk} error={desk ? null : error} fromCache={fromCache && !desk} />
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto" role="tablist" aria-label="Schulbereich">
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={
                "h-11 shrink-0 rounded-full border px-4 text-sm font-medium " +
                (selected ? "border-chalk bg-chalk text-chalk-ink" : "border-line text-paper")
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {note ? <p className="mt-4 text-sm text-pretty text-mist">{note}</p> : null}
      <div className="mt-4">
        {tab === "changes" ? (
          <PlainList
            empty="Keine Vertretung. Nichts entfällt."
            rows={(desk?.changes ?? []).map((item) => ({
              id: item.id,
              title: `${item.kind === "cancelled" ? "Entfällt" : "Vertretung"} · ${item.subject}`,
              meta: [formatDayShort(item.iso), span(item.startMin, item.endMin), item.room, item.teacher, item.text]
                .filter(Boolean)
                .join(" · "),
              tone: item.kind === "cancelled" ? "bad" : "accent",
            }))}
          />
        ) : null}
        {tab === "exams" ? (
          <PlainList
            empty="Keine Prüfung eingetragen."
            rows={(desk?.exams ?? []).map((item) => ({
              id: item.id,
              title: item.subject ? `${item.name} · ${item.subject}` : item.name,
              meta: [formatDayShort(item.iso), span(item.startMin, item.endMin), item.rooms, item.teachers, item.text]
                .filter(Boolean)
                .join(" · "),
              tone: "accent",
            }))}
          />
        ) : null}
        {tab === "homework" ? (
          (desk?.homework.length ?? 0) === 0 ? (
            <p className="rounded-board border border-line bg-panel px-4 py-6 text-mist">Keine Hausaufgabe.</p>
          ) : (
            <ul className="overflow-hidden rounded-board border border-line bg-panel">
              {desk?.homework.map((item) => {
                const checked = item.done || done.includes(item.id);
                return (
                  <li key={item.id} className="flex items-start gap-3 border-b border-line px-3 py-3 last:border-b-0">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={checked ? "Erledigt" : "Offen"}
                      disabled={item.done}
                      onClick={() => toggleDone(item.id)}
                      className={
                        "mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border " +
                        (checked ? "border-chalk bg-chalk text-chalk-ink" : "border-line text-mist")
                      }
                    >
                      {checked ? <Check className="size-4" aria-hidden="true" /> : null}
                    </button>
                    <div className="min-w-0 py-1">
                      <p className={"font-medium " + (checked ? "text-mist line-through" : "text-paper")}>{item.text}</p>
                      <p className="mt-1 text-sm text-mist">
                        {[item.subject, item.teacher, item.dueIso ? `bis ${formatDayShort(item.dueIso)}` : "", item.done ? "in Untis erledigt" : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
        {tab === "absences" ? (
          <PlainList
            empty="Keine Fehlzeit."
            rows={(desk?.absences ?? []).map((item) => ({
              id: item.id,
              title: item.subject || "Fehlzeit",
              meta: [formatDayShort(item.iso), span(item.startMin, item.endMin), item.status, item.text].filter(Boolean).join(" · "),
              tone: item.status === "unentschuldigt" ? "bad" : "plain",
            }))}
          />
        ) : null}
        {tab === "holidays" ? (
          <PlainList
            empty="Keine Ferien hinterlegt."
            rows={(desk?.holidays ?? []).map((item) => ({
              id: item.id,
              title: item.name,
              meta:
                item.startIso === item.endIso
                  ? formatDayShort(item.startIso)
                  : `${formatDayShort(item.startIso)} – ${formatDayShort(item.endIso)}`,
              tone: "plain",
            }))}
          />
        ) : null}
        {tab === "notices" ? (
          <PlainList
            empty="Keine Mitteilung."
            rows={(desk?.notices ?? []).map((item) => ({
              id: item.id,
              title: item.title,
              meta: [item.iso ? formatDayShort(item.iso) : "", item.body].filter(Boolean).join(" · "),
              tone: "plain",
            }))}
          />
        ) : null}
      </div>
      {tab === "homework" ? (
        <p className="mt-3 text-sm text-pretty text-mist">Abhaken gilt nur auf diesem Gerät. Untis bekommt davon nichts mit.</p>
      ) : null}
    </div>
  );
}

function PlainList({
  rows,
  empty,
}: {
  rows: Array<{ id: string; title: string; meta: string; tone: "bad" | "accent" | "plain" }>;
  empty: string;
}) {
  if (rows.length === 0) return <p className="rounded-board border border-line bg-panel px-4 py-6 text-mist">{empty}</p>;
  return (
    <ul className="overflow-hidden rounded-board border border-line bg-panel">
      {rows.map((row) => (
        <li key={row.id} className="border-b border-line px-4 py-3 last:border-b-0">
          <p className={row.tone === "bad" ? "font-medium text-rust" : row.tone === "accent" ? "font-medium text-chalk" : "font-medium text-paper"}>
            {row.title}
          </p>
          {row.meta ? <p className="mt-1 text-sm text-pretty text-mist">{row.meta}</p> : null}
        </li>
      ))}
    </ul>
  );
}
