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
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10 text-label">
      <section className="apple-card w-full max-w-xs px-6 py-7">
        <p className="text-xs font-semibold tracking-wide text-secondary">FLUR</p>
        <p className="apple-time mt-3 text-6xl">{flur.now ? formatClock(flur.now) : "––:––"}</p>
        <div className="mt-6 border-t border-separator pt-5">
          <p className="text-sm font-semibold text-accent">{active ? "Jetzt" : "Nächste Stunde"}</p>
          {focus ? (
            <>
              <h1 className="font-display mt-1 text-3xl text-balance">{focus.subject}</h1>
              <p className="mt-1 text-secondary">
                {formatMinutes(focus.startMin)}–{formatMinutes(focus.endMin)} · {focus.room || "Raum offen"}
              </p>
            </>
          ) : (
            <h1 className="font-display mt-1 text-3xl">Frei</h1>
          )}
        </div>
        <div className="mt-5 border-t border-separator pt-5">
          <p className="text-sm font-semibold text-secondary">{flur.hin?.mode === "drive" ? "Abfahrt Auto" : "Nächster Zug"}</p>
          {flur.hin?.mode === "drive" ? (
            <p className="mt-1 text-lg font-semibold tracking-tight">
              Auto · {formatInstant(flur.hin.leaveAt)} · Fahrzeit
            </p>
          ) : train ? (
            <p className="mt-1 text-lg font-semibold tracking-tight">
              {train.title} · {formatInstant(train.departure)}
              {flur.hin?.punctual ? "" : " · verspätet"}
            </p>
          ) : (
            <p className="mt-1 text-secondary">{flur.tripLoading ? "wird geladen" : "keine Verbindung"}</p>
          )}
        </div>
        <Link to="/" className="mt-6 inline-flex h-12 items-center text-base font-semibold text-accent">
          Zurück
        </Link>
      </section>
    </main>
  );
}
