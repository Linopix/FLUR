import { Bike, Bus, Car, ChevronLeft, Footprints, QrCode, Route, Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { parseUntisAccess } from "@/lib/flur/access";
import { filterDirectory, type DirectoryItem } from "@/lib/flur/directory";
import { checkLogin, listDirectory, searchSchools } from "@/lib/flur/fns";
import { hasRoute, hasUntis } from "@/lib/flur/settings";
import { MODE_HINT, MODE_LABEL, type LoginKind, type Mode, type SchoolMatch, type ServerProfile, type Settings, type Who } from "@/lib/flur/types";

export type SetupStep = "welcome" | "school" | "who" | "login" | "route" | "done";

const STEPS: SetupStep[] = ["school", "login", "who", "route", "done"];

const SSO_STEPS = [
  "In WebUntis im Browser wie gewohnt über die Schule anmelden.",
  "Auf den eigenen Namen tippen, dann auf Freigaben.",
  "Den QR-Code anzeigen. Foto machen oder den Link hier einfügen.",
];

function placeLine(address: string): string {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) return `${parts[1]} · ${parts.slice(2).join(", ")}`;
  if (parts.length === 2) return parts[1];
  return address;
}

function ModePicker({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
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
            <button key={item.id} type="button" role="radio" aria-checked={active} title={MODE_HINT[item.id]} onClick={() => onChange(item.id)}>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-mist">
      {label}
      {children}
    </label>
  );
}

