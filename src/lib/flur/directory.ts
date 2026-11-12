export type DirectoryItem = {
  name: string;
  longName: string;
};

export type DirectoryPage = {
  items: DirectoryItem[];
  more: number;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function squash(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function sortDirectory(items: DirectoryItem[]): DirectoryItem[] {
  const seen = new Set<string>();
  const unique: DirectoryItem[] = [];
  for (const item of items) {
    const name = item.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ name, longName: item.longName.trim() || name });
  }
  unique.sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true, sensitivity: "base" }));
  return unique;
}

function elementName(record: Record<string, unknown>): DirectoryItem | null {
  const name = text(record.shortName) || text(record.name) || text(record.displayName);
  const longName = text(record.longName) || text(record.longname) || text(record.displayName) || name;
  if (!name) return null;
  return { name, longName };
}

/** Public WebUntis filter payload, classes or teachers. */
export function readPublicDirectory(json: unknown, who: "class" | "teacher"): DirectoryItem[] {
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const key = who === "class" ? "classes" : "teachers";
  const nest = who === "class" ? "class" : "teacher";
  const rows = record[key];
  if (!Array.isArray(rows)) return [];
  const items: DirectoryItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const inner = obj[nest];
    const source = inner && typeof inner === "object" ? (inner as Record<string, unknown>) : obj;
    const item = elementName(source);
    if (item) items.push(item);
  }
  return sortDirectory(items);
}

/** Authenticated getKlassen / getTeachers rows. */
export function readNamedDirectory(rows: unknown): DirectoryItem[] {
  if (!Array.isArray(rows)) return [];
  const items: DirectoryItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = elementName(row as Record<string, unknown>);
    if (item) items.push(item);
  }
  return sortDirectory(items);
}

function tokenStarts(value: string, query: string): boolean {
  if (!query) return false;
  if (value.startsWith(query)) return true;
  for (let index = 0; index < value.length; index++) {
    if (" \t-/.,(".includes(value[index] ?? "") && value.startsWith(query, index + 1)) return true;
  }
  return false;
}

function score(item: DirectoryItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const name = item.name.toLowerCase();
  const longName = item.longName.toLowerCase();
  const needle = squash(q);
  const short = squash(item.name);
  if (name === q || (needle && short === needle)) return 0;
  if (tokenStarts(name, q) || tokenStarts(longName, q) || (needle && short.startsWith(needle))) return 1;
  if (q.length >= 3 && (name.includes(q) || longName.includes(q))) return 2;
  return -1;
}

export function filterDirectory(items: DirectoryItem[], query: string, limit = 8): DirectoryPage {
  const ranked = items
    .map((item) => ({ item, rank: score(item, query) }))
    .filter((entry) => entry.rank >= 0)
    .sort(
      (a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name, "de", { numeric: true, sensitivity: "base" }),
    );
  return {
    items: ranked.slice(0, limit).map((entry) => entry.item),
    more: Math.max(0, ranked.length - limit),
  };
}
