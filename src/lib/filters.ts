import type { MediaType } from "@/lib/api/types";
import type { LibraryItem } from "@/lib/library";

// Filtering the saved library. Everything happens in memory: a personal
// library is a few hundred items at most, so this is instant.

/** A list-type filter: you tick names (genres, directors...) and items matching any of them are shown. */
export type FacetKey = "genres" | "directors" | "composers" | "developers";

export const FACETS: Record<MediaType, { key: FacetKey; label: string }[]> = {
  movie: [
    { key: "genres", label: "Genre" },
    { key: "directors", label: "Director" },
    { key: "composers", label: "Composer" },
  ],
  // IGDB has no directors or composers, so games filter by studio instead
  game: [
    { key: "genres", label: "Genre" },
    { key: "developers", label: "Developer" },
  ],
};

export const RATING_OPTIONS = [
  { value: "any", label: "Any" },
  { value: 9, label: "9+" },
  { value: 7, label: "7+" },
  { value: 5, label: "5+" },
  { value: "unrated", label: "Unrated" },
] as const;
export type RatingFilter = (typeof RATING_OPTIONS)[number]["value"];

export type Filters = {
  text: string;
  facets: Record<FacetKey, string[]>;
  rating: RatingFilter;
  favoritesOnly: boolean;
};

export const EMPTY_FILTERS: Filters = {
  text: "",
  facets: { genres: [], directors: [], composers: [], developers: [] },
  rating: "any",
  favoritesOnly: false,
};

const valuesOf = (item: LibraryItem, key: FacetKey) => (key === "genres" ? item.genres : (item.extra[key] ?? []));

/** Keeps the items that pass every active filter. Inside one list (e.g. two genres), matching either is enough. */
export function applyFilters(items: LibraryItem[], f: Filters): LibraryItem[] {
  const text = f.text.trim().toLowerCase();
  return items.filter((item) => {
    if (text && !item.title.toLowerCase().includes(text)) return false;
    if (f.favoritesOnly && !item.favorite) return false;
    if (f.rating === "unrated" && item.rating !== null) return false;
    if (typeof f.rating === "number" && (item.rating ?? 0) < f.rating) return false;
    for (const [key, chosen] of Object.entries(f.facets) as [FacetKey, string[]][]) {
      if (chosen.length > 0 && !valuesOf(item, key).some((v) => chosen.includes(v))) return false;
    }
    return true;
  });
}

/** Every name that appears in the library for one list, with how many items have it. Most common first. */
export function facetOptions(items: LibraryItem[], key: FacetKey): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const v of valuesOf(item, key)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export const SORT_OPTIONS = [
  { value: "added", label: "Date added" },
  { value: "title", label: "Title (A–Z)" },
  { value: "rating", label: "My rating" },
  { value: "year", label: "Release year" },
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

/** Returns a sorted copy. Items without a rating or year go last. */
export function sortItems(items: LibraryItem[], sortBy: SortKey): LibraryItem[] {
  const copy = [...items];
  if (sortBy === "added") copy.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  if (sortBy === "title") copy.sort((a, b) => a.title.localeCompare(b.title));
  if (sortBy === "rating") copy.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  if (sortBy === "year") copy.sort((a, b) => (b.year ?? -1) - (a.year ?? -1));
  return copy;
}

/** How many filters are switched on (shown on the Filters button). The title search isn't counted. */
export function activeFilterCount(f: Filters): number {
  return (
    Object.values(f.facets).reduce((n, chosen) => n + chosen.length, 0) +
    (f.rating !== "any" ? 1 : 0) +
    (f.favoritesOnly ? 1 : 0)
  );
}
