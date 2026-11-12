/**
 * FLUR has no account system. The old Better Auth server is gone on purpose:
 * the app keeps school logins on the device and does not sign anyone in here.
 * `authConfigured` stays false unless a deployer explicitly turns the flag on,
 * and even then there is no session store.
 */
import { getCookie } from "@tanstack/react-start/server";
import { GROK_PROVIDERS } from "./providers";
import { PREVIEW_CLIENT_ID, PREVIEW_CLIENT_SECRET } from "./preview";

const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

const authDisabled = env("VITE_AUTH_ENABLED") === "false";
const grokClientId = env("GROK_AUTH_CLIENT_ID") ?? PREVIEW_CLIENT_ID;
const grokClientSecret = env("GROK_AUTH_CLIENT_SECRET") ?? PREVIEW_CLIENT_SECRET;

/** True only when a deployer asked for sign-in. FLUR still has no session behind it. */
export const authConfigured = !authDisabled && Boolean(grokClientId && grokClientSecret);

export const SESSION_TOKEN_COOKIE = "__Host-grok-auth.session_token";

type SessionResult = { user: { id: string; email?: string | null } } | null;

export const auth = {
  api: {
    getSession: async (_input?: { headers?: Headers }): Promise<SessionResult> => null,
    signInWithOAuth2: async (_input?: unknown) =>
      new Response("FLUR hat kein Konto.", {
        status: 501,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
  },
};

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}

export { GROK_PROVIDERS } from "./providers";
