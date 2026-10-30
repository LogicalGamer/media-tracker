export type MediaType = "movie" | "game";
export type Source = "tmdb" | "igdb";

/** One search hit, in the same shape for both APIs. */
export type SearchResult = {
  source: Source;
  externalId: string;
  type: MediaType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  genres: string[];
  platforms?: string[]; // games only
};

/** "2010-07-15" -> 2010 */
export function yearOf(date: string | null | undefined): number | null {
  return date ? Number(date.slice(0, 4)) || null : null;
}
