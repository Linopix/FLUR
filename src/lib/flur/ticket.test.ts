import assert from "node:assert/strict";
import test from "node:test";
import { dbNavigatorUrl, isFernverkehr, itineraryOnTicket, mvgUrl, railModes } from "./ticket.ts";

test("deutschlandticket keeps regional rides and drops long distance", () => {
  assert.equal(isFernverkehr("HIGHSPEED_RAIL", "ICE 573"), true);
  assert.equal(isFernverkehr("REGIONAL_RAIL", "ICE 573"), true);
  assert.equal(isFernverkehr("REGIONAL_RAIL", "IC 2024"), true);
  assert.equal(isFernverkehr("COACH", "FlixBus"), true);
  assert.equal(isFernverkehr("REGIONAL_RAIL", "RB 24"), false);
  assert.equal(isFernverkehr("REGIONAL_FAST_RAIL", "RE 1"), false);
  assert.equal(isFernverkehr("REGIONAL_RAIL", "IRE 3"), false);
  assert.equal(isFernverkehr("SUBURBAN", "S 6"), false);
  assert.equal(isFernverkehr("BUS", "Bus 132"), false);
  assert.equal(isFernverkehr("WALK", ""), false);
  assert.equal(
    itineraryOnTicket({
      legs: [
        { mode: "WALK" },
        { mode: "REGIONAL_RAIL", routeShortName: "RB 24" },
      ],
    }),
    true,
  );
  assert.equal(
    itineraryOnTicket({
      legs: [
        { mode: "BUS", routeShortName: "132" },
        { mode: "HIGHSPEED_RAIL", routeShortName: "ICE 618" },
      ],
    }),
    false,
  );
  assert.equal(railModes(true).includes("HIGHSPEED_RAIL"), false);
  assert.equal(railModes(false).includes("HIGHSPEED_RAIL"), true);
});

test("a ride opens in DB Navigator and the MVG app", () => {
  const db = dbNavigatorUrl("Köln Süd", "Köln Hbf · RB 24", "2026-11-12T07:15:00.000Z");
  assert.match(db, /^https:\/\/www\.bahn\.de\/buchung\/fahrplan\/suche#/);
  assert.match(db, /so=K%C3%B6ln\+S%C3%BCd/);
  assert.match(db, /zo=K%C3%B6ln\+Hbf/);
  assert.match(db, /hd=2026-11-12T08%3A15%3A00/);
  const mvg = mvgUrl("Marienplatz", "Hauptbahnhof · U3");
  assert.equal(
    mvg,
    "https://www.mvg.de/apps/mvgo?action=planJourney&client_id=MVGDE&originLabel=Marienplatz&destinationLabel=Hauptbahnhof",
  );
});
