import { isTauri } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import type { MediaType, SearchResult, Source } from "@/lib/api/types";

// Everything the user saved. Inside the app it lives in SQLite (the table is
// created by the migration in src-tauri/src/lib.rs). In a plain browser we keep
// the same data in localStorage so the UI can be developed without Tauri.

export const MOVIE_STATUSES = ["Want to watch", "Watched"] as const;
export const GAME_STATUSES = ["Want to play", "Playing", "Completed", "Dropped"] as const;
export type Status = (typeof MOVIE_STATUSES)[number] | (typeof GAME_STATUSES)[number];

export type LibraryItem = {
  id: number;
  source: Source;
  externalId: string;
  type: MediaType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  genres: string[];
  extra: { platforms?: string[] };
  status: Status;
  rating: number | null; // 1–10
  favorite: boolean;
  notes: string;
  addedAt: string; // ISO date
  fetchedAt: string; // ISO date, used to refresh data older than 6 months (TMDB rule)
};

/** A row exactly as SQLite returns it (snake_case, JSON stored as text). */
type Row = {
  id: number;
  source: Source;
  external_id: string;
  type: MediaType;
  title: string;
  year: number | null;
  poster_url: string | null;
  genres: string;
  extra: string;
  status: Status;
  rating: number | null;
  favorite: number;
  notes: string;
  added_at: string;
  fetched_at: string;
};

const fromRow = (r: Row): LibraryItem => ({
  id: r.id,
  source: r.source,
  externalId: r.external_id,
  type: r.type,
  title: r.title,
  year: r.year,
  posterUrl: r.poster_url,
  genres: JSON.parse(r.genres),
  extra: JSON.parse(r.extra),
  status: r.status,
  rating: r.rating,
  favorite: r.favorite === 1,
  notes: r.notes,
  addedAt: r.added_at,
  fetchedAt: r.fetched_at,
});

// Open the database once and reuse the connection.
let db: Promise<Database> | null = null;
const getDb = () => (db ??= Database.load("sqlite:media-tracker.db"));

// --- browser fallback ---
const LS_KEY = "library";
const lsRead = (): LibraryItem[] => JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
const lsWrite = (items: LibraryItem[]) => localStorage.setItem(LS_KEY, JSON.stringify(items));

/** All saved items of one type, newest first. */
export async function listItems(type: MediaType): Promise<LibraryItem[]> {
  if (!isTauri()) {
    return lsRead()
      .filter((i) => i.type === type)
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }
  const rows = await (await getDb()).select<Row[]>("SELECT * FROM items WHERE type = $1 ORDER BY added_at DESC", [type]);
  return rows.map(fromRow);
}

/** Saves a search result to the library with the default "want to" status. */
export async function addItem(result: SearchResult): Promise<void> {
  const now = new Date().toISOString();
  const status: Status = result.type === "movie" ? "Want to watch" : "Want to play";
  const extra = result.platforms ? { platforms: result.platforms } : {};

  if (!isTauri()) {
    const items = lsRead();
    if (items.some((i) => i.source === result.source && i.externalId === result.externalId)) return;
    const id = Math.max(0, ...items.map((i) => i.id)) + 1;
    const { platforms: _platforms, ...rest } = result;
    items.push({ ...rest, id, extra, status, rating: null, favorite: false, notes: "", addedAt: now, fetchedAt: now });
    return lsWrite(items);
  }

  // "OR IGNORE": adding something that's already saved does nothing (UNIQUE source + external_id).
  await (await getDb()).execute(
    `INSERT OR IGNORE INTO items
       (source, external_id, type, title, year, poster_url, genres, extra, status, added_at, fetched_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      result.source,
      result.externalId,
      result.type,
      result.title,
      result.year,
      result.posterUrl,
      JSON.stringify(result.genres),
      JSON.stringify(extra),
      status,
      now,
      now,
    ],
  );
}

/** The fields the user can edit on a saved item. */
export type ItemChanges = Partial<Pick<LibraryItem, "status" | "rating" | "favorite" | "notes">>;
const EDITABLE_COLUMNS = ["status", "rating", "favorite", "notes"];

/** Saves the user's edits (status, rating, favorite, notes) for one item. */
export async function updateItem(id: number, changes: ItemChanges): Promise<void> {
  if (!isTauri()) {
    return lsWrite(lsRead().map((i) => (i.id === id ? { ...i, ...changes } : i)));
  }
  // Build "SET status = $1, rating = $2 ..." from only the fields that changed.
  // Column names can't be bound like values, so only known columns get through.
  const entries = Object.entries(changes)
    .filter(([key]) => EDITABLE_COLUMNS.includes(key))
    .map(([key, value]) => (key === "favorite" ? [key, value ? 1 : 0] : [key, value]));
  if (entries.length === 0) return;
  const setClause = entries.map(([key], n) => `${key} = $${n + 1}`).join(", ");
  await (await getDb()).execute(`UPDATE items SET ${setClause} WHERE id = $${entries.length + 1}`, [
    ...entries.map(([, value]) => value),
    id,
  ]);
}

export async function removeItem(id: number): Promise<void> {
  if (!isTauri()) return lsWrite(lsRead().filter((i) => i.id !== id));
  await (await getDb()).execute("DELETE FROM items WHERE id = $1", [id]);
}
