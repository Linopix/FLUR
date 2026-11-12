export type ParsedAccess = {
  secret?: string;
  user?: string;
  school?: string;
  server?: string;
};

export function isUntisHost(host: string): boolean {
  const name = host.toLowerCase();
  return (
    name.endsWith(".webuntis.com") ||
    name.endsWith(".webuntis.de") ||
    name.endsWith(".webuntis.at") ||
    name.endsWith(".untis.at")
  );
}

function cleanSecret(value: string): string {
  return value.replace(/\s+/g, "").replace(/=+$/g, "").toUpperCase();
}

function isSecret(value: string): boolean {
  return /^[A-Z2-7]{8,64}$/.test(value);
}

function accessParams(text: string): URLSearchParams {
  const queryAt = text.indexOf("?");
  const hashAt = text.indexOf("#");
  const parts: string[] = [];
  if (queryAt >= 0) {
    const end = hashAt > queryAt ? hashAt : text.length;
    parts.push(text.slice(queryAt + 1, end));
  }
  if (hashAt >= 0) parts.push(text.slice(hashAt + 1));
  if (parts.length === 0 && text.includes("=")) parts.push(text);
  return new URLSearchParams(parts.join("&"));
}

/** Reads a pasted WebUntis QR link or a bare Zugangscode from Freigaben. */
export function parseUntisAccess(raw: string): ParsedAccess | null {
  const text = raw.trim();
  if (!text) return null;
  const compact = cleanSecret(text);
  if (isSecret(compact) && !text.includes("=")) return { secret: compact };

  const params = accessParams(text);
  const secret = cleanSecret(params.get("key") || params.get("secret") || params.get("token") || "");
  const user = (params.get("user") || params.get("username") || "").trim();
  const school = (params.get("school") || "").trim();
  let server = (params.get("url") || params.get("server") || "").trim();
  server = server.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  if (server && !isUntisHost(server)) server = "";
  if (!server) {
    const fromLink = text.match(/https?:\/\/([^/?#]+)/i)?.[1]?.toLowerCase() ?? "";
    if (isUntisHost(fromLink)) server = fromLink;
  }
  if (!isSecret(secret) && !user && !school) return null;
  return {
    secret: isSecret(secret) ? secret : undefined,
    user: user || undefined,
    school: school || undefined,
    server: server || undefined,
  };
}
