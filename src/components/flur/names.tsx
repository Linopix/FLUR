import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { resolveFit } from "@/lib/flur/names";
import type { NameFit, NameMode } from "@/lib/flur/types";

function subscribeNarrow(onChange: () => void) {
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function narrowNow() {
  return window.matchMedia("(max-width: 767px)").matches;
}

export function useNameMode(fit: NameFit): NameMode {
  const narrow = useSyncExternalStore(subscribeNarrow, narrowNow, () => false);
  return resolveFit(fit, narrow);
}

export function NameLine({
  text,
  label,
  mode,
  className = "",
}: {
  text: string;
  label?: string;
  mode: NameMode;
  className?: string;
}) {
  const title = label && label !== text ? label : undefined;
  const boxRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (mode !== "scroll" || reduce) return;
    const box = boxRef.current;
    const node = box?.firstElementChild;
    if (!box || !(node instanceof HTMLElement)) return;
    const measure = () => {
      const width = box.clientWidth;
      const need = node.scrollWidth - width;
      setShift(width > 0 && need > 6 ? need : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [mode, reduce, text]);

  if (mode === "long") {
    return (
      <span className={"block text-pretty " + className} title={title}>
        {text}
      </span>
    );
  }
  if (mode !== "scroll" || reduce) {
    return (
      <span className={"block truncate " + className} title={title}>
        {text}
      </span>
    );
  }
  const seconds = Math.min(12, Math.max(2.8, shift / 36));
  return (
    <span ref={boxRef} className="block w-full min-w-0 overflow-hidden" title={title ?? text}>
      <span
        className={"inline-block whitespace-nowrap " + className}
        style={
          shift > 0
            ? {
                ["--flur-shift" as string]: `-${shift}px`,
                animation: `flur-pingpong ${seconds}s ease-in-out infinite`,
              }
            : undefined
        }
      >
        {text}
      </span>
    </span>
  );
}
