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

type RawItinerary = {
  duration?: number;
  startTime?: string;
  endTime?: string;
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
  departAt: Date,
  modes: string,
): Promise<RawItinerary[]> {
  const url = new URL("https://api.transitous.org/api/v1/plan");
  url.searchParams.set("fromPlace", `${from.lat},${from.lon}`);
  url.searchParams.set("toPlace", `${to.lat},${to.lon}`);
  url.searchParams.set("time", departAt.toISOString());
  url.searchParams.set("numItineraries", "6");
  url.searchParams.set("transitModes", modes);
  const json = await getJson<{ itineraries?: RawItinerary[] }>(url.toString());
  return json.itineraries ?? [];
}

function transitOnly(itinerary: RawItinerary): RawLeg[] {
  return (itinerary.legs ?? []).filter((leg) => leg.mode && leg.mode !== "WALK");
}

function legDelay(leg: RawLeg): number {
  const dep = delayMinutes(leg.from?.scheduledDeparture, leg.from?.departure);
  const arr = delayMinutes(leg.to?.scheduledArrival, leg.to?.arrival);
  return Math.max(dep, arr);
}

function legCancelled(leg: RawLeg): boolean {
  return Boolean(leg.cancelled || leg.from?.cancelled || leg.to?.cancelled);
}

function itineraryPunctual(itinerary: RawItinerary): boolean {
  const legs = transitOnly(itinerary);
  if (legs.length === 0) return false;
  return legs.every((leg) => !legCancelled(leg) && legDelay(leg) <= PUNCTUAL_MAX);
}

function futureItineraries(rows: RawItinerary[], now: number): RawItinerary[] {
  return rows
    .filter((row) => row.startTime && Date.parse(row.startTime) >= now - 60_000)
    .sort((a, b) => Date.parse(a.startTime ?? "") - Date.parse(b.startTime ?? ""));
}

function pickItinerary(rows: RawItinerary[], now: number, leaveOffsetMs: number) {
  const upcoming = futureItineraries(rows, now);
  const pool = upcoming.length > 0 ? upcoming : rows;
  const punctual = pool.filter(itineraryPunctual);
  const canLeave = (row: RawItinerary) => Date.parse(row.startTime ?? "") - leaveOffsetMs >= now - 30_000;
  return (
    punctual.find(canLeave) ??
    pool.find((row) => transitOnly(row).length > 0 && canLeave(row) && !transitOnly(row).every(legCancelled)) ??
    punctual[0] ??
    pool.find((row) => transitOnly(row).length > 0) ??
    null
  );
}

