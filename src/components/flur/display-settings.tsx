import { TimeFace } from "@/components/flur/clock-face";
import { countdownClock, wallClock, type FaceStyle } from "@/lib/flur/settings";
import type { AnalogDesign, ClockFace, ClockSize, ClockUnit, DigitalDesign, NameFit, Settings, ThemeId } from "@/lib/flur/types";

const UNIT_HINT: Record<ClockUnit, string> = {
  auto: "Sekunden auf dem großen Schirm, Minuten auf dem Handy.",
  second: "Sekunden bleiben sichtbar.",
  minute: "Ohne Sekunden.",
  hour: "Nur die Stunde.",
};

const COUNT_UNIT_HINT: Record<ClockUnit, string> = {
  ...UNIT_HINT,
  auto: "Sekunden auf dem großen Schirm, Minuten auf dem Handy. Dauert der Countdown noch Stunden, fallen die Sekunden weg.",
};

const SIZE_HINT: Record<ClockSize, string> = {
  auto: "Klein auf dem Handy, mittel auf dem großen Schirm.",
  s: "Klein, auch auf dem großen Schirm.",
  m: "Mittel.",
  l: "Groß, auch auf dem Handy.",
};

const NAME_HINT: Record<NameFit, string> = {
  auto: "Schmale Bildschirme kürzen, breite schreiben aus.",
  short: "Fächer und Lehrkräfte als Kürzel, zum Beispiel M und Kel.",
  long: "Ausgeschrieben, auch wenn die Zeile umbricht.",
  scroll: "Der ganze Name läuft hin und her, wenn er nicht in die Zeile passt.",
};

function Seg<T extends string>({
  label,
  group,
  value,
  options,
  columns,
  onChange,
}: {
  label: string;
  group: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  columns: string;
  onChange: (id: T) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm text-mist">{label}</p>
      <div className={"apple-seg " + columns} role="radiogroup" aria-label={`${group}: ${label}`}>
        {options.map((option) => (
          <button key={option.id} type="button" role="radio" aria-checked={value === option.id} onClick={() => onChange(option.id)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClockControls({
  group,
  style,
  hints,
  onChange,
}: {
  group: string;
  style: FaceStyle;
  hints: Record<ClockUnit, string>;
  onChange: (patch: Partial<FaceStyle>) => void;
}) {
  const digital: Array<{ id: DigitalDesign; label: string }> = [
    { id: "serif", label: "Schrift" },
    { id: "split", label: "Felder" },
    { id: "led", label: "Leucht" },
  ];
  const analog: Array<{ id: AnalogDesign; label: string }> = [
    { id: "chalk", label: "Kreide" },
    { id: "ring", label: "Ring" },
    { id: "school", label: "Schule" },
  ];
  return (
    <div className="space-y-4">
      <Seg
        group={group}
        label="Art"
        value={style.face}
        columns="grid-cols-2"
        options={[
          { id: "digital" as ClockFace, label: "Digital" },
          { id: "analog" as ClockFace, label: "Analog" },
        ]}
        onChange={(face) => onChange({ face })}
      />
      {style.face === "digital" ? (
        <Seg
          group={group}
          label="Design"
          value={style.digital}
          columns="grid-cols-3"
          options={digital}
          onChange={(digitalDesign) => onChange({ digital: digitalDesign })}
        />
      ) : (
        <Seg
          group={group}
          label="Design"
          value={style.analog}
          columns="grid-cols-3"
          options={analog}
          onChange={(analogDesign) => onChange({ analog: analogDesign })}
        />
      )}
      <div>
        <Seg
          group={group}
          label="Kleinste Einheit"
          value={style.unit}
          columns="grid-cols-2"
          options={[
            { id: "auto" as ClockUnit, label: "Auto" },
            { id: "second" as ClockUnit, label: "Sekunde" },
            { id: "minute" as ClockUnit, label: "Minute" },
            { id: "hour" as ClockUnit, label: "Stunde" },
          ]}
          onChange={(unit) => onChange({ unit })}
        />
        <p className="mt-2 text-sm text-pretty text-mist">{hints[style.unit]}</p>
      </div>
      <div>
        <Seg
          group={group}
          label="Größe"
          value={style.size}
          columns="grid-cols-2"
          options={[
            { id: "auto" as ClockSize, label: "Auto" },
            { id: "s" as ClockSize, label: "Klein" },
            { id: "m" as ClockSize, label: "Mittel" },
            { id: "l" as ClockSize, label: "Groß" },
          ]}
          onChange={(size) => onChange({ size })}
        />
        <p className="mt-2 text-sm text-pretty text-mist">{SIZE_HINT[style.size]}</p>
      </div>
    </div>
  );
}

function applyWall(patch: Partial<FaceStyle>): Partial<Settings> {
  const next: Partial<Settings> = {};
  if (patch.face) next.clockFace = patch.face;
  if (patch.digital) next.clockDigital = patch.digital;
  if (patch.analog) next.clockAnalog = patch.analog;
  if (patch.unit) next.clockUnit = patch.unit;
  if (patch.size) next.clockSize = patch.size;
  return next;
}

function applyCount(patch: Partial<FaceStyle>): Partial<Settings> {
  const next: Partial<Settings> = {};
  if (patch.face) next.countFace = patch.face;
  if (patch.digital) next.countDigital = patch.digital;
  if (patch.analog) next.countAnalog = patch.analog;
  if (patch.unit) next.countUnit = patch.unit;
  if (patch.size) next.countSize = patch.size;
  return next;
}

export function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (theme: ThemeId) => void }) {
  const options: Array<{ id: ThemeId; label: string; hint: string }> = [
    { id: "chalk", label: "Kreide", hint: "Volles Gold, ruhige Flächen." },
    { id: "glass", label: "Glas", hint: "Mehr Transparenz, flüssiges Glas." },
  ];
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Erscheinung">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className={"theme-swatch " + (value === option.id ? "theme-swatch-on" : "")}
          onClick={() => onChange(option.id)}
        >
          <span className={"theme-chip theme-chip-" + option.id} aria-hidden="true" />
          <span className="mt-3 block font-medium">{option.label}</span>
          <span className="mt-1 block text-sm text-pretty text-mist">{option.hint}</span>
        </button>
      ))}
    </div>
  );
}

