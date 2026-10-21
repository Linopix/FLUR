import {
  SCHOOL_BUFFER_MIN,
  legIsCancelled,
  pickEarliest,
  pickTightest,
  transitLegs,
  type TimedItinerary,
} from "@/lib/flur/plan";
import { delayMinutes } from "@/lib/flur/time";
import {
  EXAMPLE_PLACES,
  MODE_LABEL,
  type Mode,
  type TripLeg,
  type TripPlan,
  type TripResult,
} from "@/lib/flur/types";

type Point = { lat: number; lon: number; name: string };

type PlaceTime = {
  name?: string;
  departure?: string;
  arrival?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  track?: string;
  description?: string;
  cancelled?: boolean;
};

type RawLeg = {
  mode?: string;
  duration?: number;
  headsign?: string;
  routeShortName?: string;
  displayName?: string;
  cancelled?: boolean;
  realTime?: boolean;
  from?: PlaceTime;
  to?: PlaceTime;
};

type RawItinerary = TimedItinerary & {
  duration?: number;
  legs?: RawLeg[];
};

const RAIL = "HIGHSPEED_RAIL,NIGHT_RAIL,LONG_DISTANCE,REGIONAL_FAST_RAIL,REGIONAL_RAIL,SUBURBAN";
const BUS = "BUS,TRAM,SUBWAY,COACH";
const PUNCTUAL_MAX = 2;

const geoCache = new Map<string, { at: number; point: Point }>();
const planCache = new Map<string, { at: number; trip: TripPlan }>();