function WhoNameField({
  who,
  name,
  school,
  baseUrl,
  user,
  password,
  login,
  onName,
}: {
  who: Exclude<Who, "student">;
  name: string;
  school: string;
  baseUrl: string;
  user: string;
  password: string;
  login: LoginKind;
  onName: (name: string) => void;
}) {
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const gen = useRef(0);
  const query = name.trim();
  const filtered = filterDirectory(items, query, 8);
  const current = Math.min(active, Math.max(0, filtered.items.length - 1));
  const showList = open && query.length > 0 && filtered.items.length > 0;
  const exact = items.find((item) => item.name.toLowerCase() === query.toLowerCase());
  const label = who === "class" ? "Klasse" : "Kürzel";

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!school.trim() || !baseUrl.trim()) {
      setItems([]);
      setBusy(false);
      setHint(who === "class" ? "Zuerst eine Schule wählen." : "");
      return;
    }
    const request = ++gen.current;
    setBusy(true);
    setHint("");
    void listDirectory({ data: { baseUrl, school, who, user, password, login } })
      .then((result) => {
        if (gen.current !== request) return;
        setItems(result.items);
        setHint(result.hint);
      })
      .catch(() => {
        if (gen.current !== request) return;
        setItems([]);
        setHint(who === "class" ? "Klassenliste gerade nicht erreichbar. Den Namen einfach eintragen." : "");
      })
      .finally(() => {
        if (gen.current === request) setBusy(false);
      });
  }, [baseUrl, school, who, user, password, login]);

  function pick(item: DirectoryItem) {
    onName(item.name);
    setOpen(false);
  }

  let status = "";
  if (busy) status = who === "class" ? "Klassen werden geladen …" : "Liste wird geladen …";
  else if (items.length === 0 && hint) status = hint;
  else if (open && query && items.length > 0 && filtered.items.length === 0) {
    status =
      who === "class"
        ? "Keine Klasse passt. Der Name kann trotzdem verwendet werden."
        : "Kein Kürzel passt. Es kann trotzdem verwendet werden.";
  }

  return (
    <div>
      <label className="flex flex-col gap-1.5 text-sm text-mist" htmlFor="who-name">
        {label}
        <span className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mist" aria-hidden="true" />
          <input
            id="who-name"
            className="flur-field pl-10"
            value={name}
            onChange={(event) => {
              onName(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(event) => {
              if (!showList) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive(Math.min(filtered.items.length - 1, current + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive(Math.max(0, current - 1));
              } else if (event.key === "Enter" && filtered.items[current]) {
                event.preventDefault();
                pick(filtered.items[current]);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder={who === "class" ? "Suchen, zum Beispiel 10b" : "Suchen, zum Beispiel MUE"}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls="who-suggestions"
            aria-activedescendant={showList ? `who-opt-${current}` : undefined}
          />
        </span>
      </label>
      {status ? (
        <p className="mt-2 text-sm text-pretty text-mist" role="status">
          {status}
        </p>
      ) : null}
      {showList ? (
        <ul id="who-suggestions" role="listbox" aria-label={label} className="mt-2 max-h-72 overflow-auto rounded-board border border-line bg-panel">
          {filtered.items.map((item, index) => (
            <li key={item.name} className="border-b border-line last:border-b-0">
              <button
                type="button"
                role="option"
                id={`who-opt-${index}`}
                aria-selected={index === current}
                className={"min-h-14 w-full px-4 py-3 text-left " + (index === current ? "bg-fill" : "")}
                onPointerDown={(event) => {
                  event.preventDefault();
                  pick(item);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <span className="block font-medium">{item.name}</span>
                {item.longName.toLowerCase() !== item.name.toLowerCase() ? (
                  <span className="mt-0.5 block text-sm text-mist">{item.longName}</span>
                ) : null}
              </button>
            </li>
          ))}
          {filtered.more > 0 ? <li className="px-4 py-2 text-sm text-mist">Noch {filtered.more} weitere. Genauer tippen.</li> : null}
        </ul>
      ) : null}
      {!open && exact && exact.longName.toLowerCase() !== exact.name.toLowerCase() ? (
        <p className="mt-2 text-sm text-mist">{exact.longName}</p>
      ) : null}
    </div>
  );
}

function Choice({
  active,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={
        "w-full rounded-board border px-4 py-4 text-left " +
        (active ? "border-chalk bg-fill" : "border-line bg-panel")
      }
    >
      <span className="block font-medium">{title}</span>
      <span className="mt-1 block text-sm text-pretty text-mist">{detail}</span>
    </button>
  );
}

export function Setup({
  step,
  settings,
  profile,
  onStep,
  onDone,
  onClose,
}: {
  step: SetupStep;
  settings: Settings;
  profile: ServerProfile | null;
  onStep: (step: SetupStep) => void;
  onDone: (next: Settings) => void;
  onClose?: () => void;
}) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SchoolMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchHint, setSearchHint] = useState("");
  const [hint, setHint] = useState("");
  const [checking, setChecking] = useState(false);
  const [place, setPlace] = useState("");
  const [qrBusy, setQrBusy] = useState(false);
  const trail = useRef<SetupStep[]>([]);
  const qrInput = useRef<HTMLInputElement>(null);
  const searchTimer = useRef(0);
  const searchGen = useRef(0);
  const schoolChosen = Boolean(draft.school.trim() && draft.baseUrl.trim());
  const index = Math.max(0, STEPS.indexOf(step));
  const planLabel = hasUntis(draft)
    ? draft.schoolLabel.trim() || draft.school.trim() || "WebUntis"
    : profile?.webuntis
      ? profile.school || "Über den Server"
      : "Beispieltag";
  const routeLabel = hasRoute(draft)
    ? draft.mode === "drive"
      ? `${draft.schoolAddress.trim() || draft.schoolStop.trim()} · ${MODE_LABEL.drive}`
      : `${draft.station.trim() || "Bahnhof"} · ${MODE_LABEL[draft.mode]}`
    : profile?.station
      ? `${profile.station} · ${MODE_LABEL[(profile.mode || draft.mode) as Mode]}`
      : "Beispielweg";

  function go(next: SetupStep) {
    trail.current = [...trail.current, step];
    setHint("");
    onStep(next);
  }

  function back() {
    const prev = trail.current[trail.current.length - 1];
    if (prev) {
      trail.current = trail.current.slice(0, -1);
      setHint("");
      onStep(prev);
      return;
    }
    if (onClose) onClose();
    else if (step !== "welcome") onStep("welcome");
  }

  function searchNow(value: string) {
    const q = value.trim();
    const gen = ++searchGen.current;
    if (q.length < 2) {
      setHits([]);
      setSearchHint("");
      setSearching(false);
      return;
    }
    setSearching(true);
    void searchSchools({ data: { query: q } })
      .then((result) => {
        if (searchGen.current !== gen) return;
        setHits(result.schools);
        setSearchHint(result.hint);
      })
      .catch(() => {
        if (searchGen.current !== gen) return;
        setHits([]);
        setSearchHint("Suche gerade nicht erreichbar.");
      })
      .finally(() => {
        if (searchGen.current === gen) setSearching(false);
      });
  }

  function onQuery(value: string) {
    setQuery(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => searchNow(value), 280);
  }

  function pickSchool(hit: SchoolMatch) {
    setDraft({
      ...draft,
      baseUrl: hit.server,
      school: hit.loginName,
      schoolLabel: hit.displayName,
    });
    setPlace(placeLine(hit.address));
    setQuery("");
    setHits([]);
    setSearchHint("");
    setHint("");
  }

  function clearSchool() {
    setDraft({ ...draft, school: "", schoolLabel: "", baseUrl: "" });
    setPlace("");
    setHint("");
  }

  function onAccessChange(value: string) {
    const parsed = parseUntisAccess(value);
    const linked = value.includes("://") || value.includes("=");
    if (!parsed?.secret || !linked) {
      setDraft({ ...draft, login: "secret", password: value });
      setHint("");
      return;
    }
    setDraft({
      ...draft,
      login: "secret",
      password: parsed.secret,
      user: parsed.user || draft.user,
      school: parsed.school || draft.school,
      schoolLabel: parsed.school && parsed.school !== draft.school ? parsed.school : draft.schoolLabel,
      baseUrl: parsed.server || draft.baseUrl,
    });
    setHint(parsed.user ? `Übernommen für ${parsed.user}.` : "Zugangscode übernommen.");
  }

  async function onQrFile(file: File | undefined) {
    if (!file) return;
    setQrBusy(true);
    setHint("");
    try {
      const { readQrFromFile } = await import("@/lib/flur/qr");
      const text = await readQrFromFile(file);
      if (!text) {
        setHint("Kein QR-Code erkannt. Den Link aus Freigaben einfügen.");
        return;
      }
      onAccessChange(text);
    } catch {
      setHint("Das Foto konnte nicht gelesen werden.");
    } finally {
      setQrBusy(false);
      if (qrInput.current) qrInput.current.value = "";
    }
  }

  function continueSchool() {
    if (!schoolChosen) {
      setHint("Bitte eine Schule aus der Liste wählen.");
      return;
    }
    go("login");
  }

  function continueWho() {
    if (draft.who !== "student" && !draft.whoName.trim()) {
      setHint(draft.who === "class" ? "Wie heißt die Klasse?" : "Welches Kürzel?");
      return;
    }
    go("route");
  }

  async function continueLogin() {
    const user = draft.user.trim();
    const secret = draft.password.trim();
    if (!user && !secret) {
      go("who");
      return;
    }
    if (!schoolChosen) {
      setHint("Bitte zuerst eine Schule wählen.");
      return;
    }
    if (!user || !secret) {
      setHint(
        draft.login === "secret"
          ? "Benutzer und Zugangscode werden beide gebraucht."
          : "Benutzer und Passwort werden beide gebraucht.",
      );
      return;
    }
    if (draft.login === "secret" && !parseUntisAccess(secret)?.secret) {
      setHint("Das ist kein Code aus Freigaben.");
      return;
    }
    setChecking(true);
    setHint("");
    try {
      const result = await checkLogin({
        data: {
          baseUrl: draft.baseUrl,
          school: draft.school,
          user,
          password: secret,
          login: draft.login,
        },
      });
      if (!result.ok) {
        setHint(result.error);
        return;
      }
      go("who");
    } catch (error) {
      setHint(error instanceof Error ? error.message : "WebUntis ist gerade nicht erreichbar.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-6 pb-8 md:px-0 md:pt-16">
      <header className="flex items-center justify-between gap-3">
        {step === "welcome" ? (
          <p className="font-display text-sm tracking-widest text-chalk">FLUR</p>
        ) : (
          <button type="button" onClick={back} className="inline-flex h-11 items-center gap-1 text-sm font-medium text-chalk">
            <ChevronLeft className="size-4" aria-hidden="true" />
            Zurück
          </button>
        )}
        {onClose ? (
          <button type="button" onClick={onClose} className="h-11 px-1 text-sm font-medium text-mist">
            Schließen
          </button>
        ) : (
          <span />
        )}
      </header>

      {step !== "welcome" ? (
        <div className="mt-4 flex gap-2" aria-hidden="true">
          {STEPS.map((item, itemIndex) => (
            <span key={item} className={"h-1 flex-1 rounded-full " + (itemIndex <= index ? "bg-chalk" : "bg-line")} />
          ))}
        </div>
      ) : null}

      <div key={step} className="setup-step mt-8 flex flex-1 flex-col">
        {step === "welcome" ? (
          <>
            <h1 className="font-display text-5xl text-balance">Willkommen</h1>
            <p className="mt-4 max-w-md text-pretty text-lg text-mist">
              Stundenplan, nächster Zug und der Weg nach Hause. Einmal eingerichtet, bleibt die Tafel von allein
              aktuell.
            </p>
            <ul className="mt-8 space-y-4">
              {["Schule suchen, ohne Server-Adresse", "Dein Stundenplan", "Heimweg nach der letzten Stunde"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-3 text-base">
                    <span className="size-1.5 shrink-0 rounded-full bg-chalk" aria-hidden="true" />
                    {item}
                  </li>
                ),
              )}
            </ul>
            <div className="mt-auto flex flex-col gap-3 pt-10">
              <button type="button" className="apple-btn w-full" onClick={() => go("school")}>
                Einrichten
              </button>
              <button type="button" className="apple-btn apple-btn-plain w-full" onClick={() => onDone(settings)}>
                Beispiel ansehen
              </button>
            </div>
          </>
        ) : null}

        {step === "school" ? (
          <>
            <h1 className="font-display text-4xl text-balance">Welche Schule?</h1>
            <p className="mt-3 text-pretty text-mist">
              Name oder Ort reicht. Die Adresse von WebUntis sucht FLUR selbst.
            </p>
            <div className="mt-6">
              {schoolChosen ? (
                <button type="button" onClick={clearSchool} className="w-full rounded-board border border-chalk bg-fill px-4 py-4 text-left">
                  <span className="text-sm text-mist">Schule</span>
                  <span className="mt-1 block font-medium">{draft.schoolLabel || draft.school}</span>
                  {place ? <span className="mt-1 block text-sm text-mist">{place}</span> : null}
                  <span className="mt-3 block text-sm font-medium text-chalk">Andere Schule</span>
                </button>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mist" aria-hidden="true" />
                  <input
                    className="flur-field pl-10"
                    value={query}
                    onChange={(event) => onQuery(event.target.value)}
                    placeholder="Name oder Ort"
                    autoComplete="off"
                    autoFocus
                    aria-autocomplete="list"
                    aria-label="Schule suchen"
                  />
                </div>
              )}
              {!schoolChosen && searching ? <p className="mt-3 text-sm text-mist">Suche …</p> : null}
              {!schoolChosen && searchHint ? (
                <p className="mt-3 text-sm text-pretty text-mist" role="status">
                  {searchHint}
                </p>
              ) : null}
              {!schoolChosen && hits.length > 0 ? (
                <ul className="mt-3 overflow-hidden rounded-board border border-line bg-panel">
                  {hits.map((hit) => (
                    <li key={`${hit.server}-${hit.loginName}`} className="border-b border-line last:border-b-0">
                      <button type="button" onClick={() => pickSchool(hit)} className="min-h-14 w-full px-4 py-3 text-left">
                        <span className="block font-medium">{hit.displayName}</span>
                        {hit.address ? (
                          <span className="mt-0.5 block text-sm text-mist">{placeLine(hit.address)}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {hint ? <p className="mt-3 text-sm text-chalk">{hint}</p> : null}
            <div className="mt-auto flex flex-col gap-3 pt-8">
              <button type="button" className="apple-btn w-full" onClick={continueSchool}>
                Weiter
              </button>
              <button type="button" className="h-11 text-sm font-medium text-mist" onClick={() => go("route")}>
                Später
              </button>
            </div>
          </>
        ) : null}

        {step === "who" ? (
          <>
            <h1 className="font-display text-4xl text-balance">Für wen?</h1>
            <p className="mt-3 text-pretty text-mist">Der eigene Plan, eine Klasse oder eine Lehrkraft.</p>
            <div className="mt-6 space-y-3" role="radiogroup" aria-label="Plan von">
              <Choice
                active={draft.who === "student"}
                title="Für mich"
                detail="Dein eigener Stundenplan."
                onClick={() => setDraft({ ...draft, who: "student" })}
              />
              <Choice
                active={draft.who === "class"}
                title="Für eine Klasse"
                detail="Zum Beispiel 10b."
                onClick={() => setDraft({ ...draft, who: "class" })}
              />
              <Choice
                active={draft.who === "teacher"}
                title="Für eine Lehrkraft"
                detail="Mit dem Kürzel aus Untis."
                onClick={() => setDraft({ ...draft, who: "teacher" })}
              />
            </div>
            {draft.who !== "student" ? (
              <div className="mt-4">
                <WhoNameField
                  who={draft.who}
                  name={draft.whoName}
                  school={draft.school}
                  baseUrl={draft.baseUrl}
                  user={draft.user}
                  password={draft.password}
                  login={draft.login}
                  onName={(whoName) => {
                    setDraft({ ...draft, whoName });
                    setHint("");
                  }}
                />
              </div>
            ) : null}
            {hint ? <p className="mt-3 text-sm text-chalk">{hint}</p> : null}
            <div className="mt-auto pt-8">
              <button type="button" className="apple-btn w-full" onClick={continueWho}>
                Weiter
              </button>
            </div>
          </>
        ) : null}

        {step === "login" ? (
          <>
            <h1 className="font-display text-4xl text-balance">Anmelden</h1>
            <p className="mt-3 text-pretty text-mist">Beides bleibt auf diesem Gerät. Nichts wird weitergegeben.</p>
            <div className="mt-6 space-y-3" role="radiogroup" aria-label="Anmeldung">
              <Choice
                active={draft.login !== "secret"}
                title="Passwort"
                detail="Benutzername und Untis-Passwort."
                onClick={() => {
                  if (draft.login === "secret") setDraft({ ...draft, login: "password", password: "" });
                }}
              />
              <Choice
                active={draft.login === "secret"}
                title="Schul-Login"
                detail="Microsoft, IServ, Office 365. Kein Untis-Passwort."
                onClick={() => {
                  if (draft.login !== "secret") setDraft({ ...draft, login: "secret", password: "" });
                }}
              />
            </div>

            {draft.login === "secret" ? (
              <div className="mt-5">
                <p className="text-pretty text-sm text-mist">
                  Das Passwort von Microsoft oder IServ gehört hier nicht hinein. Den Zugang gibt es in WebUntis
                  selbst.
                </p>
                <ol className="mt-4 space-y-3">
                  {SSO_STEPS.map((text, itemIndex) => (
                    <li key={text} className="flex gap-3 text-sm">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fill font-medium text-chalk">
                        {itemIndex + 1}
                      </span>
                      <span className="pt-0.5 text-pretty text-mist">{text}</span>
                    </li>
                  ))}
                </ol>
                <input
                  ref={qrInput}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => void onQrFile(event.target.files?.[0])}
                />
                <button
                  type="button"
                  className="apple-btn apple-btn-plain mt-4 w-full"
                  onClick={() => qrInput.current?.click()}
                  disabled={qrBusy}
                >
                  <QrCode className="size-4" aria-hidden="true" />
                  {qrBusy ? "QR wird gelesen …" : "QR-Code fotografieren"}
                </button>
                <div className="mt-3">
                  <Field label="oder Code einfügen">
                    <input
                      className="flur-field"
                      value={draft.password}
                      onChange={(event) => onAccessChange(event.target.value)}
                      placeholder="Link oder Code"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>
                </div>
                <div className="mt-3">
                  <Field label="Benutzer">
                    <input
                      className="flur-field"
                      value={draft.user}
                      onChange={(event) => setDraft({ ...draft, user: event.target.value })}
                      autoComplete="username"
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
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
                    onChange={(event) => setDraft({ ...draft, password: event.target.value, login: "password" })}
                    autoComplete="current-password"
                  />
                </Field>
              </div>
            )}
            {hint ? <p className="mt-3 text-sm text-pretty text-rust">{hint}</p> : null}
            <div className="mt-auto flex flex-col gap-3 pt-8">
              <button type="button" className="apple-btn w-full disabled:opacity-60" onClick={() => void continueLogin()} disabled={checking}>
                {checking ? "Wird geprüft …" : "Weiter"}
              </button>
              <button type="button" className="h-11 text-sm font-medium text-mist" onClick={() => go("who")}>
                Ohne Konto weiter
              </button>
            </div>
          </>
        ) : null}

        {step === "route" ? (
          <>
            <h1 className="font-display text-4xl text-balance">Unterwegs</h1>
            <p className="mt-3 text-pretty text-mist">
              Anschluss sucht selbst die schnellste Kombination aus Bus, Rad und Fuß. Nur Auto fährt den ganzen Weg ohne Zug.
            </p>
            <div className="mt-5">
              <ModePicker mode={draft.mode} onChange={(mode) => setDraft({ ...draft, mode })} />
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Heimatadresse">
                <input
                  className="flur-field"
                  value={draft.homeAddress}
                  onChange={(event) => setDraft({ ...draft, homeAddress: event.target.value })}
                  autoComplete="street-address"
                  placeholder="Straße, Ort"
                />
              </Field>
              {draft.mode === "drive" ? null : (
                <Field label="Bahnhof">
                  <input
                    className="flur-field"
                    value={draft.station}
                    onChange={(event) => setDraft({ ...draft, station: event.target.value })}
                    placeholder="Bahnhof zu Hause"
                  />
                </Field>
              )}
              {draft.mode === "drive" ? null : (
                <Field label="Halt an der Schule">
                  <input
                    className="flur-field"
                    value={draft.schoolStop}
                    onChange={(event) => setDraft({ ...draft, schoolStop: event.target.value })}
                    placeholder="Bahnhof Traunstein"
                  />
                </Field>
              )}
              {draft.mode === "drive" || draft.mode === "link" ? (
                <Field label={draft.mode === "drive" ? "Adresse der Schule" : "Adresse der Schule, falls der Halt nicht direkt davor ist"}>
                  <input
                    className="flur-field"
                    value={draft.schoolAddress}
                    onChange={(event) => setDraft({ ...draft, schoolAddress: event.target.value })}
                    autoComplete="street-address"
                    placeholder="Berufsschule, Straße, Ort"
                  />
                </Field>
              ) : null}
            </div>
            <div className="mt-auto flex flex-col gap-3 pt-8">
              <button type="button" className="apple-btn w-full" onClick={() => go("done")}>
                Weiter
              </button>
              <button type="button" className="h-11 text-sm font-medium text-mist" onClick={() => go("done")}>
                Ohne Weg weiter
              </button>
            </div>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <h1 className="font-display text-4xl text-balance">Bereit</h1>
            <p className="mt-3 text-pretty text-mist">So startet die Tafel.</p>
            <dl className="mt-6 overflow-hidden rounded-board border border-line bg-panel">
              <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-4">
                <dt className="text-mist">Stundenplan</dt>
                <dd className="truncate font-medium">{planLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-4">
                <dt className="text-mist">Weg</dt>
                <dd className="truncate font-medium">{routeLabel}</dd>
              </div>
            </dl>
            <label className="mt-4 flex items-center gap-4 rounded-board border border-line bg-panel px-4 py-4">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Automatisch wechseln</span>
                <span className="mt-1 block text-sm text-pretty text-mist">Heute, Hinweg und Heimweg im Wechsel.</span>
              </span>
              <input
                type="checkbox"
                className="apple-switch"
                checked={draft.kioskRotate}
                onChange={(event) => setDraft({ ...draft, kioskRotate: event.target.checked })}
              />
            </label>
            <div className="mt-auto pt-8">
              <button type="button" className="apple-btn w-full" onClick={() => onDone(draft)}>
                Zur Tafel
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
