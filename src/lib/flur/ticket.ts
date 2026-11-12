const FERN_MODE = new Set(["HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL", "COACH", "AIRPLANE"]);
const FERN_NAME = /^(ICE|IC|EC|ECE|RJX|RJ|NJ|TGV|EST|FLX|FLIX)\b|intercity-express|intercity|eurocity|nightjet|flixbus|flixtrain/i;

export const RAIL_MODES = "HIGHSPEED_RAIL,NIGHT_RAIL,LONG_DISTANCE,REGIONAL_FAST_RAIL,REGIONAL_RAIL,SUBURBAN";
export const RAIL_TICKET_MODES = "REGIONAL_FAST_RAIL,REGIONAL_RAIL,SUBURBAN";
export const BUS_MODES = "BUS,TRAM,SUBWAY,COACH";
export const BUS_TICKET_MODES = "BUS,TRAM,SUBWAY";

export const TICKET_NOTE =
  "Nur mit dem Deutschlandticket: Regionalzug, S-Bahn, U-Bahn, Tram und Bus. Ohne ICE, IC und Fernbus.";

export function railModes(ticket: boolean): string {
  return ticket ? RAIL_TICKET_MODES : RAIL_MODES;
}

export function busModes(ticket: boolean): string {
  return ticket ? BUS_TICKET_MODES : BUS_MODES;
}

export function isFernverkehr(mode: string | undefined, title: string): boolean {
  if (FERN_MODE.has((mode ?? "").toUpperCase())) return true;
  return FERN_NAME.test(title.replace(/\s+/g, " ").trim());
}

export function itineraryOnTicket(itinerary: {
  legs?: Array<{ mode?: string; routeShortName?: string; displayName?: string }>;
}): boolean {
  return (itinerary.legs ?? []).every((leg) => {
    if (!leg.mode || leg.mode === "WALK" || leg.mode === "BIKE" || leg.mode === "CAR") return true;
    return !isFernverkehr(leg.mode, leg.routeShortName || leg.displayName || "");
  });
}

export function rideStop(label: string): string {
  return label.split(" · ")[0]?.trim() || label.trim();
}

function berlinStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const stamp = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
  return stamp.includes("undefined") ? "" : stamp;
}

export function dbNavigatorUrl(from: string, to: string, departureIso: string): string {
  const params = new URLSearchParams();
  params.set("sts", "true");
  params.set("so", rideStop(from));
  params.set("zo", rideStop(to));
  const hd = berlinStamp(departureIso);
  if (hd) params.set("hd", hd);
  params.set("hza", "D");
  params.set("kl", "2");
  return `https://www.bahn.de/buchung/fahrplan/suche#${params.toString()}`;
}

export function mvgUrl(from: string, to: string): string {
  const params = new URLSearchParams();
  params.set("action", "planJourney");
  params.set("client_id", "MVGDE");
  params.set("originLabel", rideStop(from));
  params.set("destinationLabel", rideStop(to));
  return `https://www.mvg.de/apps/mvgo?${params.toString()}`;
}
