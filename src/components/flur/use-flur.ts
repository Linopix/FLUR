import { useCallback, useEffect, useMemo, useState } from "react";
import { demoBoard, demoTrip } from "@/lib/flur/demo";
import { fetchBoard, fetchDesk, fetchServerBoard, fetchServerDesk, fetchServerProfile, fetchTrip } from "@/lib/flur/fns";
import { SERVER_CACHE_OWNER, cacheOwner, cachedAfterFailure, isAuthFailure, loadBoardCache, loadDeskCache, saveBoardCache, saveDeskCache } from "@/lib/flur/cache";
import { demoDesk, type DeskData } from "@/lib/flur/desk";
import { outboundAim, returnAim } from "@/lib/flur/plan";
import { emptySettings, hasUntis, loadSettings, saveSettings, applyTheme } from "@/lib/flur/settings";
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
  const [boardFromCache, setBoardFromCache] = useState(false);
  const [boardOffline, setBoardOffline] = useState(false);
  const [hin, setHin] = useState<TripPlan | null>(null);
  const [heim, setHeim] = useState<TripPlan | null>(null);
  const [tripError, setTripError] = useState<string | null>(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [desk, setDesk] = useState<DeskData | null>(null);
  const [deskError, setDeskError] = useState<string | null>(null);
  const [deskLoading, setDeskLoading] = useState(false);
  const [deskFromCache, setDeskFromCache] = useState(false);
  const [deskOffline, setDeskOffline] = useState(false);

  useEffect(() => {
    const loaded = loadSettings();
    setSettingsState(loaded);
    if (hasUntis(loaded)) {
      const owner = cacheOwner(loaded);
      const board = loadBoardCache(owner);
      if (board) {
        setToday(board.today);
        setTomorrow(board.tomorrow);
        setBoardFromCache(true);
      }
      const cachedDesk = loadDeskCache(owner);
      if (cachedDesk) {
        setDesk(cachedDesk);
        setDeskFromCache(true);
      }
    }
    setHydrated(true);
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyTheme(settings.theme);
  }, [hydrated, settings.theme]);

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
      schoolAddress: settings.schoolAddress.trim() || profile?.schoolAddress || "",
      mode,
    };
  }, [profile, settings.homeAddress, settings.mode, settings.schoolAddress, settings.schoolStop, settings.station]);

  const exampleRoute =
    hydrated &&
    !route.homeAddress.trim() &&
    !route.station.trim() &&
    !route.schoolStop.trim() &&
    !route.schoolAddress.trim();

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    let boardDenied = false;
    const run = async () => {
      if (!deviceUntis && !serverUntis) {
        const stamp = new Date();
        setToday(demoBoard("today", stamp));
        setTomorrow(demoBoard("tomorrow", stamp));
        setBoardLive(false);
        setBoardError(null);
        setBoardFromCache(false);
        setBoardOffline(false);
        setBoardLoading(false);
        return;
      }
      const owner = deviceUntis ? cacheOwner(settings) : SERVER_CACHE_OWNER;
      if (!boardDenied) {
        const primed = loadBoardCache(owner);
        if (primed) {
          setToday(primed.today);
          setTomorrow(primed.tomorrow);
          setBoardLive(false);
          setBoardError(null);
          setBoardFromCache(true);
          setBoardOffline(false);
        } else {
          setToday(BLANK_DAY);
          setTomorrow(BLANK_DAY);
          setBoardLive(false);
          setBoardFromCache(false);
          setBoardOffline(false);
        }
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
          setBoardFromCache(false);
          setBoardOffline(false);
          saveBoardCache(owner, result.today, result.tomorrow);
          boardDenied = false;
        } else {
          boardDenied = isAuthFailure(result.error);
          const view = cachedAfterFailure(result.error, boardDenied ? null : loadBoardCache(owner));
          setBoardLive(false);
          if (view.show) {
            setToday(view.show.today);
            setTomorrow(view.show.tomorrow);
          } else {
            setToday(BLANK_DAY);
            setTomorrow(BLANK_DAY);
          }
          setBoardError(view.error);
          setBoardFromCache(Boolean(view.show));
          setBoardOffline(view.offline);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Stundenplan nicht geladen.";
          boardDenied = isAuthFailure(message);
          const view = cachedAfterFailure(message, boardDenied ? null : loadBoardCache(owner));
          setBoardLive(false);
          if (view.show) {
            setToday(view.show.today);
            setTomorrow(view.show.tomorrow);
          } else {
            setToday(BLANK_DAY);
            setTomorrow(BLANK_DAY);
          }
          setBoardError(view.error);
          setBoardFromCache(Boolean(view.show));
          setBoardOffline(view.offline);
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
    let deskDenied = false;
    const run = async () => {
      if (!deviceUntis && !serverUntis) {
        setDesk(demoDesk(new Date()));
        setDeskError(null);
        setDeskFromCache(false);
        setDeskOffline(false);
        setDeskLoading(false);
        return;
      }
      const owner = deviceUntis ? cacheOwner(settings) : SERVER_CACHE_OWNER;
      if (!deskDenied) {
        const primed = loadDeskCache(owner);
        if (primed) {
          setDesk(primed);
          setDeskError(null);
          setDeskFromCache(true);
          setDeskOffline(false);
        } else {
          setDesk(null);
          setDeskFromCache(false);
          setDeskOffline(false);
        }
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
          setDeskOffline(false);
          saveDeskCache(owner, result.desk);
          deskDenied = false;
        } else {
          deskDenied = isAuthFailure(result.error);
          const view = cachedAfterFailure(result.error, deskDenied ? null : loadDeskCache(owner));
          setDesk(view.show);
          setDeskError(view.error);
          setDeskFromCache(Boolean(view.show));
          setDeskOffline(view.offline);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Schuldaten nicht geladen.";
          deskDenied = isAuthFailure(message);
          const view = cachedAfterFailure(message, deskDenied ? null : loadDeskCache(owner));
          setDesk(view.show);
          setDeskError(view.error);
          setDeskFromCache(Boolean(view.show));
          setDeskOffline(view.offline);
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
              schoolAddress: route.schoolAddress,
              mode: route.mode,
              direction: "hin",
              departAt: stamp.toISOString(),
              arriveBy: out?.arriveBy ?? "",
              classEnd: "",
              focus: out?.focus ?? "",
              example: exampleRoute,
              deutschlandticket: settings.deutschlandticket,
            },
          }),
          fetchTrip({
            data: {
              homeAddress: route.homeAddress,
              station: route.station,
              schoolStop: route.schoolStop,
              schoolAddress: route.schoolAddress,
              mode: route.mode,
              direction: "heim",
              departAt: back.departAt,
              arriveBy: "",
              classEnd: back.classEnd,
              focus: back.focus,
              example: exampleRoute,
              deutschlandticket: settings.deutschlandticket,
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
  }, [clockReady, exampleRoute, hydrated, route.homeAddress, route.mode, route.schoolAddress, route.schoolStop, route.station, settings.deutschlandticket, today, tomorrow]);

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
    setBoardFromCache(false);
    setBoardOffline(false);
    setDesk(demoDesk(new Date()));
    setDeskError(null);
    setDeskFromCache(false);
    setDeskOffline(false);
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
    boardFromCache,
    boardOffline,
    hin,
    heim,
    tripError,
    tripLoading,
    desk,
    deskError,
    deskLoading,
    deskFromCache,
    deskOffline,
    exampleRoute,
    deviceUntis,
    serverUntis,
    route,
    setSettings,
    setMode,
    resetSettings,
  };
}