async function getJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "FLUR-Kiosk/1.0 (private school display)", ...headers },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Abfrage fehlgeschlagen (${response.status}).`);
  return (await response.json()) as T;
}

async function geocodeAddress(query: string): Promise<Point> {
  const key = `addr:${query.toLowerCase()}`;
  const cached = geoCache.get(key);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.point;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);
  const rows = await getJson<Array<{ lat: string; lon: string; display_name: string }>>(url.toString());
  const hit = rows[0];
  if (!hit) throw new Error(`Adresse nicht gefunden: ${query}`);
  const point = { lat: Number(hit.lat), lon: Number(hit.lon), name: hit.display_name.split(",")[0] ?? query };
  geoCache.set(key, { at: Date.now(), point });
  return point;
}

async function geocodeStop(query: string): Promise<Point> {
  const key = `stop:${query.toLowerCase()}`;
  const cached = geoCache.get(key);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.point;
  const url = new URL("https://api.transitous.org/api/v1/geocode");
  url.searchParams.set("text", query);
  const rows = await getJson<Array<{ type?: string; name?: string; lat?: number; lon?: number }>>(url.toString());
  const hit = rows.find((row) => row.type === "STOP" && row.lat != null && row.lon != null) ?? rows[0];
  if (!hit?.lat || !hit.lon) throw new Error(`Haltestelle nicht gefunden: ${query}`);
  const point = { lat: hit.lat, lon: hit.lon, name: hit.name || query };
  geoCache.set(key, { at: Date.now(), point });
  return point;
}

async function routeAccess(
  profile: "driving" | "bike" | "foot",
  from: Point,
  to: Point,
): Promise<{ minutes: number; km: number }> {
  const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
  const json = await getJson<{ code?: string; routes?: Array<{ duration: number; distance: number }> }>(url);
  const route = json.routes?.[0];
  if (json.code !== "Ok" || !route) throw new Error("Wegstrecke nicht gefunden.");
  return {
    minutes: Math.max(1, Math.round(route.duration / 60)),
    km: Math.round(route.distance / 100) / 10,
  };
}

async function transitPlan(
  from: Point,
  to: Point,
  when: Date,
  modes: string,
  options: { arriveBy: boolean; searchWindow: number },
): Promise<RawItinerary[]> {
  const url = new URL("https://api.transitous.org/api/v1/plan");
  url.searchParams.set("fromPlace", `${from.lat},${from.lon}`);
  url.searchParams.set("toPlace", `${to.lat},${to.lon}`);
  url.searchParams.set("time", when.toISOString());
  url.searchParams.set("numItineraries", "6");
  url.searchParams.set("transitModes", modes);
  url.searchParams.set("arriveBy", options.arriveBy ? "true" : "false");
  // false: bei Ankunft die späteste Abfahrt, bei Abfahrt die früheste Verbindung.
  url.searchParams.set("timetableView", "false");
  url.searchParams.set("searchWindow", String(options.searchWindow));
  const json = await getJson<{ itineraries?: RawItinerary[] }>(url.toString());
  return json.itineraries ?? [];
}

function legDelay(leg: RawLeg): number {
  const dep = delayMinutes(leg.from?.scheduledDeparture, leg.from?.departure);
  const arr = delayMinutes(leg.to?.scheduledArrival, leg.to?.arrival);
  return Math.max(dep, arr);
}

function itineraryPunctual(itinerary: RawItinerary): boolean {
  const legs = transitLegs(itinerary);
  if (legs.length === 0) return false;
  return legs.every((leg) => !legIsCancelled(leg) && legDelay(leg as RawLeg) <= PUNCTUAL_MAX);
}

function displayName(raw: string, typed: string): string {
  const name = raw.trim();
  if (!name || name === "START" || name === "END") return typed;
  const letters = name.replace(/[^A-Za-zÄÖÜäöüß]/g, "");
  if (letters && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return typed;
  return name;
}

function railTitle(leg: RawLeg): string {
  const name = leg.routeShortName || leg.displayName || "Zug";
  return name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function vehicleMode(raw: string | undefined): TripLeg["mode"] {
  if (raw === "BUS" || raw === "TRAM" || raw === "SUBWAY" || raw === "COACH") return "bus";
  return "rail";
}

function toTransitLeg(leg: RawLeg): TripLeg {
  const delay = legDelay(leg);
  const cancelled = legIsCancelled(leg);
  return {
    mode: vehicleMode(leg.mode),
    title: railTitle(leg),
    from: leg.from?.name || "Abfahrt",
    to: leg.headsign ? `${leg.to?.name || "Ziel"} · ${leg.headsign}` : leg.to?.name || "Ziel",
    departure: leg.from?.departure || leg.from?.scheduledDeparture || "",
    arrival: leg.to?.arrival || leg.to?.scheduledArrival || "",
    delayMin: delay,
    punctual: !cancelled && delay <= PUNCTUAL_MAX,
    cancelled,
    platform: leg.from?.description || (leg.from?.track && leg.from.track.length <= 4 ? leg.from.track : "") || "",
  };
}

function toWalkLeg(leg: RawLeg, fromLabel: string, toLabel: string): TripLeg | null {
  if ((leg.duration ?? 0) < 90) return null;
  const minutes = Math.max(1, Math.round((leg.duration ?? 0) / 60));
  return {
    mode: "walk",
    title: `${minutes} Min zu Fuß`,
    from: displayName(leg.from?.name || "", fromLabel),
    to: displayName(leg.to?.name || "", toLabel),
    departure: leg.from?.departure || leg.from?.scheduledDeparture || "",
    arrival: leg.to?.arrival || leg.to?.scheduledArrival || "",
    delayMin: 0,
    punctual: true,
    cancelled: false,
    platform: "",
  };
}

function pathLegs(itinerary: RawItinerary, fromLabel: string, toLabel: string): TripLeg[] {
  const legs: TripLeg[] = [];
  for (const leg of itinerary.legs ?? []) {
    if (!leg.mode || leg.mode === "WALK") {
      const walk = leg.mode === "WALK" ? toWalkLeg(leg, fromLabel, toLabel) : null;
      if (walk) legs.push(walk);
      continue;
    }
    legs.push(toTransitLeg(leg));
  }
  return legs;
}

function accessMode(mode: Mode): TripLeg["mode"] {
  if (mode === "bus") return "bus";
  if (mode === "car") return "car";
  if (mode === "bike") return "bike";
  return "walk";
}

function accessLeg(
  mode: Mode,
  from: string,
  to: string,
  departure: string,
  minutes: number,
  title: string,
): TripLeg {
  return {
    mode: accessMode(mode),
    title,
    from,
    to,
    departure,
    arrival: new Date(Date.parse(departure) + minutes * 60_000).toISOString(),
    delayMin: 0,
    punctual: true,
    cancelled: false,
    platform: "",
  };
}

function transferPad(mode: Mode): number {
  if (mode === "car") return 4;
  if (mode === "bike") return 2;
  if (mode === "bus") return 3;
  return 1;
}

async function streetAccess(mode: Exclude<Mode, "bus">, from: Point, to: Point) {
  const profile = mode === "car" ? "driving" : mode === "bike" ? "bike" : "foot";
  const route = await routeAccess(profile, from, to);
  const label = mode === "car" ? "Auto" : mode === "bike" ? "Fahrrad" : "Zu Fuß";
  return { minutes: route.minutes, title: `${label} · ${route.km} km`, pad: transferPad(mode) };
}

async function approachLegs(
  mode: Mode,
  home: Point,
  station: Point,
  beAtStation: Date,
  now: number,
): Promise<TripLeg[]> {
  if (mode !== "bus") {
    const street = await streetAccess(mode, home, station);
    const leave = new Date(beAtStation.getTime() - (street.minutes + street.pad) * 60_000);
    return [accessLeg(mode, home.name, station.name, leave.toISOString(), street.minutes + street.pad, street.title)];
  }
  const rows = await transitPlan(home, station, beAtStation, BUS, { arriveBy: true, searchWindow: 90 * 60 });
  const chosen = pickTightest(rows, beAtStation.getTime(), now);
  if (!chosen?.startTime || !chosen.endTime) {
    throw new Error("Kein Bus, der rechtzeitig am Bahnhof ist. Fahrrad, Auto oder zu Fuß versuchen.");
  }
  return pathLegs(chosen, home.name, station.name);
}

async function leaveStationLegs(mode: Mode, station: Point, home: Point, atStation: Date): Promise<TripLeg[]> {
  if (mode !== "bus") {
    const street = await streetAccess(mode, station, home);
    return [accessLeg(mode, station.name, home.name, atStation.toISOString(), street.minutes, street.title)];
  }
  const rows = await transitPlan(station, home, atStation, BUS, { arriveBy: false, searchWindow: 60 * 60 });
  const chosen = pickEarliest(rows, atStation.getTime());
  if (!chosen?.startTime || !chosen.endTime) {
    throw new Error("Kein Bus vom Bahnhof nach Hause. Fahrrad, Auto oder zu Fuß versuchen.");
  }
  return pathLegs(chosen, station.name, home.name);
}

async function leadMinutes(mode: Mode, home: Point, station: Point, now: number): Promise<number> {
  if (mode !== "bus") {
    const street = await streetAccess(mode, home, station);
    return street.minutes + street.pad;
  }
  const rows = await transitPlan(home, station, new Date(now), BUS, { arriveBy: false, searchWindow: 60 * 60 });
  const chosen = pickEarliest(rows, now);
  if (!chosen?.startTime || !chosen.endTime) return 20;
  return Math.max(8, Math.round((Date.parse(chosen.endTime) - Date.parse(chosen.startTime)) / 60_000) + transferPad(mode));
}

function summarize(direction: "hin" | "heim", mode: Mode, punctual: boolean, rail: TripLeg | undefined): string {
  const way = MODE_LABEL[mode];
  const train = rail?.title ?? "Zug";
  const state = punctual ? "pünktlich" : rail?.cancelled ? "fällt aus" : `+${rail?.delayMin ?? 0} Min`;
  if (direction === "hin") return `${way} zum Bahnhof, dann ${train} ${state}.`;
  return `${train} ${state}, danach ${way} nach Hause.`;
}

function firstRail(legs: TripLeg[]): TripLeg | undefined {
  return legs.find((leg) => leg.mode === "rail");
}

export async function planTrip(input: {
  homeAddress: string;
  station: string;
  schoolStop: string;
  mode: Mode;
  direction: "hin" | "heim";
  departAt: string;
  example: boolean;
  arriveBy?: string;
  classEnd?: string;
  focus?: string;
}): Promise<TripResult> {
  const arriveBy = input.arriveBy?.trim() ?? "";
  const classEnd = input.classEnd?.trim() ?? "";
  const focus = input.focus?.trim() ?? "";
  const ownPlace = Boolean(input.homeAddress.trim() || input.station.trim() || input.schoolStop.trim());
  const homeAddress = input.homeAddress.trim() || (!ownPlace && input.example ? EXAMPLE_PLACES.homeAddress : "");
  const stationQuery = input.station.trim() || (!ownPlace && input.example ? EXAMPLE_PLACES.station : "");
  const schoolQuery = input.schoolStop.trim() || (!ownPlace && input.example ? EXAMPLE_PLACES.schoolStop : "");
  if (!homeAddress || !stationQuery || !schoolQuery) {
    return { ok: false, error: "Heimatadresse, Bahnhof und Schulhalt werden gebraucht." };
  }
  const cacheKey = [
    homeAddress,
    stationQuery,
    schoolQuery,
    input.mode,
    input.direction,
    input.departAt.slice(0, 16),
    arriveBy.slice(0, 16),
    classEnd.slice(0, 16),
  ].join("|");
  const cached = planCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 45_000) return { ok: true, trip: cached.trip };

  try {
    const [home, station, school] = await Promise.all([
      geocodeAddress(homeAddress),
      geocodeStop(stationQuery),
      geocodeStop(schoolQuery),
    ]);
    const now = Date.now();

    if (input.direction === "hin") {
      const deadlineMs = Date.parse(arriveBy);
      const tight = Number.isFinite(deadlineMs) && deadlineMs > now + 4 * 60_000;
      const lead = await leadMinutes(input.mode, home, station, now);
      let chosen: RawItinerary | null = null;
      let late = false;
      if (tight) {
        const rows = await transitPlan(station, school, new Date(deadlineMs), RAIL, {
          arriveBy: true,
          searchWindow: 4 * 60 * 60,
        });
        chosen = pickTightest(rows, deadlineMs, now + lead * 60_000);
      }
      if (!chosen?.startTime || !chosen.endTime) {
        late = tight;
        const from = new Date(now + lead * 60_000);
        const rows = await transitPlan(station, school, from, RAIL, { arriveBy: false, searchWindow: 2 * 60 * 60 });
        chosen = pickEarliest(rows, now + lead * 60_000);
      }
      if (!chosen?.startTime || !chosen.endTime) {
        return { ok: false, error: "Keine Zugverbindung in den nächsten Stunden." };
      }
      const approach = await approachLegs(input.mode, home, station, new Date(chosen.startTime), now);
      const ride = pathLegs(chosen, station.name, school.name);
      const intoSchool = accessLeg(
        "walk",
        school.name,
        "Schule",
        chosen.endTime,
        SCHOOL_BUFFER_MIN,
        "Weg ins Schulhaus",
      );
      const legs = [...approach, ...ride, intoSchool];
      const punctual = itineraryPunctual(chosen);
      const slack = Number.isFinite(deadlineMs)
        ? Math.round((deadlineMs - Date.parse(chosen.endTime)) / 60_000)
        : 0;
      const lesson = focus || "der ersten Stunde";
      const note = late
        ? `Zur ersten Stunde (${lesson}) reicht keine Verbindung mehr. Gezeigt wird die früheste ab jetzt.`
        : tight
          ? slack <= 2
            ? `Knapp zur ersten Stunde, die nicht ausfällt (${lesson}), inklusive ${SCHOOL_BUFFER_MIN} Minuten ins Schulhaus.`
            : `Knapp zur ersten Stunde, die nicht ausfällt (${lesson}). Mit dem Weg ins Schulhaus bist du etwa ${slack} Minuten vor dem Klingeln da.`
          : punctual
            ? "Nächste Verbindung, die höchstens zwei Minuten Verspätung hat."
            : "Gerade keine pünktliche Verbindung. Gezeigt wird die nächste fahrende.";
      const trip: TripPlan = {
        source: "live",
        direction: "hin",
        mode: input.mode,
        punctual,
        leaveAt: approach[0]?.departure || chosen.startTime,
        arriveAt: intoSchool.arrival,
        headline: summarize("hin", input.mode, punctual, firstRail(ride)),
        note: !ownPlace ? `Beispielstrecke, live gerechnet. ${note}` : note,
        places: { home: home.name, station: station.name, schoolStop: school.name },
        legs,
      };
      planCache.set(cacheKey, { at: Date.now(), trip });
      return { ok: true, trip };
    }

    const when = new Date(input.departAt);
    const ready = Number.isNaN(when.getTime()) ? new Date() : when;
    let rows = await transitPlan(school, station, ready, RAIL, { arriveBy: false, searchWindow: 2 * 60 * 60 });
    let chosen = pickEarliest(rows, ready.getTime());
    if (!chosen?.startTime && rows.some((row) => transitLegs(row).some(legIsCancelled))) {
      const later = new Date(ready.getTime() + 20 * 60_000);
      rows = await transitPlan(school, station, later, RAIL, { arriveBy: false, searchWindow: 2 * 60 * 60 });
      chosen = pickEarliest(rows, ready.getTime());
    }
    if (!chosen?.startTime || !chosen.endTime) {
      return { ok: false, error: "Keine Heimfahrt in den nächsten Stunden." };
    }
    const ride = pathLegs(chosen, school.name, station.name);
    const after = await leaveStationLegs(input.mode, station, home, new Date(chosen.endTime));
    let legs = [...ride, ...after];
    let leaveAt = chosen.startTime;
    const classEndMs = Date.parse(classEnd);
    if (Number.isFinite(classEndMs) && ready.getTime() > classEndMs + 30_000) {
      const minutes = Math.max(1, Math.round((ready.getTime() - classEndMs) / 60_000));
      const egress = accessLeg("walk", "Schule", school.name, new Date(classEndMs).toISOString(), minutes, "Weg zur Haltestelle");
      legs = [egress, ...legs];
      leaveAt = egress.departure;
    }
    const punctual = itineraryPunctual(chosen);
    const homeAt = after.at(-1)?.arrival || chosen.endTime;
    const note = classEnd
      ? `Frühste Zugverbindung, nachdem du in ${SCHOOL_BUFFER_MIN} Minuten vom Schulhaus an der Haltestelle bist${focus ? ` (${focus})` : ""}.`
      : focus
        ? `Schulschluss (${focus}) liegt hinter dir. Frühste Zugverbindung ab jetzt.`
        : "Frühste Zugverbindung ab jetzt, plus der Weg vom Bahnhof nach Hause.";
    const trip: TripPlan = {
      source: "live",
      direction: "heim",
      mode: input.mode,
      punctual,
      leaveAt,
      arriveAt: homeAt,
      headline: summarize("heim", input.mode, punctual, firstRail(ride)),
      note: !ownPlace ? `Beispielstrecke, live gerechnet. ${note}` : note,
      places: { home: home.name, station: station.name, schoolStop: school.name },
      legs,
    };
    planCache.set(cacheKey, { at: Date.now(), trip });
    return { ok: true, trip };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verbindung gerade nicht abrufbar.";
    return { ok: false, error: message };
  }
}
