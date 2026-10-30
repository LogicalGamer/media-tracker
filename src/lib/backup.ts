import { GAME_STATUSES, MOVIE_STATUSES, type LibraryItem } from "@/lib/library";

// A backup is one JSON file holding the whole library (movies and games), so it
// can be moved to another computer or restored after a reinstall. It contains
// only what's in the library; API keys and settings are never included.

const APP_ID = "media-tracker";
const FORMAT_VERSION = 1;

type BackupFile = {
  app: typeof APP_ID;
  version: number;
  exportedAt: string;
  items: Omit<LibraryItem, "id">[];
};

/** The library as nicely indented JSON text. Database ids are left out: they're only meaningful on this computer. */
export function createBackup(items: LibraryItem[]): string {
  const file: BackupFile = {
    app: APP_ID,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    items: items.map(({ id: _id, ...rest }) => rest),
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Reads a backup file's text. Throws a readable Error if it isn't a Media Tracker
 * backup. Items that look damaged are skipped and counted instead of failing everything.
 */
export function readBackup(text: string): { items: Omit<LibraryItem, "id">[]; skipped: number } {
  let data: Partial<BackupFile>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (data?.app !== APP_ID || !Array.isArray(data.items)) throw new Error("That file isn't a Media Tracker backup.");
  if ((data.version ?? 0) > FORMAT_VERSION) throw new Error("That backup comes from a newer version of the app. Update first.");

  const items = data.items.filter(isValidItem);
  return { items, skipped: data.items.length - items.length };
}

const STATUSES: readonly string[] = [...MOVIE_STATUSES, ...GAME_STATUSES];
const isText = (v: unknown) => typeof v === "string";
const isTextList = (v: unknown) => Array.isArray(v) && v.every(isText);

/** Checks every field has the right kind of value before it goes into the database. */
function isValidItem(v: unknown): v is Omit<LibraryItem, "id"> {
  const i = v as Record<string, unknown>;
  return (
    typeof i === "object" &&
    i !== null &&
    (i.source === "tmdb" || i.source === "igdb") &&
    (i.type === "movie" || i.type === "game") &&
    isText(i.externalId) &&
    isText(i.title) &&
    (i.year === null || typeof i.year === "number") &&
    (i.posterUrl === null || isText(i.posterUrl)) &&
    isTextList(i.genres) &&
    typeof i.extra === "object" &&
    i.extra !== null &&
    STATUSES.includes(i.status as string) &&
    (i.rating === null || (Number.isInteger(i.rating) && (i.rating as number) >= 1 && (i.rating as number) <= 10)) &&
    typeof i.favorite === "boolean" &&
    isText(i.notes) &&
    isText(i.addedAt) &&
    isText(i.fetchedAt)
  );
}
