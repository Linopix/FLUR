import { Link } from "@tanstack/react-router";
import { DEMO_LESSONS } from "@/lib/flur/demo";
import { berlinParts, formatClock, formatInstant, formatMinutes } from "@/lib/flur/time";
import { useFlur } from "@/components/flur/use-flur";

export function WatchFace() {
  const flur = useFlur();
  const lessons = flur.today.lessons.length ? flur.today.lessons : DEMO_LESSONS;
  const minutes = flur.now ? berlinParts(flur.now).minutes : null;
  const next =
    (minutes == null
      ? lessons.find((lesson) => lesson.status !== "cancelled")
      : lessons.find(
          (lesson) => lesson.status !== "cancelled" && (lesson.startMin > minutes || minutes < lesson.endMin),
        )) ?? null;
  const train = flur.hin?.legs.find((leg) => leg.mode === "rail");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-4 py-8 text-paper">
      <section className="w-full max-w-sm rounded-board border border-line bg-panel px-6 py-8">
        <p className="text-xs uppercase tracking-widest text-chalk">Flur</p>
        <p className="mt-3 font-display text-6xl tabular-nums leading-none">
          {flur.now ? formatClock(flur.now) : "––:––"}
        </p>
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm text-mist">Nächste Stunde</p>
          {next ? (
            <>
              <h1 className="mt-1 font-display text-3xl text-balance">{next.subject}</h1>
              <p className="mt-1 text-mist">
                {formatMinutes(next.startMin)} · {next.room || "Raum offen"}
              </p>
            </>
          ) : (
            <h1 className="mt-1 font-display text-3xl">Frei</h1>
          )}
        </div>
        <div className="mt-5 border-t border-line pt-5">
          <p className="text-sm text-mist">Nächster pünktlicher Zug</p>
          {train ? (
            <p className="mt-1 text-lg">
              {train.title} · {formatInstant(train.departure)}
              {flur.hin?.punctual ? "" : " · verspätet"}
            </p>
          ) : (
            <p className="mt-1 text-mist">wird geladen</p>
          )}
        </div>
        <p className="mt-6 text-sm text-pretty text-mist">
          Vorlage für ein Apple-Watch-Widget. Die echte Complication kommt später.
        </p>
        <Link to="/" className="mt-4 inline-flex h-12 items-center text-chalk">
          Zurück zur Tafel
        </Link>
      </section>
    </main>
  );
}
