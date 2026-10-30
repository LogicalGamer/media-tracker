import { isTauri } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import type { Credits, MediaType, SearchResult, Source } from "@/lib/api/types";

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
  extra: { platforms?: string[] } & Credits; // directors/composers (movies) or developers (games)
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

/** Every saved item (movies and games), oldest first. Used for backups. */
export async function listAllItems(): Promise<LibraryItem[]> {
  if (!isTauri()) return lsRead().sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  const rows = await (await getDb()).select<Row[]>("SELECT * FROM items ORDER BY added_at");
  return rows.map(fromRow);
}

/**
 * Puts items from a backup into the library. Items already saved (same source
 * and id) get the backup's status, rating, favorite and notes; others are added.
 */
export async function restoreItems(items: Omit<LibraryItem, "id">[]): Promise<{ added: number; updated: number }> {
  const existing = await listAllItems();
  const keyOf = (i: { source: string; externalId: string }) => `${i.source}:${i.externalId}`;
  const byKey = new Map(existing.map((i) => [keyOf(i), i]));
  let added = 0;
  let updated = 0;

  for (const item of items) {
    const match = byKey.get(keyOf(item));
    if (match) {
      await updateItem(match.id, { status: item.status, rating: item.rating, favorite: item.favorite, notes: item.notes });
      updated++;
    } else if (!isTauri()) {
      const all = lsRead();
      all.push({ ...item, id: Math.max(0, ...all.map((i) => i.id)) + 1 });
      lsWrite(all);
      added++;
    } else {
      await (await getDb()).execute(
        `INSERT OR IGNORE INTO items
           (source, external_id, type, title, year, poster_url, genres, extra, status, rating, favorite, notes, added_at, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          item.source,
          item.externalId,
          item.type,
          item.title,
          item.year,
          item.posterUrl,
          JSON.stringify(item.genres),
          JSON.stringify(item.extra),
          item.status,
          item.rating,
          item.favorite ? 1 : 0,
          item.notes,
          item.addedAt,
          item.fetchedAt,
        ],
      );
      added++;
    }
  }
  return { added, updated };
}

/** Saves a search result to the library with the default "want to" status. */
export async function addItem(result: SearchResult): Promise<void> {
  const now = new Date().toISOString();
  const status: Status = result.type === "movie" ? "Want to watch" : "Want to play";
  // Games arrive with their developers; a movie's crew is looked up right after saving (see useFillDetails).
  const extra = result.type === "game" ? { platforms: result.platforms ?? [], developers: result.developers ?? [] } : {};

  if (!isTauri()) {
    const items = lsRead();
    if (items.some((i) => i.source === result.source && i.externalId === result.externalId)) return;
    const id = Math.max(0, ...items.map((i) => i.id)) + 1;
    const { platforms: _platforms, developers: _developers, ...rest } = result;
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

/** Fresh info downloaded for a saved item. Fields left out keep their current value. */
export type ItemDetails = Partial<Pick<LibraryItem, "title" | "year" | "posterUrl" | "genres">> & Credits;

/** Stores looked-up details (directors, composers, refreshed title/poster...) and marks the item as freshly fetched. */
export async function saveDetails(item: LibraryItem, details: ItemDetails): Promise<void> {
  const { title = item.title, year = item.year, posterUrl = item.posterUrl, genres = item.genres, ...credits } = details;
  const extra = { ...item.extra, ...credits };
  const now = new Date().toISOString();
  if (!isTauri()) {
    return lsWrite(
      lsRead().map((i) => (i.id === item.id ? { ...i, title, year, posterUrl, genres, extra, fetchedAt: now } : i)),
    );
  }
  await (await getDb()).execute(
    "UPDATE items SET title = $1, year = $2, poster_url = $3, genres = $4, extra = $5, fetched_at = $6 WHERE id = $7",
    [title, year, posterUrl, JSON.stringify(genres), JSON.stringify(extra), now, item.id],
  );
}

export async function removeItem(id: number): Promise<void> {
  if (!isTauri()) return lsWrite(lsRead().filter((i) => i.id !== id));
  await (await getDb()).execute("DELETE FROM items WHERE id = $1", [id]);
}