export function DisplaySettings({
  settings,
  now,
  remainMs,
  onChange,
}: {
  settings: Settings;
  now: Date | null;
  remainMs: number | null;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const sample = !settings.countdown || remainMs == null;
  const previewMs = remainMs ?? (28 * 60 + 36) * 1000;
  const wall = wallClock(settings);
  const count = countdownClock(settings);
  return (
    <div className="mt-3 overflow-hidden rounded-board border border-line bg-panel">
      <details className="flur-fold border-b border-line">
        <summary>
          <span className="block font-medium">Erscheinung</span>
          <span className="mt-0.5 block text-sm text-mist">{settings.theme === "glass" ? "Glas" : "Kreide"}</span>
        </summary>
        <div className="flur-fold-body">
          <p className="mb-3 text-sm text-pretty text-mist">Kreide bleibt die volle Tafel. Glas lässt den Goldton durchscheinen.</p>
          <ThemePicker value={settings.theme} onChange={(theme) => onChange({ theme })} />
        </div>
      </details>
      <details className="flur-fold border-b border-line">
        <summary>
          <span className="block font-medium">Namen</span>
          <span className="mt-0.5 block text-sm text-mist">{NAME_HINT[settings.nameFit].split(".")[0]}</span>
        </summary>
        <div className="flur-fold-body">
          <Seg
            group="Namen"
            label="Darstellung"
            value={settings.nameFit}
            columns="grid-cols-2"
            options={[
              { id: "auto", label: "Auto" },
              { id: "short", label: "Kürzel" },
              { id: "long", label: "Ganz" },
              { id: "scroll", label: "Laufen" },
            ]}
            onChange={(nameFit) => onChange({ nameFit })}
          />
          <p className="mt-2 text-sm text-pretty text-mist">{NAME_HINT[settings.nameFit]}</p>
        </div>
      </details>
      <details className="flur-fold">
        <summary>
          <span className="block font-medium">Uhr</span>
          <span className="mt-0.5 block text-sm text-mist">
            {settings.clockFace === "analog" ? "Analog" : "Digital"}
            {settings.countdownOwn ? " · Countdown separat" : ""}
          </span>
        </summary>
        <div className="flur-fold-body">
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-xl border border-line bg-canvas px-4 py-4">
          <div className="min-w-0">
            <p className="mb-2 text-xs text-mist">Uhrzeit</p>
            <TimeFace
              kind="rtc"
              now={now}
              remainMs={null}
              face={wall.face}
              digital={wall.digital}
              analog={wall.analog}
              unit={wall.unit}
              size={wall.size}
              align="start"
            />
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-right text-xs text-mist">{sample ? "Beispiel" : "Countdown"}</p>
            <TimeFace
              kind="countdown"
              now={now}
              remainMs={previewMs}
              face={count.face}
              digital={count.digital}
              analog={count.analog}
              unit={count.unit}
              size={count.size}
            />
          </div>
        </div>
        <div className="mt-5">
          <h4 className="text-sm font-medium text-chalk">Uhrzeit</h4>
          <div className="mt-3">
            <ClockControls group="Uhrzeit" style={wall} hints={UNIT_HINT} onChange={(patch) => onChange(applyWall(patch))} />
          </div>
        </div>
        <label className="mt-5 flex items-center gap-4 rounded-xl border border-line px-4 py-4">
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Countdown separat</span>
            <span className="mt-1 block text-sm text-pretty text-mist">
              Art, Design, Einheit und Größe nur für den Countdown. Die Uhrzeit oben bleibt, wie sie ist.
            </span>
          </span>
          <input
            type="checkbox"
            className="apple-switch"
            checked={settings.countdownOwn}
            onChange={(event) => {
              if (!event.target.checked) {
                onChange({ countdownOwn: false });
                return;
              }
              onChange({
                countdownOwn: true,
                countFace: settings.clockFace,
                countDigital: settings.clockDigital,
                countAnalog: settings.clockAnalog,
                countUnit: settings.clockUnit,
                countSize: settings.clockSize,
              });
            }}
          />
        </label>
        {settings.countdownOwn ? (
          <div className="mt-5">
            <h4 className="text-sm font-medium text-chalk">Countdown</h4>
            <div className="mt-3">
              <ClockControls
                group="Countdown"
                style={count}
                hints={COUNT_UNIT_HINT}
                onChange={(patch) => onChange(applyCount(patch))}
              />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-pretty text-mist">Der Countdown übernimmt die Uhrzeit.</p>
        )}
        </div>
      </details>
    </div>
  );
}
