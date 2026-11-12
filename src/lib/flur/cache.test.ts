import assert from "node:assert/strict";
import test from "node:test";
import { cacheOwner, cachedAfterFailure, isAuthFailure, loadBoardCache, saveBoardCache } from "./cache.ts";
import type { DayBoard } from "./types.ts";

test("a rejected login is not an offline outage", () => {
  assert.equal(isAuthFailure("Anmeldung abgelehnt."), true);
  assert.equal(isAuthFailure("Anmeldung fehlgeschlagen."), true);
  assert.equal(isAuthFailure("Schul-Login abgelehnt. Benutzer und der Code aus Freigaben stimmen nicht."), true);
  assert.equal(isAuthFailure("Das Passwort ist falsch, oder der Benutzer stimmt nicht."), true);
  assert.equal(isAuthFailure("Schule, Benutzer und Passwort werden gebraucht."), true);
  assert.equal(isAuthFailure("Schule, Benutzer und Zugangscode werden gebraucht."), true);
  assert.equal(isAuthFailure("WebUntis ist gerade nicht erreichbar."), false);
  assert.equal(isAuthFailure("WebUntis ist nicht erreichbar."), false);
  assert.equal(isAuthFailure("WebUntis antwortet mit Status 502."), false);
  assert.equal(isAuthFailure("Failed to fetch"), false);
  assert.equal(isAuthFailure("Methode nicht gefunden"), false);
  assert.equal(isAuthFailure("WebUntis hat die Anfrage abgelehnt."), false);
  assert.equal(isAuthFailure("WebUntis hat die Anfrage nicht ausgeführt."), false);
});

test("offline keeps the last board, a rejected login does not", () => {
  const cached = { today: { source: "live" as const, iso: "2026-11-12", lessons: [] }, tomorrow: { source: "live" as const, iso: "2026-11-13", lessons: [] }, savedAt: "" };
  const down = cachedAfterFailure("WebUntis ist nicht erreichbar.", cached);
  assert.equal(down.offline, true);
  assert.equal(down.error, null);
  assert.equal(down.show, cached);
  const denied = cachedAfterFailure("Anmeldung abgelehnt.", cached);
  assert.equal(denied.offline, false);
  assert.equal(denied.show, null);
  assert.match(denied.error || "", /abgelehnt/i);
  const empty = cachedAfterFailure("Failed to fetch", null);
  assert.equal(empty.offline, false);
  assert.equal(empty.show, null);
  assert.equal(empty.error, "Failed to fetch");
});

test("a saved plan belongs to one login, not the next child", () => {
  const mem = new Map<string, string>();
  const previous = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mem.set(key, value);
      },
      removeItem: (key: string) => {
        mem.delete(key);
      },
    },
  } as unknown as Window & typeof globalThis;
  try {
    const day = (iso: string): DayBoard => ({ source: "live", iso, lessons: [] });
    const ada = cacheOwner({ school: "Gymnasium", user: "ada", who: "student", whoName: "" });
    const ben = cacheOwner({ school: "Gymnasium", user: "ben", who: "student", whoName: "" });
    saveBoardCache(ada, day("2026-11-12"), day("2026-11-13"));
    assert.equal(loadBoardCache(ada)?.today.iso, "2026-11-12");
    assert.equal(loadBoardCache(ben), null);
    saveBoardCache(ada, { source: "demo", iso: "2026-11-12", lessons: [] }, { source: "demo", iso: "2026-11-13", lessons: [] });
    assert.equal(loadBoardCache(ada)?.today.iso, "2026-11-12");
  } finally {
    globalThis.window = previous;
  }
});
