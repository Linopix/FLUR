import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { clockTextClass, formatCountdown, formatRtc, resolveSize, resolveUnit, type FixedSize, type FixedUnit } from "@/lib/flur/clock";
import { berlinParts } from "@/lib/flur/time";
import type { AnalogDesign, ClockFace, ClockSize, ClockUnit, DigitalDesign } from "@/lib/flur/types";

function polar(angle: number, length: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: 50 + Math.cos(rad) * length, y: 50 + Math.sin(rad) * length };
}

function subscribeNarrow(onChange: () => void) {
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function narrowNow() {
  return window.matchMedia("(max-width: 767px)").matches;
}

export function useNarrow() {
  return useSyncExternalStore(subscribeNarrow, narrowNow, () => false);
}

function handsOf(date: Date | null, remainMs: number | null, kind: "rtc" | "countdown", unit: FixedUnit) {
  if (kind === "countdown") {
    const total = Math.max(0, (remainMs ?? 0) / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = Math.floor(total % 60);
    return {
      hour: (hours % 12) * 30 + (unit === "hour" ? 0 : minutes * 0.5),
      minute: minutes * 6 + (unit === "second" ? seconds * 0.1 : 0),
      second: seconds * 6,
      showMinute: unit !== "hour",
      showSecond: unit === "second",
    };
  }
  const parts = date ? berlinParts(date) : { hour: 0, minute: 0, second: 0 };
  const minutes = unit === "hour" ? 0 : parts.minute;
  return {
    hour: (parts.hour % 12) * 30 + minutes * 0.5,
    minute: minutes * 6 + (unit === "second" ? parts.second * 0.1 : 0),
    second: parts.second * 6,
    showMinute: unit !== "hour",
    showSecond: unit === "second",
  };
}

function useSweep(angle: number) {
  const prev = useRef(angle);
  const acc = useRef(angle);
  const [motion, setMotion] = useState({ value: angle, smooth: false });
  useEffect(() => {
    const raw = angle - prev.current;
    const jump = Math.abs(raw) > 30;
    let delta = raw;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    prev.current = angle;
    if (delta === 0) return;
    acc.current = jump ? angle : acc.current + delta;
    setMotion({ value: acc.current, smooth: !jump });
  }, [angle]);
  return motion;
}

function Hand({
  angle,
  length,
  width,
  className,
}: {
  angle: number;
  length: number;
  width: number;
  className: string;
}) {
  const sweep = useSweep(angle);
  return (
    <g
      className={"flur-hand " + className + (sweep.smooth ? " flur-hand-sweep" : "")}
      style={{ transform: `rotate(${sweep.value}deg)` }}
    >
      <line x1="50" y1="54" x2="50" y2={50 - length} stroke="currentColor" strokeWidth={width} strokeLinecap="round" />
    </g>
  );
}

function AnalogFace({
  design,
  size,
  hour,
  minute,
  second,
  showMinute,
  showSecond,
}: {
  design: AnalogDesign;
  size: FixedSize;
  hour: number;
  minute: number;
  second: number;
  showMinute: boolean;
  showSecond: boolean;
}) {
  const px = size === "s" ? 104 : size === "l" ? 188 : 140;
  const ring = design === "ring";
  const numbers = design === "school" ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : [];
  return (
    <svg width={px} height={px} viewBox="0 0 100 100" aria-hidden="true" className="shrink-0 text-chalk">
      <circle cx="50" cy="50" r="46" fill="var(--canvas)" stroke="currentColor" strokeWidth={ring ? 1.15 : 2.4} />
      {design === "chalk"
        ? Array.from({ length: 12 }, (_, index) => {
            const major = index % 3 === 0;
            return (
              <line
                key={index}
                x1="50"
                y1={major ? 10 : 12}
                x2="50"
                y2={major ? 18 : 16}
                stroke="currentColor"
                strokeWidth={major ? 1.8 : 0.9}
                strokeLinecap="round"
                transform={`rotate(${index * 30} 50 50)`}
              />
            );
          })
        : null}
      {ring ? <circle cx="50" cy="8" r="1.6" fill="currentColor" /> : null}
      {numbers.map((value) => {
        const at = polar(value * 30, 33);
        return (
          <text
            key={value}
            x={at.x}
            y={at.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="currentColor"
            fontSize="7.5"
            fontFamily="Outfit, sans-serif"
            className="text-mist"
          >
            {value}
          </text>
        );
      })}
      <Hand angle={hour} length={ring ? 22 : 24} width={ring ? 1.7 : 2.8} className="text-paper" />
      {showMinute ? <Hand angle={minute} length={ring ? 32 : 34} width={ring ? 1.15 : 1.7} className="text-chalk" /> : null}
      {showSecond ? <Hand angle={second} length={38} width={0.85} className="text-rust" /> : null}
      <circle cx="50" cy="50" r="2.1" fill="currentColor" />
      <circle cx="50" cy="50" r="0.9" className="text-rust" fill="currentColor" />
    </svg>
  );
}

function DigitalFace({
  text,
  design,
  size,
  align,
}: {
  text: string;
  design: DigitalDesign;
  size: FixedSize;
  align: "start" | "end";
}) {
  const tone = clockTextClass(size);
  if (design === "led") {
    return <span className={"flur-led tabular-nums leading-none " + tone}>{text}</span>;
  }
  if (design === "serif") {
    return <span className={"font-display tabular-nums leading-none " + tone}>{text}</span>;
  }
  const box = size === "s" ? "text-2xl" : size === "l" ? "text-4xl md:text-6xl" : "text-3xl md:text-5xl";
  return (
    <span className={"inline-flex max-w-full flex-wrap items-center gap-1 " + (align === "end" ? "justify-end" : "justify-start")}>
      {[...text].map((glyph, index) =>
        glyph === " " ? (
          <span key={index} className="w-1" />
        ) : glyph === ":" ? (
          <span key={index} className={"px-0.5 font-display leading-none text-chalk " + box}>
            :
          </span>
        ) : (
          <span
            key={index}
            className={
              "inline-flex min-w-[1.15ch] items-center justify-center rounded-md bg-canvas px-1 font-display leading-none tabular-nums " + box
            }
          >
            {glyph}
          </span>
        ),
      )}
    </span>
  );
}

export function TimeFace({
  kind,
  now,
  remainMs,
  face,
  digital,
  analog,
  unit,
  size,
  align = "end",
}: {
  kind: "rtc" | "countdown";
  now: Date | null;
  remainMs: number | null;
  face: ClockFace;
  digital: DigitalDesign;
  analog: AnalogDesign;
  unit: ClockUnit;
  size: ClockSize;
  align?: "start" | "end";
}) {
  const narrow = useNarrow();
  const fixedUnit = resolveUnit(unit, narrow, kind === "countdown" ? remainMs : null, kind);
  const fixedSize = resolveSize(size, narrow);
  const text = kind === "rtc" ? (now ? formatRtc(now, fixedUnit) : "––:––") : formatCountdown(remainMs ?? 0, fixedUnit);
  const hands = handsOf(now, remainMs, kind, fixedUnit);
  return (
    <div className={"inline-flex max-w-full flex-col " + (align === "end" ? "items-end" : "items-start")} role="group" aria-label={text}>
      <span className="sr-only">{text}</span>
      <div aria-hidden="true">
        {face === "analog" ? (
          <AnalogFace
            design={analog}
            size={fixedSize}
            hour={hands.hour}
            minute={hands.minute}
            second={hands.second}
            showMinute={hands.showMinute}
            showSecond={hands.showSecond}
          />
        ) : (
          <DigitalFace text={text} design={digital} size={fixedSize} align={align} />
        )}
      </div>
      {kind === "rtc" && fixedUnit === "hour" && face === "digital" ? <span className="mt-1 text-sm text-mist">Uhr</span> : null}
    </div>
  );
}
