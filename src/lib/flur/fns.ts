import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BoardResult, ServerProfile, TripResult } from "@/lib/flur/types";

const credsSchema = z.object({
  baseUrl: z.string().trim().min(1).max(200),
  school: z.string().trim().min(1).max(120),
  user: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
  who: z.enum(["student", "class", "teacher"]),
  whoName: z.string().trim().max(80).optional().default(""),
});

const tripSchema = z.object({
  homeAddress: z.string().trim().max(180),
  station: z.string().trim().max(120),
  schoolStop: z.string().trim().max(120),
  mode: z.enum(["bus", "car", "bike", "walk"]),
  direction: z.enum(["hin", "heim"]),
  departAt: z.string().min(4).max(40),
  example: z.boolean(),
});

export const fetchServerProfile = createServerFn({ method: "GET" }).handler(async () => {
  const { credsFromEnv, routeFromEnv } = await import("@/lib/flur/untis.server");
  const creds = credsFromEnv();
  const route = routeFromEnv();
  const profile: ServerProfile = {
    webuntis: Boolean(creds),
    school: creds?.school ?? "",
    home: route.home,
    station: route.station,
    schoolStop: route.schoolStop,
    mode: route.mode,
    who: creds?.who ?? "",
    whoName: creds?.whoName ?? "",
  };
  return profile;
});

export const fetchServerBoard = createServerFn({ method: "GET" }).handler(async (): Promise<BoardResult> => {
  const { credsFromEnv, loadUntisBoard } = await import("@/lib/flur/untis.server");
  const creds = credsFromEnv();
  if (!creds) return { ok: false, error: "Auf dem Server sind keine WebUntis-Zugangsdaten hinterlegt." };
  return loadUntisBoard(creds);
});

export const fetchBoard = createServerFn({ method: "POST" })
  .validator((input: unknown) => credsSchema.parse(input))
  .handler(async ({ data }): Promise<BoardResult> => {
    const { loadUntisBoard } = await import("@/lib/flur/untis.server");
    return loadUntisBoard({
      baseUrl: data.baseUrl,
      school: data.school,
      user: data.user,
      password: data.password,
      who: data.who,
      whoName: data.whoName ?? "",
    });
  });

export const fetchTrip = createServerFn({ method: "POST" })
  .validator((input: unknown) => tripSchema.parse(input))
  .handler(async ({ data }): Promise<TripResult> => {
    const { planTrip } = await import("@/lib/flur/travel.server");
    return planTrip(data);
  });
