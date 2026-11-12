import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BoardResult, ServerProfile, TripResult } from "@/lib/flur/types";
import type { DeskResult } from "@/lib/flur/desk";

const credsSchema = z.object({
  baseUrl: z.string().trim().min(1).max(200),
  school: z.string().trim().min(1).max(120),
  user: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(500),
  login: z.enum(["password", "secret"]).optional().default("password"),
  who: z.enum(["student", "class", "teacher"]),
  whoName: z.string().trim().max(80).optional().default(""),
});

const schoolQuerySchema = z.object({
  query: z.string().trim().min(2).max(80),
});

const loginCheckSchema = z.object({
  baseUrl: z.string().trim().min(1).max(200),
  school: z.string().trim().min(1).max(120),
  user: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(500),
  login: z.enum(["password", "secret"]).optional().default("password"),
});

const directorySchema = z.object({
  baseUrl: z.string().trim().min(1).max(200),
  school: z.string().trim().min(1).max(120),
  who: z.enum(["class", "teacher"]),
  user: z.string().trim().max(120).optional().default(""),
  password: z.string().max(500).optional().default(""),
  login: z.enum(["password", "secret"]).optional().default("password"),
});

const tripSchema = z.object({
  homeAddress: z.string().trim().max(180),
  station: z.string().trim().max(120),
  schoolStop: z.string().trim().max(120),
  schoolAddress: z.string().trim().max(180).optional().default(""),
  mode: z.enum(["bus", "car", "bike", "walk", "drive", "link"]),
  direction: z.enum(["hin", "heim"]),
  departAt: z.string().min(4).max(40),
  example: z.boolean(),
  arriveBy: z.string().max(40).optional().default(""),
  classEnd: z.string().max(40).optional().default(""),
  focus: z.string().max(80).optional().default(""),
  deutschlandticket: z.boolean().optional().default(false),
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
    schoolAddress: route.schoolAddress,
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

export const searchSchools = createServerFn({ method: "POST" })
  .validator((input: unknown) => schoolQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { searchUntisSchools } = await import("@/lib/flur/untis.server");
    return searchUntisSchools(data.query);
  });

export const checkLogin = createServerFn({ method: "POST" })
  .validator((input: unknown) => loginCheckSchema.parse(input))
  .handler(async ({ data }) => {
    const { checkUntisLogin } = await import("@/lib/flur/untis.server");
    return checkUntisLogin(data);
  });

export const listDirectory = createServerFn({ method: "POST" })
  .validator((input: unknown) => directorySchema.parse(input))
  .handler(async ({ data }) => {
    const { listUntisDirectory } = await import("@/lib/flur/untis.server");
    return listUntisDirectory({
      baseUrl: data.baseUrl,
      school: data.school,
      who: data.who,
      user: data.user,
      password: data.password,
      login: data.login,
    });
  });

export const fetchServerDesk = createServerFn({ method: "GET" }).handler(async (): Promise<DeskResult> => {
  const { credsFromEnv, loadUntisDesk } = await import("@/lib/flur/untis.server");
  const creds = credsFromEnv();
  if (!creds) return { ok: false, error: "Auf dem Server sind keine WebUntis-Zugangsdaten hinterlegt." };
  return loadUntisDesk(creds);
});

export const fetchDesk = createServerFn({ method: "POST" })
  .validator((input: unknown) => credsSchema.parse(input))
  .handler(async ({ data }): Promise<DeskResult> => {
    const { loadUntisDesk } = await import("@/lib/flur/untis.server");
    return loadUntisDesk({
      baseUrl: data.baseUrl,
      school: data.school,
      user: data.user,
      password: data.password,
      login: data.login,
      who: data.who,
      whoName: data.whoName ?? "",
    });
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
      login: data.login,
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