function displayName(raw: string, typed: string): string {
  const name = raw.trim();
  if (!name) return typed;
  const letters = name.replace(/[^A-Za-zÄÖÜäöüß]/g, "");
  if (letters && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return typed;
  return name;
}

function railTitle(leg: RawLeg): string {
  const name = leg.routeShortName || leg.displayName || "Zug";
  return name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function toRailLeg(leg: RawLeg): TripLeg {
  const delay = legDelay(leg);
  const cancelled = legCancelled(leg);
  return {
    mode: "rail",
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

async function accessMinutes(mode: Mode, home: Point, station: Point, departHint: Date) {
  if (mode === "car") {
    const route = await routeAccess("driving", home, station);
    return { minutes: route.minutes, title: `Auto · ${route.km} km`, legs: null as RawItinerary | null };
  }
  if (mode === "bike") {
    const route = await routeAccess("bike", home, station);
    return { minutes: route.minutes, title: `Fahrrad · ${route.km} km`, legs: null };
  }
  if (mode === "walk") {
    const route = await routeAccess("foot", home, station);
    return { minutes: route.minutes, title: `Zu Fuß · ${route.km} km`, legs: null };
  }
  const rows = await transitPlan(home, station, departHint, BUS);
  const chosen = pickItinerary(rows, Date.now(), 0);
  if (!chosen || transitOnly(chosen).length === 0) {
    throw new Error("Kein Bus zwischen Wohnung und Bahnhof. Fahrrad, Auto oder zu Fuß versuchen.");
  }
  const names = transitOnly(chosen)
    .map((leg) => railTitle(leg))
    .filter(Boolean)
    .join(" + ");
  const minutes = Math.max(1, Math.round((chosen.duration ?? 0) / 60));
  return { minutes, title: names || "Bus", legs: chosen };
}

function summarize(direction: "hin" | "heim", mode: Mode, punctual: boolean, rail: TripLeg | undefined): string {
  const way = MODE_LABEL[mode];
  const train = rail?.title ?? "Zug";
  const state = punctual ? "pünktlich" : rail?.cancelled ? "fällt aus" : `+${rail?.delayMin ?? 0} Min`;
  if (direction === "hin") return `${way} zum Bahnhof, dann ${train} ${state}.`;
  return `${train} ${state}, danach ${way} nach Hause.`;
}

export async function planTrip(input: {
  homeAddress: string;
  station: string;
  schoolStop: string;
  mode: Mode;
  direction: "hin" | "heim";
  departAt: string;
  example: boolean;
}): Promise<TripResult> {
  const ownPlace =
    Boolean(input.homeAddress.trim() || input.station.trim() || input.schoolStop.trim());
  const homeAddress = input.homeAddress.trim() || (!ownPlace && input.example ? EXAMPLE_PLACES.homeAddress : "");
  const stationQuery = input.station.trim() || (!ownPlace && input.example ? EXAMPLE_PLACES.station : "");
  const schoolQuery = input.schoolStop.trim() || (!ownPlace && input.example ? EXAMPLE_PLACES.schoolStop : "");
  if (!homeAddress || !stationQuery || !schoolQuery) {
    return { ok: false, error: "Heimatadresse, Bahnhof und Schulhalt werden gebraucht." };
  }
  const cacheKey = [homeAddress, stationQuery, schoolQuery, input.mode, input.direction, input.departAt.slice(0, 16)].join("|");
  const cached = planCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 45_000) return { ok: true, trip: cached.trip };

  try {
    const [home, station, school] = await Promise.all([
      geocodeAddress(homeAddress),
      geocodeStop(stationQuery),
      geocodeStop(schoolQuery),
    ]);
    const departAt = new Date(input.departAt);
    const when = Number.isNaN(departAt.getTime()) ? new Date() : departAt;
    const now = Date.now();

    if (input.direction === "hin") {
      const rough = await accessMinutes(input.mode, home, station, new Date(now));
      const trains = await transitPlan(station, school, new Date(now + (rough.minutes + 4) * 60_000), RAIL);
      const chosen = pickItinerary(trains, now, (rough.minutes + 5) * 60_000);
      if (!chosen?.startTime || !chosen.endTime) {
        return { ok: false, error: "Keine Zugverbindung in den nächsten Stunden." };
      }
      const leaveMs = Date.parse(chosen.startTime) - (rough.minutes + 5) * 60_000;
      const railLegs = transitOnly(chosen).map(toRailLeg);
      const firstRail = railLegs[0];
      const access = accessLeg(
        input.mode,
        home.name,
        station.name,
        new Date(leaveMs).toISOString(),
        rough.minutes,
        rough.title,
      );
      const punctual = itineraryPunctual(chosen);
      const trip: TripPlan = {
        source: "live",
        direction: "hin",
        mode: input.mode,
        punctual,
        leaveAt: access.departure,
        arriveAt: chosen.endTime,
        headline: summarize("hin", input.mode, punctual, firstRail),
        note: !ownPlace
          ? "Beispielstrecke, live gerechnet. Eigene Adresse und Haltestellen stehen in den Einstellungen."
          : punctual
            ? "Nächste Verbindung, die höchstens zwei Minuten Verspätung hat."
            : "Gerade keine pünktliche Verbindung. Gezeigt wird die nächste fahrende.",
        places: { home: home.name, station: station.name, schoolStop: school.name },
        legs: [access, ...railLegs],
      };
      planCache.set(cacheKey, { at: Date.now(), trip });
      return { ok: true, trip };
    }

    const trains = await transitPlan(school, station, when, RAIL);
    const chosen = pickItinerary(trains, when.getTime() - 60_000, 0);
    if (!chosen?.startTime || !chosen.endTime) {
      return { ok: false, error: "Keine Heimfahrt in den nächsten Stunden." };
    }
    const after = await accessMinutes(input.mode, station, home, new Date(chosen.endTime));
    const railLegs = transitOnly(chosen).map(toRailLeg);
    const firstRail = railLegs[0];
    const access = accessLeg(input.mode, station.name, home.name, chosen.endTime, after.minutes, after.title);
    const punctual = itineraryPunctual(chosen);
    const trip: TripPlan = {
      source: "live",
      direction: "heim",
      mode: input.mode,
      punctual,
      leaveAt: chosen.startTime,
      arriveAt: access.arrival,
      headline: summarize("heim", input.mode, punctual, firstRail),
      note: !ownPlace
        ? "Beispielstrecke, live gerechnet. Ankunft inklusive Weg vom Bahnhof nach Hause."
        : "Ankunft ist Zug plus Weg vom Bahnhof bis zur Haustür.",
      places: { home: home.name, station: station.name, schoolStop: school.name },
      legs: [...railLegs, access],
    };
    planCache.set(cacheKey, { at: Date.now(), trip });
    return { ok: true, trip };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verbindung gerade nicht abrufbar.";
    return { ok: false, error: message };
  }
}
