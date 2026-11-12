import { useCallback, useEffect, useMemo, useState } from "react";
import { demoBoard, demoTrip } from "@/lib/flur/demo";
import { fetchBoard, fetchDesk, fetchServerBoard, fetchServerDesk, fetchServerProfile, fetchTrip } from "@/lib/flur/fns";
import { loadDeskCache, saveDeskCache } from "@/lib/flur/cache";
import { demoDesk, type DeskData } from "@/lib/flur/desk";
import { outboundAim, returnAim } from "@/lib/flur/plan";
import { emptySettings, hasUntis, loadSettings, saveSettings } from "@/lib/flur/settings";
import type { DayBoard, Mode, ServerProfile, Settings, TripPlan } from "@/lib/flur/types";

const BLANK_DAY: DayBoard = { source: "demo", iso: "", lessons: [] };

export function useFlur() {
  const [settings, setSettingsState] = useState<Settings>(emptySettings);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [profile, setProfile] = useState<ServerProfile | null>(null);
  const [today, setToday] = useState<DayBoard>(BLANK_DAY);
  const [tomorrow, setTomorrow] = useState<DayBoard>(BLANK_DAY);
  const [boardLive, setBoardLive] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [hin, setHin] = useState<TripPlan | null>(null);
  const [heim, setHeim] = useState<TripPlan | null>(null);
  const [tripError, setTripError] = useState<string | null>(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [desk, setDesk] = useState<DeskData | null>(null);
  const [deskError, setDeskError] = useState<string | null>(null);
  const [deskLoading, setDeskLoading] = useState(false);
  const [deskFromCache, setDeskFromCache] = useState(false);

  useEffect(() => {
    setSettingsState(loadSettings());
    setHydrated(true);
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchServerProfile()
      .then((value) => {
        if (!cancelled) setProfile(value);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const deviceUntis = hydrated && hasUntis(settings);
  const serverUntis = Boolean(profile?.webuntis) && !deviceUntis;

  const route = useMemo(() => {
    const mode = (settings.mode || profile?.mode || "bike") as Mode;
    return {
      homeAddress: settings.homeAddress.trim() || profile?.home || "",
      station: settings.station.trim() || profile?.station || "",
      schoolStop: settings.schoolStop.trim() || profile?.schoolStop || "",
      mode,
    };
  }, [profile, settings.homeAddress, settings.mode, settings.schoolStop, settings.station]);

  const exampleRoute =
    hydrated && !route.homeAddress.trim() && !route.station.trim() && !route.schoolStop.trim();

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const run = async () => {
      if (!deviceUntis && !serverUntis) {
        const stamp = new Date();
        setToday(demoBoard("today", stamp));
        setTomorrow(demoBoard("tomorrow", stamp));
        setBoardLive(false);
        setBoardError(null);
        setBoardLoading(false);
        return;
      }
      setBoardLoading(true);
      try {
        const result = deviceUntis
          ? await fetchBoard({
              data: {
                baseUrl: settings.baseUrl,
                school: settings.school,
                user: settings.user,
                password: settings.password,
                login: settings.login,
                who: settings.who,
                whoName: settings.whoName,
              },
            })
          : await fetchServerBoard();
        if (cancelled) return;
        if (result.ok) {
          setToday(result.today);
          setTomorrow(result.tomorrow);
          setBoardLive(true);
          setBoardError(null);
        } else {
          setBoardLive(false);
          setBoardError(result.error);
        }
      } catch (error) {
        if (!cancelled) {
          setBoardLive(false);
          setBoardError(error instanceof Error ? error.message : "Stundenplan nicht geladen.");
        }
      } finally {
        if (!cancelled) setBoardLoading(false);
      }
    };
    void run();
    const id = window.setInterval(() => void run(), 3 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    deviceUntis,
    hydrated,
    serverUntis,
    settings.baseUrl,
    settings.password,
    settings.login,
    settings.school,
    settings.user,
    settings.who,
    settings.whoName,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const run = async () => {
      if (!deviceUntis && !serverUntis) {
        setDesk(demoDesk(new Date()));
        setDeskError(null);
        setDeskFromCache(false);
        setDeskLoading(false);
        return;
      }
      setDeskLoading(true);
      try {
        const result = deviceUntis
          ? await fetchDesk({
              data: {
                baseUrl: settings.baseUrl,
                school: settings.school,
                user: settings.user,
                password: settings.password,
                login: settings.login,
                who: settings.who,
                whoName: settings.whoName,
              },
            })
          : await fetchServerDesk();
        if (cancelled) return;
        if (result.ok) {
          setDesk(result.desk);
          setDeskError(null);
          setDeskFromCache(false);
          saveDeskCache(result.desk);
        } else {
          const cached = loadDeskCache();
          setDeskError(result.error);
          setDesk(cached);
          setDeskFromCache(Boolean(cached));
        }
      } catch (error) {
        if (!cancelled) {
          const cached = loadDeskCache();
          setDeskError(error instanceof Error ? error.message : "Schuldaten nicht geladen.");
          setDesk(cached);
          setDeskFromCache(Boolean(cached));
        }
      } finally {
        if (!cancelled) setDeskLoading(false);
      }
    };
    void run();
    const id = window.setInterval(() => void run(), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    deviceUntis,
    hydrated,
    serverUntis,
    settings.baseUrl,
    settings.password,
    settings.login,
    settings.school,
    settings.user,
    settings.who,
    settings.whoName,
  ]);

  const clockReady = now != null;

  useEffect(() => {
    if (!hydrated || !clockReady || !today.iso) return;
    let cancelled = false;
    const run = async () => {
      setTripLoading(true);
      const stamp = new Date();
      const out = outboundAim(today, tomorrow, stamp);
      const back = returnAim(today, tomorrow, stamp);
      try {
        const [hinResult, heimResult] = await Promise.all([
          fetchTrip({
            data: {
              homeAddress: route.homeAddress,
              station: route.station,
              schoolStop: route.schoolStop,
              mode: route.mode,
              direction: "hin",
              departAt: stamp.toISOString(),
              arriveBy: out?.arriveBy ?? "",
              classEnd: "",
              focus: out?.focus ?? "",
              example: exampleRoute,
            },
          }),
          fetchTrip({
            data: {
              homeAddress: route.homeAddress,
              station: route.station,
              schoolStop: route.schoolStop,
              mode: route.mode,
              direction: "heim",
              departAt: back.departAt,
              arriveBy: "",
              classEnd: back.classEnd,
              focus: back.focus,
              example: exampleRoute,
            },
          }),
        ]);
        if (cancelled) return;
        const errors: string[] = [];
        if (hinResult.ok) setHin(hinResult.trip);
        else if (exampleRoute) setHin({ ...demoTrip("hin", route.mode, stamp), note: hinResult.error });
        else errors.push(hinResult.error);
        if (heimResult.ok) setHeim(heimResult.trip);
        else if (exampleRoute) setHeim({ ...demoTrip("heim", route.mode, stamp), note: heimResult.error });
        else errors.push(heimResult.error);
        setTripError(errors.length ? errors.join(" ") : null);
      } catch (error) {
        if (!cancelled) {
          setTripError(error instanceof Error ? error.message : "Weg gerade nicht abrufbar.");
        }
      } finally {
        if (!cancelled) setTripLoading(false);
      }
    };
    void run();
    const id = window.setInterval(() => void run(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [clockReady, exampleRoute, hydrated, route.homeAddress, route.mode, route.schoolStop, route.station, today, tomorrow]);

  const setSettings = useCallback((next: Settings) => {
    setSettingsState(next);
    saveSettings(next);
  }, []);

  const setMode = useCallback(
    (mode: Mode) => {
      setSettingsState((current) => {
        const next = { ...current, mode };
        saveSettings(next);
        return next;
      });
    },
    [],
  );

  const resetSettings = useCallback(() => {
    const next = { ...emptySettings(), onboarded: true };
    saveSettings(next);
    setSettingsState(next);
    setHin(null);
    setHeim(null);
    setBoardLive(false);
    setBoardError(null);
    setDesk(demoDesk(new Date()));
    setDeskError(null);
    setDeskFromCache(false);
  }, []);

  return {
    settings,
    hydrated,
    now,
    profile,
    today,
    tomorrow,
    boardLive,
    boardError,
    boardLoading,
    hin,
    heim,
    tripError,
    tripLoading,
    desk,
    deskError,
    deskLoading,
    deskFromCache,
    exampleRoute,
    deviceUntis,
    serverUntis,
    route,
    setSettings,
    setMode,
    resetSettings,
  };
}
