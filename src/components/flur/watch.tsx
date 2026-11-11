import { Link } from "@tanstack/react-router";
import { DEMO_LESSONS } from "@/lib/flur/demo";
import { berlinParts, formatClock, formatInstant, formatMinutes } from "@/lib/flur/time";
import { useFlur } from "@/components/flur/use-flur";

export function WatchFace() {
  const flur = useFlur();
  const lessons = flur.today.lessons.length ? flur.today.lessons : DEMO_LESSONS;
  const minutes = flur.now ? berlinParts(flur.now).minutes : null;
  const focus =
    minutes == null
      ? (lessons.find((lesson) => lesson.status !== "cancelled") ?? null)
      : (lessons.find(
          (lesson) => lesson.status !== "cancelled" && lesson.startMin <= minutes && minutes < lesson.endMin,
        ) ??
        lessons.find((lesson) => lesson.status !== "cancelled" && lesson.startMin > minutes) ??
        null);
  const active = Boolean(
    focus && minutes != null && focus.startMin <= minutes && minutes < focus.endMin,
  );
  const train = flur.hin?.legs.find((leg) => leg.mode === "rail");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-4 py-8 text-paper">
      <section className="w-full max-w-xs rounded-board border border-line bg-panel px-6 py-7">
        <p className="font-display text-sm tracking-widest text-chalk">FLUR</p>
        <p className="mt-4 font-display text-6xl tabular-nums leading-none">
          {flur.now ? formatClock(flur.now) : "––:––"}
        </p>
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm text-mist">{active ? "Jetzt" : "Nächste Stunde"}</p>
          {focus ? (
            <>
              <h1 className="mt-1 font-display text-3xl text-balance">{focus.subject}</h1>
              <p className="mt-1 text-mist">
                {formatMinutes(focus.startMin)}–{formatMinutes(focus.endMin)} · {focus.room || "Raum offen"}
              </p>
            </>
          ) : (
            <h1 className="mt-1 font-display text-3xl">Frei</h1>
          )}
        </div>
        <div className="mt-5 border-t border-line pt-5">
          <p className="text-sm text-mist">Nächster Zug</p>
          {train ? (
            <p className="mt-1 text-lg">
              {train.title} · {formatInstant(train.departure)}
              {flur.hin?.punctual ? "" : " · verspätet"}
            </p>
          ) : (
            <p className="mt-1 text-mist">{flur.tripLoading ? "wird geladen" : "keine Verbindung"}</p>
          )}
        </div>
        <Link
          to="/"
          className="mt-6 inline-flex h-12 items-center text-sm font-medium text-chalk"
        >
          Zurück zur Tafel
        </Link>
      </section>
    </main>
  );
}
